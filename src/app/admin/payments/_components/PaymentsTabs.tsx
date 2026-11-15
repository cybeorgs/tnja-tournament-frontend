"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Copy, IndianRupee, MailWarning } from "lucide-react";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/admin/payments", label: "Payments", icon: IndianRupee },
  { href: "/admin/payments/unpaid", label: "Unpaid notices", icon: MailWarning },
  { href: "/admin/payments/duplicates", label: "Duplicates", icon: Copy },
];

/** Switches between the payments list and the unpaid-notice section. */
export function PaymentsTabs() {
  const pathname = usePathname();
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(
              "-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              active ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <t.icon size={16} /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
