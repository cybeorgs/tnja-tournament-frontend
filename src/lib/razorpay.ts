"use client";

/** What the backend returns to start a payment (see Tnja-backend/src/lib/payments.ts). */
export interface CheckoutOrder {
  keyId: string;
  orderId: string;
  /** In paise */
  amount: number;
  currency: string;
  entries: number;
  tournament: string;
  name: string;
  email: string;
  phone: string;
}

/** What Razorpay Checkout hands back after a successful payment; the backend verifies it. */
export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type RazorpayInstance = { open: () => void; on: (event: string, cb: (e: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't load the payment window. Check your internet connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Open Razorpay Checkout for an order. Resolves with the payment to verify, or null when the player
 * closes the window without paying. A failed attempt (e.g. card declined) rejects with Razorpay's reason;
 * the player can try again from the same window first.
 */
export async function payWithRazorpay(order: CheckoutOrder, { orgName, logo }: { orgName: string; logo?: string }): Promise<CheckoutResult | null> {
  await loadCheckout();
  return new Promise((resolve, reject) => {
    let lastError = "";
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: orgName,
      description: `${order.tournament} · ${order.entries} event${order.entries === 1 ? "" : "s"}`,
      image: logo,
      prefill: { name: order.name, email: order.email, contact: order.phone },
      theme: { color: "#ff7400" },
      handler: (res: CheckoutResult) => resolve(res),
      modal: {
        // Closing after a failed attempt reports that failure; otherwise it simply wasn't paid.
        ondismiss: () => (lastError ? reject(new Error(lastError)) : resolve(null)),
        confirm_close: true,
      },
    });
    rzp.on("payment.failed", (e) => {
      lastError = e.error?.description || "The payment failed. No money was taken — please try again.";
    });
    rzp.open();
  });
}
