// Mock payout gateway adapter (Cashfree/RazorpayX-style).
// Async by design — real systems queue these via Kafka/SQS and poll for terminal state.

import crypto from "node:crypto";

export interface PayoutResult {
  gatewayRef: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  failureReason?: string;
}

/** Simulate a UPI/bank payout dispatch. UPIs starting with "fail" fail; others succeed.  */
export async function dispatchPayout(opts: {
  type: "UPI" | "BANK";
  identifier: string;
  amountPaise: bigint;
}): Promise<PayoutResult> {
  await new Promise((r) => setTimeout(r, 200));
  const gatewayRef = `pout_${crypto.randomBytes(8).toString("hex")}`;
  if (opts.identifier.toLowerCase().startsWith("fail")) {
    return { gatewayRef, status: "FAILED", failureReason: "Beneficiary bank rejected the transfer" };
  }
  return { gatewayRef, status: "SUCCESS" };
}
