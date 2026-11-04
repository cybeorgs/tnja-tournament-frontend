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

/** Fee text for tournament cards and pages. */
export const feeLabel = (entryFee: number) => (entryFee > 0 ? `${rupees(entryFee)} per entry` : "Free entry");
