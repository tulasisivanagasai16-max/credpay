import { Router, type IRouter } from "express";
import { GetWalletResponse, GetWalletSummaryResponse } from "@workspace/api-zod";
import { db, walletsTable, transactionsTable } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireUser } from "../middlewares/auth";
import { getUserWalletBalance } from "../services/ledger.service";
import { getDailyLimitPaise, getTodayTotals } from "../services/kyc.service";
import { paiseToInr } from "../services/money";

const router: IRouter = Router();

async function getOrCreateWallet(userId: string) {
  const existing = (await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)))[0];
  if (existing) return existing;
  const [created] = await db.insert(walletsTable).values({ userId }).returning();
  return created!;
}

router.get("/wallet", requireUser, async (req, res) => {
  const u = req.user!;
  const w = await getOrCreateWallet(u.id);
  const bal = await getUserWalletBalance(u.id);
  res.json(
    GetWalletResponse.parse({
      id: w.id,
      balanceInr: paiseToInr(bal),
      currency: w.currency,
      status: w.status,
      updatedAt: w.updatedAt.toISOString(),
    }),
  );
});

router.get("/wallet/summary", requireUser, async (req, res) => {
  const u = req.user!;
  const bal = await getUserWalletBalance(u.id);
  const today = await getTodayTotals(u.id);
  const limit = await getDailyLimitPaise(u.id);

  const totalsRows = await db
    .select({
      type: transactionsTable.type,
      total: sql<string>`COALESCE(SUM(${transactionsTable.amountPaise}), 0)`,
      fees: sql<string>`COALESCE(SUM(${transactionsTable.feePaise}), 0)`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, u.id), eq(transactionsTable.status, "SUCCESS")))
    .groupBy(transactionsTable.type);

  let totalLoaded = 0n;
  let totalPayout = 0n;
  let totalFees = 0n;
  for (const r of totalsRows) {
    if (r.type === "LOAD") totalLoaded = BigInt(r.total);
    if (r.type === "PAYOUT") totalPayout = BigInt(r.total);
    totalFees += BigInt(r.fees);
  }

  const recent = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, u.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(8);

  res.json(
    GetWalletSummaryResponse.parse({
      balanceInr: paiseToInr(bal),
      todayLoadedInr: paiseToInr(today.loadedPaise),
      todayPayoutInr: paiseToInr(today.payoutPaise),
      dailyLimitInr: paiseToInr(limit),
      totalLoadedInr: paiseToInr(totalLoaded),
      totalPayoutInr: paiseToInr(totalPayout),
      totalFeesInr: paiseToInr(totalFees),
      recentTransactions: recent.map((t) => ({
        id: t.id,
        type: t.type,
        status: t.status,
        amountInr: paiseToInr(t.amountPaise),
        feeInr: paiseToInr(t.feePaise),
        netInr: paiseToInr(t.netPaise),
        description: t.description,
        referenceId: t.referenceId,
        createdAt: t.createdAt.toISOString(),
      })),
    }),
  );
});

export default router;
