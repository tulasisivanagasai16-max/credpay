// Risk & Fraud Engine
// Simple rules: instant-withdrawal block, velocity, threshold.
// In production this is its own service consuming Kafka events.

import { db } from "@workspace/db";
import { transactionsTable, riskFlagsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

const INSTANT_WITHDRAWAL_WINDOW_MS = 5 * 60 * 1000; // block payouts within 5 min of a load
const VELOCITY_PAYOUTS_PER_HOUR = 10;
const HIGH_VALUE_PAISE = 5_000_000n; // ₹50,000

export interface RiskDecision {
  allow: boolean;
  reason?: string;
  flags: { kind: string; severity: "LOW" | "MEDIUM" | "HIGH"; message: string }[];
}

export async function evaluatePayout(userId: string, amountPaise: bigint): Promise<RiskDecision> {
  const flags: RiskDecision["flags"] = [];

  // 1. Instant-withdrawal-after-deposit guard.
  const since = new Date(Date.now() - INSTANT_WITHDRAWAL_WINDOW_MS);
  const recentLoads = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "LOAD"),
        eq(transactionsTable.status, "SUCCESS"),
        gte(transactionsTable.createdAt, since),
      ),
    );
  if ((recentLoads[0]?.count ?? 0) > 0) {
    return {
      allow: false,
      reason: "Cooling-off period: payouts are blocked for 5 minutes after adding money.",
      flags: [
        {
          kind: "INSTANT_WITHDRAWAL",
          severity: "HIGH",
          message: "Payout attempted within 5 min of a card load.",
        },
      ],
    };
  }

  // 2. Velocity: payouts per hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const lastHour = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "PAYOUT"),
        gte(transactionsTable.createdAt, hourAgo),
      ),
    );
  if ((lastHour[0]?.count ?? 0) >= VELOCITY_PAYOUTS_PER_HOUR) {
    return {
      allow: false,
      reason: `Velocity limit: max ${VELOCITY_PAYOUTS_PER_HOUR} payouts per hour.`,
      flags: [
        { kind: "VELOCITY", severity: "MEDIUM", message: "Payout velocity exceeded." },
      ],
    };
  }

  // 3. Amount threshold (flag, do not block)
  if (amountPaise >= HIGH_VALUE_PAISE) {
    flags.push({
      kind: "THRESHOLD",
      severity: "MEDIUM",
      message: `High-value payout: ₹${(Number(amountPaise) / 100).toLocaleString("en-IN")}`,
    });
  }

  return { allow: true, flags };
}

export async function recordFlags(
  userId: string,
  flags: RiskDecision["flags"],
): Promise<void> {
  if (flags.length === 0) return;
  await db.insert(riskFlagsTable).values(
    flags.map((f) => ({
      userId,
      kind: f.kind,
      severity: f.severity,
      message: f.message,
    })),
  );
}
