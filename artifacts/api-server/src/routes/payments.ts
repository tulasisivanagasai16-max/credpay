import { Router, type IRouter } from "express";
import {
  CreatePaymentIntentBody,
  CreatePaymentIntentResponse,
  ConfirmPaymentIntentBody,
  ConfirmPaymentIntentParams,
  ConfirmPaymentIntentResponse,
  PaymentsWebhookBody,
  PaymentsWebhookResponse,
} from "@workspace/api-zod";
import { db, paymentIntentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";
import { quoteFee } from "../services/fees.service";
import { dbNumeric, inrToPaise, paiseToInr } from "../services/money";
import {
  ensureSystemAccounts,
  getOrCreateUserAccount,
  postTransaction,
} from "../services/ledger.service";
import { checkLimit } from "../services/kyc.service";
import { chargeCard, verifyWebhookSignature } from "../services/payment-gateway";

const router: IRouter = Router();

router.post("/payments/intents", requireUser, async (req, res) => {
  const u = req.user!;
  const body = CreatePaymentIntentBody.parse(req.body);
  const amountPaise = inrToPaise(body.amountInr);

  const limit = await checkLimit(u.id, "LOAD", amountPaise);
  if (!limit.ok) {
    res.status(400).json({ error: limit.reason });
    return;
  }

  const { feePaise, netPaise } = quoteFee("LOAD", amountPaise);
  const [intent] = await db
    .insert(paymentIntentsTable)
    .values({
      userId: u.id,
      amountPaise: dbNumeric(amountPaise),
      feePaise: dbNumeric(feePaise),
      netPaise: dbNumeric(netPaise),
      status: "REQUIRES_CONFIRMATION",
      idempotencyKey: body.idempotencyKey ?? null,
    })
    .returning();

  res.json(
    CreatePaymentIntentResponse.parse({
      id: intent!.id,
      amountInr: paiseToInr(amountPaise),
      feeInr: paiseToInr(feePaise),
      netInr: paiseToInr(netPaise),
      status: intent!.status,
      gateway: intent!.gateway,
      clientSecret: `cs_demo_${intent!.id}`,
      transactionId: null,
      createdAt: intent!.createdAt.toISOString(),
    }),
  );
});

router.post("/payments/intents/:id/confirm", requireUser, async (req, res) => {
  const u = req.user!;
  const { id } = ConfirmPaymentIntentParams.parse(req.params);
  const body = ConfirmPaymentIntentBody.parse(req.body);

  const intent = (await db.select().from(paymentIntentsTable).where(eq(paymentIntentsTable.id, id)))[0];
  if (!intent || intent.userId !== u.id) {
    res.status(404).json({ error: "Intent not found" });
    return;
  }
  if (intent.status === "SUCCESS" && intent.transactionId) {
    res.json(
      ConfirmPaymentIntentResponse.parse({
        id: intent.id,
        amountInr: paiseToInr(intent.amountPaise),
        feeInr: paiseToInr(intent.feePaise),
        netInr: paiseToInr(intent.netPaise),
        status: intent.status,
        gateway: intent.gateway,
        clientSecret: null,
        transactionId: intent.transactionId,
        createdAt: intent.createdAt.toISOString(),
      }),
    );
    return;
  }

  await db
    .update(paymentIntentsTable)
    .set({ status: "PROCESSING", cardLast4: body.cardLast4, cardholderName: body.cardholderName ?? null })
    .where(eq(paymentIntentsTable.id, id));

  const charge = await chargeCard({
    amountPaise: BigInt(intent.amountPaise),
    cardLast4: body.cardLast4,
    cardholderName: body.cardholderName,
  });

  if (charge.status === "failed") {
    await db
      .update(paymentIntentsTable)
      .set({ status: "FAILED", gatewayRef: charge.gatewayRef })
      .where(eq(paymentIntentsTable.id, id));

    const failedTxn = await postTransaction({
      userId: u.id,
      type: "LOAD",
      status: "FAILED",
      amountPaise: BigInt(intent.amountPaise),
      feePaise: 0n,
      netPaise: 0n,
      description: `Card load failed (${charge.failureReason})`,
      referenceId: charge.gatewayRef,
      postings: [],
    });

    res.json(
      ConfirmPaymentIntentResponse.parse({
        id: intent.id,
        amountInr: paiseToInr(intent.amountPaise),
        feeInr: paiseToInr(intent.feePaise),
        netInr: paiseToInr(intent.netPaise),
        status: "FAILED",
        gateway: intent.gateway,
        clientSecret: null,
        transactionId: failedTxn.transactionId,
        createdAt: intent.createdAt.toISOString(),
      }),
    );
    return;
  }

  // Success: post double-entry ledger.
  // Card load flow:
  //   DEBIT  PLATFORM_CASH    amount   (we received money from gateway)
  //   CREDIT USER_WALLET      net      (user gets net coins)
  //   CREDIT FEE_REVENUE      fee      (platform earns fee)
  const { platformCash, feeRevenue } = await ensureSystemAccounts();
  const userAcct = await getOrCreateUserAccount(u.id);

  const { transactionId } = await postTransaction({
    userId: u.id,
    type: "LOAD",
    status: "SUCCESS",
    amountPaise: BigInt(intent.amountPaise),
    feePaise: BigInt(intent.feePaise),
    netPaise: BigInt(intent.netPaise),
    description: `Card load via ${intent.gateway}`,
    referenceId: charge.gatewayRef,
    idempotencyKey: intent.idempotencyKey ?? undefined,
    postings: [
      { accountId: platformCash.id, direction: "DEBIT", amountPaise: BigInt(intent.amountPaise) },
      { accountId: userAcct.id, direction: "CREDIT", amountPaise: BigInt(intent.netPaise) },
      { accountId: feeRevenue.id, direction: "CREDIT", amountPaise: BigInt(intent.feePaise) },
    ],
  });

  await db
    .update(paymentIntentsTable)
    .set({ status: "SUCCESS", gatewayRef: charge.gatewayRef, transactionId })
    .where(eq(paymentIntentsTable.id, id));

  res.json(
    ConfirmPaymentIntentResponse.parse({
      id: intent.id,
      amountInr: paiseToInr(intent.amountPaise),
      feeInr: paiseToInr(intent.feePaise),
      netInr: paiseToInr(intent.netPaise),
      status: "SUCCESS",
      gateway: intent.gateway,
      clientSecret: null,
      transactionId,
      createdAt: intent.createdAt.toISOString(),
    }),
  );
});

router.post("/payments/webhook", async (req, res) => {
  const body = PaymentsWebhookBody.parse(req.body);
  const payload = JSON.stringify({ event: body.event, paymentId: body.paymentId });
  const ok = verifyWebhookSignature(payload, body.signature);
  if (!ok) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  // In production: idempotently apply event to the matching payment intent.
  res.json(PaymentsWebhookResponse.parse({ received: true }));
});

export default router;
