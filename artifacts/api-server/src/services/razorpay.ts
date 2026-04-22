// Razorpay integration (Orders API + signature verification + webhooks).
// Falls back to a mock if RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set,
// so the dev workflow keeps running.

import crypto from "node:crypto";

const KEY_ID = process.env["RAZORPAY_KEY_ID"];
const KEY_SECRET = process.env["RAZORPAY_KEY_SECRET"];
const WEBHOOK_SECRET = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "demo-secret-rotate-me";

export const isRazorpayLive = Boolean(KEY_ID && KEY_SECRET);
export const RAZORPAY_PUBLIC_KEY_ID = KEY_ID ?? null;

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  status: string;
}

/** Create a Razorpay Order. The frontend uses this id to launch checkout. */
export async function createOrder(opts: {
  amountPaise: bigint;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayLive) {
    return {
      id: `order_mock_${crypto.randomBytes(8).toString("hex")}`,
      amount: Number(opts.amountPaise),
      currency: "INR",
      status: "created",
    };
  }
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Number(opts.amountPaise),
      currency: "INR",
      receipt: opts.receipt,
      notes: opts.notes ?? {},
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Razorpay order create failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as RazorpayOrder;
  return data;
}

/**
 * Verify the signature returned by Razorpay Checkout JS after a successful
 * payment. The signature is HMAC-SHA256(order_id|payment_id, key_secret).
 */
export function verifyCheckoutSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(opts.signature));
  } catch {
    return false;
  }
}

/** Verify a Razorpay webhook signature (header `x-razorpay-signature`). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Fetch payment details from Razorpay (used as the source of truth on confirm). */
export async function fetchPayment(paymentId: string): Promise<{
  status: string;
  amount: number;
  method?: string;
  card?: { last4?: string };
} | null> {
  if (!isRazorpayLive) return { status: "captured", amount: 0 };
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as never;
}
