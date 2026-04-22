// KYC & limits service
import { db } from "@workspace/db";
import { kycRecordsTable, transactionsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

export const NON_KYC_DAILY_LIMIT_PAISE = 500_000n; // ₹5,000
export const KYC_DAILY_LIMIT_PAISE = 5_000_000n; // ₹50,000

export async function getDailyLimitPaise(userId: string): Promise<bigint> {
  const rec = (
    await db.select().from(kycRecordsTable).where(eq(kycRecordsTable.userId, userId))
  )[0];
  return rec?.status === "VERIFIED" ? KYC_DAILY_LIMIT_PAISE : NON_KYC_DAILY_LIMIT_PAISE;
}

export async function getTodayTotals(userId: string): Promise<{
  loadedPaise: bigint;
  payoutPaise: bigint;
}> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      type: transactionsTable.type,
      total: sql<string>`COALESCE(SUM(${transactionsTable.amountPaise}), 0)`,
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        gte(transactionsTable.createdAt, startOfDay),
        eq(transactionsTable.status, "SUCCESS"),
      ),
    )
    .groupBy(transactionsTable.type);

  let loaded = 0n;
  let payout = 0n;
  for (const r of rows) {
    if (r.type === "LOAD") loaded = BigInt(r.total);
    if (r.type === "PAYOUT") payout = BigInt(r.total);
  }
  return { loadedPaise: loaded, payoutPaise: payout };
}

export async function checkLimit(
  userId: string,
  kind: "LOAD" | "PAYOUT",
  amountPaise: bigint,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const limit = await getDailyLimitPaise(userId);
  const today = await getTodayTotals(userId);
  const used = kind === "LOAD" ? today.loadedPaise : today.payoutPaise;
  if (used + amountPaise > limit) {
    return {
      ok: false,
      reason: `Daily ${kind.toLowerCase()} limit exceeded (₹${
        Number(limit) / 100
      }). Complete KYC to raise limits.`,
    };
  }
  return { ok: true };
}

export async function getOrCreateKyc(userId: string) {
  const existing = (
    await db.select().from(kycRecordsTable).where(eq(kycRecordsTable.userId, userId))
  )[0];
  if (existing) return existing;
  const [created] = await db
    .insert(kycRecordsTable)
    .values({ userId, status: "PENDING" })
    .returning();
  return created!;
}
