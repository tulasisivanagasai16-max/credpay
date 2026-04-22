// Mock payment gateway adapter (Razorpay/Stripe-style).
// In production this is a thin adapter over the real SDK + signed webhook handler.
// CRITICAL: We never store full PAN, CVV, or expiry. Only last4 + cardholder name (PCI scope-out).

import crypto from "node:crypto";

const WEBHOOK_SECRET =
  process.env["GATEWAY_WEBHOOK_SECRET"] ?? "demo-secret-rotate-me";

export interface GatewayCharge {
  gatewayRef: string;
  status: "succeeded" | "failed";
  failureReason?: string;
}

export function signWebhook(payload: string): string {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expected = signWebhook(payload);
  // Constant-time compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Simulate a card charge. Fails if cardLast4 starts with "0". */
export async function chargeCard(opts: {
  amountPaise: bigint;
  cardLast4: string;
  cardholderName?: string;
}): Promise<GatewayCharge> {
  await new Promise((r) => setTimeout(r, 150));
  if (opts.cardLast4.startsWith("0")) {
    return { gatewayRef: `pay_fail_${Date.now()}`, status: "failed", failureReason: "Card declined" };
  }
  return { gatewayRef: `pay_${crypto.randomBytes(8).toString("hex")}`, status: "succeeded" };
}
