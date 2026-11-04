import { rupees } from "@/lib/format";
import type { PaymentStatus } from "@/lib/types";
import { Badge } from "./ui";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = { PENDING: "Unpaid", PAID: "Paid", WAIVED: "Free" };
const PAYMENT_COLOR = { PENDING: "yellow", PAID: "green", WAIVED: "slate" } as const;

/** "Paid ₹500", "Unpaid ₹500" or "Free". */
export function PaymentBadge({ status, fee, amountPaid }: { status: PaymentStatus; fee: number; amountPaid?: number }) {
  const amount = status === "PAID" ? amountPaid || fee : fee;
  return (
    <Badge color={PAYMENT_COLOR[status]}>
      {PAYMENT_LABEL[status]}
      {status !== "WAIVED" && amount > 0 && ` ${rupees(amount)}`}
    </Badge>
  );
}

type Fees = { entryFee: number; additionalEntryFee?: number };
/** The additional-category fee, never more than the first-category fee. */
export const extraFee = (t: Fees) => Math.min(t.additionalEntryFee ?? t.entryFee, t.entryFee);

/** Fee text for tournament cards and pages: "₹500 first category · ₹200 each additional". */
export function feeLabel(t: Fees) {
  if (t.entryFee <= 0) return "Free entry";
  const extra = extraFee(t);
  if (extra === t.entryFee) return `${rupees(t.entryFee)} per category`;
  return `${rupees(t.entryFee)} first category · ${extra ? `${rupees(extra)} each additional` : "additional categories free"}`;
}

/**
 * What `count` new categories cost a player who already has `alreadyEntered` in the tournament:
 * the first category of the tournament at the full fee, every other one at the additional fee.
 */
export function feeTotal(t: Fees, count: number, alreadyEntered = 0) {
  if (count <= 0 || t.entryFee <= 0) return { total: 0, full: 0, extra: 0 };
  const full = alreadyEntered > 0 ? 0 : 1;
  const extra = count - full;
  return { total: full * t.entryFee + extra * extraFee(t), full, extra };
}

/** "₹500 + 2 × ₹200 = ₹900" for the categories being entered. */
export function FeeTotal({ fees, count, alreadyEntered = 0 }: { fees: Fees; count: number; alreadyEntered?: number }) {
  if (fees.entryFee <= 0) return null;
  const { total, full, extra } = feeTotal(fees, count, alreadyEntered);
  const parts = [full ? rupees(fees.entryFee) : "", extra ? `${extra > 1 ? `${extra} × ` : ""}${rupees(extraFee(fees))}` : ""].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-orange-200 bg-brand-soft/70 px-4 py-3 text-sm">
      <span className="text-slate-700">
        <span className="font-semibold text-slate-900">Entry fee</span> · {feeLabel(fees)}
        {alreadyEntered > 0 && extraFee(fees) < fees.entryFee && <span className="block text-xs text-slate-500">You&apos;re already entered, so each new category is charged the additional fee.</span>}
      </span>
      {count > 0 && (
        <span className="text-right">
          {parts.length > 1 || extra > 1 ? <span className="mr-1.5 text-xs text-slate-500">{parts.join(" + ")} =</span> : null}
          <span className="text-base font-bold text-slate-900">{rupees(total)}</span>
        </span>
      )}
    </div>
  );
}
