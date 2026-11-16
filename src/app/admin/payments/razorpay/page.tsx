"use client";

import { CreditCard } from "lucide-react";
import { useSettings } from "@/lib/hooks";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PaymentsTabs } from "../_components/PaymentsTabs";
import { RazorpaySync } from "../_components/RazorpaySync";
import { MoneyCheck } from "../_components/MoneyCheck";

/**
 * Payments → Razorpay: sync online payments (and the paid orders that need review), and the money check
 * that explains Razorpay's collected total against the website.
 */
export default function RazorpayPage() {
  const { data: settings } = useSettings();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Payments" subtitle="Online payments through Razorpay: sync, review and money check." />
      <PaymentsTabs />
      {settings && !settings.onlinePayment ? (
        <Card><EmptyState icon={<CreditCard size={40} />} title="Online payment isn't set up">Add the Razorpay keys on the server to take entry fees online.</EmptyState></Card>
      ) : (
        <>
          <RazorpaySync onSynced={() => {}} />
          <MoneyCheck />
        </>
      )}
    </div>
  );
}
