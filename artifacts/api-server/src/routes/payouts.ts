import { Router, type IRouter } from "express";
import {
  CreatePayoutBody,
  CreatePayoutResponse,
  ListPayoutsResponse,
  RetryPayoutParams,
  RetryPayoutResponse,
} from "@workspace/api-zod";
import { db, payoutsTable, payeesTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";
import { quoteFee } from "../services/fees.service";
import { dbNumeric, inrToPaise, paiseToInr } from "../services/money";
import {
  ensureSystemAccounts,
  getOrCreateUserAccount,
  getUserWalletBalance,
  postTransaction,
} from "../services/ledger.service";
import { checkLimit } from "../services/kyc.service";
import { evaluatePayout, recordFlags } from "../services/risk.service";
import { dispatchPayout } from "../services/payout-gateway";

const router: IRouter = Router();

async function processPayoutInternal(payoutId: string) {
  const p = (await db.select().from(payoutsTable).where(eq(payoutsTable.id, payoutId)))[0];
  if (!p) return;
  const payee = (await db.select().from(payeesTable).where(eq(payeesTable.id, p.payeeId)))[0];
  if (!payee) return;

  await db.update(payoutsTable).set({ status: "PROCESSING" }).where(eq(payoutsTable.id, p.id));

  const result = await dispatchPayout({
    type: payee.type as "UPI" | "BANK",
    identifier: payee.identifier,
    amountPaise: BigInt(p.amountPaise),
  });

  const { platformCash, feeRevenue } = await ensureSystemAccounts();
  const userAcct = await getOrCreateUserAccount(p.userId);

  if (result.status === "SUCCESS") {
    // Payout flow:
    //   DEBIT  USER_WALLET     totalDebit  (amount + fee removed from user's coins)
    //   CREDIT PLATFORM_CASH   amount      (we send out cash)
    //   CREDIT FEE_REVENUE     fee         (platform earns fee)
    const { transactionId } = await postTransaction({
      userId: p.userId,
      type: "PAYOUT",
      status: "SUCCESS",
      amountPaise: BigInt(p.amountPaise),
      feePaise: BigInt(p.feePaise),
      netPaise: BigInt(p.amountPaise),
      description: `Payout to ${payee.label} (${payee.type})`,
      referenceId: result.gatewayRef,
      postings: [
        { accountId: userAcct.id, direction: "DEBIT", amountPaise: BigInt(p.totalDebitPaise) },
        { accountId: platformCash.id, direction: "CREDIT", amountPaise: BigInt(p.amountPaise) },
        { accountId: feeRevenue.id, direction: "CREDIT", amountPaise: BigInt(p.feePaise) },
      ],
    });
    await db
      .update(payoutsTable)
      .set({
        status: "SUCCESS",
        gatewayRef: result.gatewayRef,
        transactionId,
        completedAt: new Date(),
      })
      .where(eq(payoutsTable.id, p.id));
  } else {
    await db
      .update(payoutsTable)
      .set({
        status: "FAILED",
        failureReason: result.failureReason ?? "Unknown error",
        gatewayRef: result.gatewayRef,
        completedAt: new Date(),
      })
      .where(eq(payoutsTable.id, p.id));
  }
}

router.post("/payouts", requireUser, async (req, res) => {
  const u = req.user!;
  const body = CreatePayoutBody.parse(req.body);
  const amountPaise = inrToPaise(body.amountInr);

  const payee = (
    await db
      .select()
      .from(payeesTable)
      .where(and(eq(payeesTable.id, body.payeeId), eq(payeesTable.userId, u.id)))
  )[0];
  if (!payee) {
    res.status(404).json({ error: "Payee not found" });
    return;
  }

  // Risk
  const decision = await evaluatePayout(u.id, amountPaise);
  await recordFlags(u.id, decision.flags);
  if (!decision.allow) {
    res.status(403).json({ error: decision.reason ?? "Blocked by risk engine" });
    return;
  }

  // Limit
  const limit = await checkLimit(u.id, "PAYOUT", amountPaise);
  if (!limit.ok) {
    res.status(400).json({ error: limit.reason });
    return;
  }

  // Balance check
  const { feePaise } = quoteFee("PAYOUT", amountPaise);
  const totalDebit = amountPaise + feePaise;
  const bal = await getUserWalletBalance(u.id);
  if (bal < totalDebit) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  const [payout] = await db
    .insert(payoutsTable)
    .values({
      userId: u.id,
      payeeId: payee.id,
      amountPaise: dbNumeric(amountPaise),
      feePaise: dbNumeric(feePaise),
      totalDebitPaise: dbNumeric(totalDebit),
      status: "PENDING",
      note: body.note ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    })
    .returning();

  // Async dispatch — in production this enqueues to Kafka.
  setImmediate(() => {
    processPayoutInternal(payout!.id).catch((err) => {
      req.log.error({ err, payoutId: payout!.id }, "payout processing failed");
    });
  });

  res.json(
    CreatePayoutResponse.parse({
      id: payout!.id,
      payeeId: payee.id,
      payeeLabel: payee.label,
      amountInr: paiseToInr(amountPaise),
      feeInr: paiseToInr(feePaise),
      totalDebitInr: paiseToInr(totalDebit),
      status: payout!.status,
      failureReason: null,
      retryCount: payout!.retryCount,
      transactionId: null,
      createdAt: payout!.createdAt.toISOString(),
      completedAt: null,
    }),
  );
});

router.get("/payouts", requireUser, async (req, res) => {
  const u = req.user!;
  const rows = await db
    .select({
      p: payoutsTable,
      payeeLabel: payeesTable.label,
    })
    .from(payoutsTable)
    .leftJoin(payeesTable, eq(payeesTable.id, payoutsTable.payeeId))
    .where(eq(payoutsTable.userId, u.id))
    .orderBy(desc(payoutsTable.createdAt));

  res.json(
    ListPayoutsResponse.parse({
      items: rows.map((r) => ({
        id: r.p.id,
        payeeId: r.p.payeeId,
        payeeLabel: r.payeeLabel ?? "(deleted)",
        amountInr: paiseToInr(r.p.amountPaise),
        feeInr: paiseToInr(r.p.feePaise),
        totalDebitInr: paiseToInr(r.p.totalDebitPaise),
        status: r.p.status,
        failureReason: r.p.failureReason,
        retryCount: r.p.retryCount,
        transactionId: r.p.transactionId,
        createdAt: r.p.createdAt.toISOString(),
        completedAt: r.p.completedAt?.toISOString() ?? null,
      })),
    }),
  );
});

router.post("/payouts/:id/retry", requireUser, async (req, res) => {
  const u = req.user!;
  const { id } = RetryPayoutParams.parse(req.params);
  const p = (
    await db
      .select()
      .from(payoutsTable)
      .where(and(eq(payoutsTable.id, id), eq(payoutsTable.userId, u.id)))
  )[0];
  if (!p) {
    res.status(404).json({ error: "Payout not found" });
    return;
  }
  if (p.status !== "FAILED") {
    res.status(400).json({ error: "Only failed payouts can be retried" });
    return;
  }

  await db
    .update(payoutsTable)
    .set({ status: "PENDING", retryCount: p.retryCount + 1, failureReason: null })
    .where(eq(payoutsTable.id, p.id));

  setImmediate(() => {
    processPayoutInternal(p.id).catch((err) => {
      req.log.error({ err, payoutId: p.id }, "payout retry failed");
    });
  });

  const payee = (await db.select().from(payeesTable).where(eq(payeesTable.id, p.payeeId)))[0];
  res.json(
    RetryPayoutResponse.parse({
      id: p.id,
      payeeId: p.payeeId,
      payeeLabel: payee?.label ?? "(deleted)",
      amountInr: paiseToInr(p.amountPaise),
      feeInr: paiseToInr(p.feePaise),
      totalDebitInr: paiseToInr(p.totalDebitPaise),
      status: "PENDING",
      failureReason: null,
      retryCount: p.retryCount + 1,
      transactionId: p.transactionId,
      createdAt: p.createdAt.toISOString(),
      completedAt: null,
    }),
  );
});

export default router;
