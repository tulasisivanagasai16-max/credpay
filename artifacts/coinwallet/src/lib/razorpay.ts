// Lightweight wrapper around Razorpay Checkout JS (loaded in index.html).
// In live mode the backend returns razorpayKeyId + razorpayOrderId; we open the
// Checkout modal and collect the (paymentId, orderId, signature) tuple back.

declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => { open: () => void };
  }
}

export interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

export interface CheckoutResult {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}

export function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string };
}): Promise<CheckoutResult> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay Checkout script failed to load"));
      return;
    }
    const rzp = new window.Razorpay({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: "INR",
      name: opts.name,
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: "#0f5132" },
      handler: (resp) =>
        resolve({
          razorpayPaymentId: resp.razorpay_payment_id,
          razorpayOrderId: resp.razorpay_order_id,
          razorpaySignature: resp.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
    });
    rzp.open();
  });
}
