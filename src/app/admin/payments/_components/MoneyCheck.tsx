"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/hooks";
import { errorMessage } from "@/components/Toast";
import { formatDateTime, rupees } from "@/lib/format";
import { Button, Card, Select, cx } from "@/components/ui";

interface CheckItem {
  paymentId: string; orderId: string | null; amount: number; refunded: number; method: string; email: string; contact: string;
  paidAt: string; player: string; note: string; entryStillPaidOnline: boolean;
}
interface Bucket { count: number; amount: number; items: CheckItem[] }
interface MoneyCheckResult {
  days: number;
  from: string;
  razorpay: { count: number; collected: number; refunded: number };
  recorded: { count: number; amount: number; entriesAmount: number };
  refunded: Bucket;
  outside: Bucket;
  review: Bucket;
  notLinked: Bucket;
  website: Record<string, { count: number; amount: number }>;
}

const MODES: [string, string][] = [["RAZORPAY", "Online (Razorpay)"], ["CASH", "Cash"], ["UPI", "UPI (by hand)"], ["OTHER", "Other"]];

/**
 * Payments → Money check: why Razorpay's "Collected" and the website's "Collected" differ. Razorpay's total
 * is split into where every payment went; the website's total is split by how it was paid. Read-only.
 */
export function MoneyCheck() {
  const { data: settings } = useSettings();
  const [days, setDays] = useState("90");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [r, setR] = useState<MoneyCheckResult | null>(null);

  async function check() {
    setBusy(true);
    setError("");
    try {
      setR(await api<MoneyCheckResult>(`/payments/razorpay/money-check?days=${days}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!settings?.onlinePayment) return null;

  const refundedButPaid =r?.refunded.items.filter((i) => i.entryStillPaidOnline) ?? [];
  const websiteTotal = r ? Object.values(r.website).reduce((n, m) => n + m.amount, 0) : 0;
  const websiteOnline = r?.website.RAZORPAY?.amount ?? 0;
  const byHand = websiteTotal - websiteOnline;

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-800"><Scale size={16} className="text-brand" /> Money check: Razorpay vs website</p>
          <p className="text-xs text-slate-500">Razorpay&apos;s &ldquo;Collected&rdquo; and this page&apos;s &ldquo;Collected&rdquo; count different things. This shows exactly where the difference comes from. Nothing is changed.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="h-10 w-36" aria-label="Period">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="365">Last 365 days</option>
          </Select>
          <Button variant="secondary" loading={busy} onClick={check}>Check now</Button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {r && (
        <>
          {refundedButPaid.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {refundedButPaid.length} refunded payment{refundedButPaid.length === 1 ? "" : "s"} still show{refundedButPaid.length === 1 ? "s" : ""} the entry as paid online</p>
              <p className="mt-0.5">The money went back to the player, but their entry is still marked paid. Check whether they paid another way; otherwise mark the entry unpaid.</p>
              <ul className="mt-1.5 space-y-0.5">{refundedButPaid.map((i) => <li key={i.paymentId}><b>{i.player || i.email || i.contact}</b> · <span className="font-mono">{i.paymentId}</span> · refunded {rupees(i.refunded)}</li>)}</ul>
            </div>
          )}

          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {/* Razorpay, explained */}
            <div className="rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Razorpay ({r.days} days)</p>
              <div className="divide-y divide-slate-100 text-sm">
                <Row label="Collected in Razorpay" hint={`${r.razorpay.count} payments`} amount={r.razorpay.collected} strong />
                <BucketRow sign="−" label="Refunded to players" bucket={r.refunded} tone="red" />
                <BucketRow sign="−" label="Not from this website" hint="payment links or other forms on the same Razorpay account" bucket={r.outside} tone="slate" />
                <BucketRow sign="−" label="Waiting for review" hint="see the yellow list above" bucket={r.review} tone="amber" />
                <BucketRow sign="−" label="Paid online, not linked to an entry" hint="usually marked paid by hand as cash / UPI; resolve or switch to Online" bucket={r.notLinked} tone="amber" />
                <Row label="= Recorded on the website as Online" hint={`${r.recorded.count} payments`} amount={r.recorded.amount} strong tone="green" />
              </div>
              {r.recorded.entriesAmount !== r.recorded.amount && (
                <p className="border-t border-slate-100 px-4 py-2 text-xs text-amber-800">
                  The entries for these payments add up to {rupees(r.recorded.entriesAmount)} ({rupees(Math.abs(r.recorded.entriesAmount - r.recorded.amount))} {r.recorded.entriesAmount > r.recorded.amount ? "more" : "less"} than Razorpay received).
                </p>
              )}
            </div>

            {/* Website, by mode */}
            <div className="rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Website (entries paid since {formatDateTime(r.from).split(",")[0]})</p>
              <div className="divide-y divide-slate-100 text-sm">
                {MODES.map(([mode, label]) => (
                  <Row key={mode} label={label} hint={`${r.website[mode]?.count ?? 0} entries`} amount={r.website[mode]?.amount ?? 0} tone={mode === "RAZORPAY" ? "green" : undefined} />
                ))}
                <Row label="= Collected on the website" amount={websiteTotal} strong />
              </div>
              <div className="space-y-1 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
                <p><b>Online</b> here should match the green line on the left. Small gaps come from entries paid near the start of the period.</p>
                <p><b>{rupees(byHand)}</b> was taken by hand (cash / UPI / other), so it never went through Razorpay and isn&apos;t in Razorpay&apos;s total.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

const TONE = { green: "text-emerald-700", red: "text-red-700", amber: "text-amber-700", slate: "text-slate-700" } as const;

function Row({ label, hint, amount, strong, tone }: { label: string; hint?: string; amount: number; strong?: boolean; tone?: keyof typeof TONE }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className={cx(strong ? "font-semibold text-slate-900" : "text-slate-700")}>{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <p className={cx("shrink-0 tabular-nums", strong && "font-bold", tone ? TONE[tone] : "text-slate-800")}>{rupees(amount)}</p>
    </div>
  );
}

function BucketRow({ sign, label, hint, bucket, tone }: { sign: string; label: string; hint?: string; bucket: Bucket; tone: keyof typeof TONE }) {
  const [open, setOpen] = useState(false);
  const has = bucket.count > 0;
  return (
    <div>
      <button
        type="button"
        disabled={!has}
        onClick={() => setOpen((o) => !o)}
        className={cx("flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left", has && "hover:bg-slate-50")}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-slate-700">
            {sign} {label} <span className="text-xs text-slate-400">({bucket.count})</span>
            {has && <ChevronDown size={14} className={cx("text-slate-400 transition-transform", open && "rotate-180")} />}
          </p>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
        <p className={cx("shrink-0 tabular-nums", has ? TONE[tone] : "text-slate-400")}>{rupees(bucket.amount)}</p>
      </button>
      {open && (
        <ul className="space-y-1.5 bg-slate-50/70 px-4 py-2.5 text-xs">
          {bucket.items.map((i) => (
            <li key={i.paymentId} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 font-medium text-slate-800 [overflow-wrap:anywhere]">{i.player || [i.email, i.contact].filter(Boolean).join(" · ") || "Unknown payer"}</p>
                <p className="shrink-0 tabular-nums text-slate-700">{i.refunded ? `${rupees(i.refunded)} of ${rupees(i.amount)}` : rupees(i.amount)}</p>
              </div>
              <p className="font-mono text-[11px] text-slate-400 [overflow-wrap:anywhere]">{i.paymentId}{i.orderId ? ` · ${i.orderId}` : ""} · {i.method || "?"} · {formatDateTime(i.paidAt)}</p>
              {i.player && (i.email || i.contact) && <p className="text-slate-500 [overflow-wrap:anywhere]">{[i.email, i.contact].filter(Boolean).join(" · ")}</p>}
              {i.note && <p className="mt-0.5 text-slate-500 [overflow-wrap:anywhere]">{i.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
