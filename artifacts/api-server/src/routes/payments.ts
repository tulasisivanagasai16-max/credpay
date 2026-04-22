import { Router, type IRouter } from "express";
import {
  CreatePaymentIntentBody,
  CreatePaymentIntentResponse,
  ConfirmPaymentIntentBody,
  ConfirmPaymentIntentParams,
  ConfirmPaymentIntentResponse,
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
import {
  createOrder,
  fetchPayment,
  isRazorpayLive,
  RAZORPAY_PUBLIC_KEY_ID,
  verifyCheckoutSignature,
} from "../services/razorpay";

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

  // Create the Razorpay order up-front so the FE can launch checkout right away.
  const order = await createOrder({
    amountPaise,
    receipt: `cw_${Date.now()}`,
    notes: { userId: u.id },
  });

  const [intent] = await db
    .insert(paymentIntentsTable)
    .values({
      userId: u.id,
      amountPaise: dbNumeric(amountPaise),
      feePaise: dbNumeric(feePaise),
      netPaise: dbNumeric(netPaise),
      status: "REQUIRES_CONFIRMATION",
      gateway: isRazorpayLive ? "razorpay" : "razorpay-mock",
      gatewayRef: order.id,
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
      clientSecret: `cs_${intent!.id}`,
      transactionId: null,
      razorpayKeyId: RAZORPAY_PUBLIC_KEY_ID,
      razorpayOrderId: order.id,
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
    res.json(buildIntentResponse(intent));
    return;
  }

  let cardLast4 = body.cardLast4 ?? null;
  let gatewayRef = intent.gatewayRef ?? `pay_${Date.now()}`;
  let charged: { ok: boolean; reason?: string };

  if (isRazorpayLive) {
    // Real path — verify the signature returned by Razorpay Checkout.
    if (!body.razorpayPaymentId || !body.razorpayOrderId || !body.razorpaySignature) {
      res.status(400).json({ error: "Missing Razorpay confirmation fields" });
      return;
    }
    if (body.razorpayOrderId !== intent.gatewayRef) {
      res.status(400).json({ error: "Order id mismatch" });
      return;
    }
    const sigOk = verifyCheckoutSignature({
      orderId: body.razorpayOrderId,
      paymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    });
    if (!sigOk) {
      res.status(400).json({ error: "Razorpay signature verification failed" });
      return;
    }
    // Cross-check status with Razorpay (defense in depth).
    const payment = await fetchPayment(body.razorpayPaymentId);
    const ok = payment && (payment.status === "captured" || payment.status === "authorized");
    cardLast4 = payment?.card?.last4 ?? cardLast4;
    gatewayRef = body.razorpayPaymentId;
    charged = ok ? { ok: true } : { ok: false, reason: "Payment not captured" };
  } else {
    // Mock path: cardLast4 starting with "0" simulates a decline.
    if (!cardLast4) {
      res.status(400).json({ error: "cardLast4 required in mock mode" });
      return;
    }
    charged = cardLast4.startsWith("0")
      ? { ok: false, reason: "Card declined" }
      : { ok: true };
  }

  await db
    .update(paymentIntentsTable)
    .set({
      status: "PROCESSING",
      cardLast4,
      cardholderName: body.cardholderName ?? null,
      gatewayRef,
    })
    .where(eq(paymentIntentsTable.id, id));

  if (!charged.ok) {
    await db
      .update(paymentIntentsTable)
      .set({ status: "FAILED" })
      .where(eq(paymentIntentsTable.id, id));

    const failedTxn = await postTransaction({
      userId: u.id,
      type: "LOAD",
      status: "FAILED",
      amountPaise: BigInt(intent.amountPaise),
      feePaise: 0n,
      netPaise: 0n,
      description: `Card load failed (${charged.reason ?? "declined"})`,
      referenceId: gatewayRef,
      postings: [],
    });

    res.json({
      ...buildIntentResponse({ ...intent, status: "FAILED" }),
      transactionId: failedTxn.transactionId,
    });
    return;
  }

  // SUCCESS: post the double-entry ledger.
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
    referenceId: gatewayRef,
    idempotencyKey: intent.idempotencyKey ?? undefined,
    postings: [
      { accountId: platformCash.id, direction: "DEBIT", amountPaise: BigInt(intent.amountPaise) },
      { accountId: userAcct.id, direction: "CREDIT", amountPaise: BigInt(intent.netPaise) },
      { accountId: feeRevenue.id, direction: "CREDIT", amountPaise: BigInt(intent.feePaise) },
    ],
  });

  await db
    .update(paymentIntentsTable)
    .set({ status: "SUCCESS", gatewayRef, transactionId })
    .where(eq(paymentIntentsTable.id, id));

  res.json({
    ...buildIntentResponse({ ...intent, status: "SUCCESS", gatewayRef }),
    transactionId,
  });
});

function buildIntentResponse(intent: {
  id: string;
  amountPaise: string;
  feePaise: string;
  netPaise: string;
  status: string;
  gateway: string;
  gatewayRef?: string | null;
  transactionId: string | null;
  createdAt: Date;
}) {
  return CreatePaymentIntentResponse.parse({
    id: intent.id,
    amountInr: paiseToInr(intent.amountPaise),
    feeInr: paiseToInr(intent.feePaise),
    netInr: paiseToInr(intent.netPaise),
    status: intent.status,
    gateway: intent.gateway,
    clientSecret: null,
    transactionId: intent.transactionId,
    razorpayKeyId: RAZORPAY_PUBLIC_KEY_ID,
    razorpayOrderId: intent.gatewayRef ?? null,
    createdAt: intent.createdAt.toISOString(),
  });
}

export default router;
