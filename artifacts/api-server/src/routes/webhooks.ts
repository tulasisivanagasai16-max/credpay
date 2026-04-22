import { Router, type IRouter, type Request } from "express";
import crypto from "node:crypto";
import { db, paymentIntentsTable, payoutsTable, payeesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "../services/razorpay";
import {
  ensureSystemAccounts,
  getOrCreateUserAccount,
  postTransaction,
} from "../services/ledger.service";

const router: IRouter = Router();

function rawBodyOf(req: Request): string {
  return (req as unknown as { rawBody?: string }).rawBody ?? "";
}

// ---------------- Razorpay ----------------
// Header: x-razorpay-signature = HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
// Events handled: payment.captured, payment.failed
router.post("/webhooks/razorpay", async (req, res) => {
  const sig = (req.headers["x-razorpay-signature"] as string | undefined) ?? "";
  const raw = rawBodyOf(req);
  if (!verifyWebhookSignature(raw, sig)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.body as {
    event?: string;
    payload?: { payment?: { entity?: Record<string, unknown> } };
  };
  const payment = event?.payload?.payment?.entity;
  if (!event?.event || !payment) {
    res.json({ received: true, ignored: true });
    return;
  }

  const orderId = String(payment["order_id"] ?? "");
  const paymentId = String(payment["id"] ?? "");
  const last4 =
    (payment["card"] as { last4?: string } | undefined)?.last4 ?? null;

  const intent = (
    await db
      .select()
      .from(paymentIntentsTable)
      .where(eq(paymentIntentsTable.gatewayRef, orderId))
  )[0];
  if (!intent) {
    res.json({ received: true, ignored: "no matching intent" });
    return;
  }
  if (intent.status === "SUCCESS" || intent.status === "FAILED") {
    res.json({ received: true, idempotent: true });
    return;
  }

  if (event.event === "payment.captured") {
    const { platformCash, feeRevenue } = await ensureSystemAccounts();
    const userAcct = await getOrCreateUserAccount(intent.userId);
    const idem = `rzp_webhook_${paymentId}`;
    const { transactionId } = await postTransaction({
      userId: intent.userId,
      type: "LOAD",
      status: "SUCCESS",
      amountPaise: BigInt(intent.amountPaise),
      feePaise: BigInt(intent.feePaise),
      netPaise: BigInt(intent.netPaise),
      description: `Card load via razorpay (webhook)`,
      referenceId: paymentId,
      idempotencyKey: idem,
      postings: [
        { accountId: platformCash.id, direction: "DEBIT", amountPaise: BigInt(intent.amountPaise) },
        { accountId: userAcct.id, direction: "CREDIT", amountPaise: BigInt(intent.netPaise) },
        { accountId: feeRevenue.id, direction: "CREDIT", amountPaise: BigInt(intent.feePaise) },
      ],
    });
    await db
      .update(paymentIntentsTable)
      .set({
        status: "SUCCESS",
        gatewayRef: paymentId,
        transactionId,
        cardLast4: last4 ?? intent.cardLast4,
      })
      .where(eq(paymentIntentsTable.id, intent.id));
    res.json({ received: true, applied: "payment.captured", transactionId });
    return;
  }

  if (event.event === "payment.failed") {
    await db
      .update(paymentIntentsTable)
      .set({ status: "FAILED", gatewayRef: paymentId })
      .where(eq(paymentIntentsTable.id, intent.id));
    res.json({ received: true, applied: "payment.failed" });
    return;
  }

  res.json({ received: true, ignored: event.event });
});

// ---------------- Cashfree Payouts v2 ----------------
// Header: x-webhook-signature = base64( HMAC-SHA256( timestamp + rawBody, secret ) )
// Header: x-webhook-timestamp = unix epoch (seconds)
// Events: TRANSFER_SUCCESS, TRANSFER_FAILED, TRANSFER_REVERSED
function verifyCashfreeWebhook(rawBody: string, ts: string, sig: string): boolean {
  const secret =
    process.env["CASHFREE_WEBHOOK_SECRET"] ?? process.env["CASHFREE_CLIENT_SECRET"] ?? "";
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(ts + rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

router.post("/webhooks/cashfree", async (req, res) => {
  const sig = (req.headers["x-webhook-signature"] as string | undefined) ?? "";
  const ts = (req.headers["x-webhook-timestamp"] as string | undefined) ?? "";
  const raw = rawBodyOf(req);
  if (!verifyCashfreeWebhook(raw, ts, sig)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const body = req.body as {
    type?: string;
    data?: { transfer?: Record<string, unknown> };
  };
  const transfer = body?.data?.transfer;
  if (!body?.type || !transfer) {
    res.json({ received: true, ignored: true });
    return;
  }

  const transferId = String(transfer["transfer_id"] ?? "");
  const utr = (transfer["transfer_utr"] as string | undefined) ?? transferId;
  const status = String(transfer["status"] ?? "").toUpperCase();
  const reason = (transfer["status_description"] as string | undefined) ?? null;

  // Our processPayoutInternal sets transferId = `tx_<payoutId>`.
  const payoutId = transferId.startsWith("tx_") ? transferId.slice(3) : transferId;
  const payout = (await db.select().from(payoutsTable).where(eq(payoutsTable.id, payoutId)))[0];
  if (!payout) {
    res.json({ received: true, ignored: "no matching payout" });
    return;
  }
  if (payout.status === "SUCCESS" || payout.status === "FAILED") {
    res.json({ received: true, idempotent: true });
    return;
  }

  const isSuccess =
    body.type === "TRANSFER_SUCCESS" || status === "SUCCESS" || status === "COMPLETED";
  const isFailure =
    body.type === "TRANSFER_FAILED" ||
    body.type === "TRANSFER_REVERSED" ||
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "REVERSED";

  if (isSuccess) {
    const payee = (
      await db.select().from(payeesTable).where(eq(payeesTable.id, payout.payeeId))
    )[0];
    const { platformCash, feeRevenue } = await ensureSystemAccounts();
    const userAcct = await getOrCreateUserAccount(payout.userId);
    const idem = `cf_webhook_${transferId}`;
    const { transactionId } = await postTransaction({
      userId: payout.userId,
      type: "PAYOUT",
      status: "SUCCESS",
      amountPaise: BigInt(payout.amountPaise),
      feePaise: BigInt(payout.feePaise),
      netPaise: BigInt(payout.amountPaise),
      description: `Payout to ${payee?.label ?? "payee"} (webhook)`,
      referenceId: utr,
      idempotencyKey: idem,
      postings: [
        { accountId: userAcct.id, direction: "DEBIT", amountPaise: BigInt(payout.totalDebitPaise) },
        { accountId: platformCash.id, direction: "CREDIT", amountPaise: BigInt(payout.amountPaise) },
        { accountId: feeRevenue.id, direction: "CREDIT", amountPaise: BigInt(payout.feePaise) },
      ],
    });
    await db
      .update(payoutsTable)
      .set({
        status: "SUCCESS",
        gatewayRef: utr,
        transactionId,
        completedAt: new Date(),
      })
      .where(eq(payoutsTable.id, payout.id));
    res.json({ received: true, applied: "TRANSFER_SUCCESS", transactionId });
    return;
  }

  if (isFailure) {
    await db
      .update(payoutsTable)
      .set({
        status: "FAILED",
        failureReason: reason ?? body.type ?? "Transfer failed",
        gatewayRef: utr,
        completedAt: new Date(),
      })
      .where(eq(payoutsTable.id, payout.id));
    res.json({ received: true, applied: body.type ?? "TRANSFER_FAILED" });
    return;
  }

  res.json({ received: true, ignored: body.type });
});

export default router;
