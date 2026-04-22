// Configurable Fees Engine
// In production this lives in its own microservice with hot-reloadable config.

export type FeeKind = "LOAD" | "PAYOUT";

export interface FeeRule {
  bps: number; // basis points (100 bps = 1%)
  fixedPaise: number;
  minPaise: number;
  maxPaise: number;
}

const FEE_TABLE: Record<FeeKind, FeeRule> = {
  LOAD: { bps: 250, fixedPaise: 200, minPaise: 100, maxPaise: 50000 }, // 2.5% + ₹2
  PAYOUT: { bps: 100, fixedPaise: 500, minPaise: 200, maxPaise: 30000 }, // 1% + ₹5
};

export function quoteFee(kind: FeeKind, amountPaise: bigint): {
  feePaise: bigint;
  netPaise: bigint;
  rule: FeeRule;
} {
  const rule = FEE_TABLE[kind];
  let fee = (amountPaise * BigInt(rule.bps)) / 10000n + BigInt(rule.fixedPaise);
  if (fee < BigInt(rule.minPaise)) fee = BigInt(rule.minPaise);
  if (fee > BigInt(rule.maxPaise)) fee = BigInt(rule.maxPaise);
  // For LOAD: user is charged amount, wallet credited (amount - fee)
  // For PAYOUT: user is debited (amount + fee), payee receives amount
  const net = kind === "LOAD" ? amountPaise - fee : amountPaise;
  return { feePaise: fee, netPaise: net, rule };
}
