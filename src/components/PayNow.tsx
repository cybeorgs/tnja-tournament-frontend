"use client";

import { useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { useSettings } from "@/lib/hooks";
import { rupees } from "@/lib/format";
import { payWithRazorpay, type CheckoutOrder, type CheckoutResult } from "@/lib/razorpay";
import { brandLogo } from "./Brand";
import { Button, cx } from "./ui";
import { errorMessage } from "./Toast";

/**
 * "Pay ₹X" for a student's unpaid entries in one tournament. The two steps go to whichever API the
 * caller uses (pay token right after registering, or the student login), so the button is the same.
 */
export function PayNow({ amount, createOrder, verify, onPaid, className, size = "lg" }: {
  /** Rupees, for the button label (the server works out the real amount) */
  amount: number;
  createOrder: () => Promise<{ order: CheckoutOrder | null }>;
  verify: (result: CheckoutResult) => Promise<unknown>;
  /** After the payment is verified, or when it turns out nothing was left to pay */
  onPaid: () => void;
  className?: string;
  size?: "lg" | "sm";
}) {
  const { data: settings } = useSettings();
  const [step, setStep] = useState<"idle" | "opening" | "verifying">("idle");
  const [error, setError] = useState("");

  if (settings && !settings.onlinePayment) {
    return <p className={cx("text-xs text-slate-500", className)}>Online payment isn&apos;t available right now. Please pay the organiser directly.</p>;
  }

  async function pay() {
    setError("");
    setStep("opening");
    try {
      const { order } = await createOrder();
      if (!order) return onPaid(); // an earlier payment went through
      const result = await payWithRazorpay(order, { orgName: settings?.orgShortName || "Entry fee", logo: settings ? new URL(brandLogo(settings), window.location.href).href : undefined });
      if (!result) return; // closed without paying
      setStep("verifying");
      await verify(result);
      onPaid();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStep("idle");
    }
  }

  return (
    <div className={className}>
      <Button
        onClick={pay}
        loading={step !== "idle"}
        icon={<CreditCard size={size === "lg" ? 18 : 14} />}
        size={size === "sm" ? "sm" : "md"}
        className={size === "lg" ? "h-12 w-full text-base" : undefined}
      >
        {step === "verifying" ? "Confirming payment…" : `Pay ${rupees(amount)}`}
      </Button>
      {size === "lg" && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Lock size={11} /> Secure payment by Razorpay · UPI, cards, net banking
        </p>
      )}
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
