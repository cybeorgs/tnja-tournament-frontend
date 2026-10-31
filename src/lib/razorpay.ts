"use client";

import { api } from "./api";
import type { Registration } from "./types";

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface PaymentOrder {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  phone?: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (resp: { error: { description: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay. Check the internet connection."));
    document.body.appendChild(script);
  });
}

/** Open Razorpay Checkout for an order; `verify` sends the signed response to the backend. */
export async function openCheckout<T>(order: PaymentOrder, title: string, verify: (resp: RazorpayResponse) => Promise<T>): Promise<T> {
  await loadScript();
  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: title,
      description: `Entry fee — ${order.name}`,
      prefill: { name: order.name, contact: order.phone || undefined },
      theme: { color: "#ff7400" },
      handler: (resp: RazorpayResponse) => {
        verify(resp).then(resolve, reject);
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    checkout.on("payment.failed", (resp) => reject(new Error(resp.error.description || "Payment failed.")));
    checkout.open();
  });
}

/** Collect an entry fee from the admin side; resolves with the updated registration once verified. */
export async function collectPayment(tournamentId: string, reg: Registration, description: string): Promise<Registration> {
  const base = `/tournaments/${tournamentId}/registrations/${reg.id}/payment`;
  const order = await api<PaymentOrder>(`${base}/order`, { body: {} });
  return openCheckout(order, description, (resp) => api<Registration>(`${base}/verify`, { body: resp }));
}
