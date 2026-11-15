"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useApi, useSettings } from "@/lib/hooks";
import { api } from "@/lib/api";
import { errorMessage, useToast } from "@/components/Toast";
import { formatDateTime, rupees } from "@/lib/format";
import { Button, Card, Field, Modal, Select, Textarea } from "@/components/ui";

interface SyncResult { payments: number; recorded: number; alreadyRecorded: number; review: number; notOurs: number; errors: number; problems: string[] }
interface ReviewOrder {
  orderId: string;
  paymentId: string | null;
  amount: number;
  paidAt: string | null;
  note: string;
  updatedAt: string;
  student: { id: string; studentNo: string | null; fullName: string; phone: string; email: string } | null;
  tournament: string;
}

/**
 * Online payments: re-check Razorpay for payments that didn't update (a closed tab, a dropped connection),
 * and list paid orders that need an admin (an entry removed or already paid meanwhile, an amount mismatch).
 */
export function RazorpaySync({ onSynced }: { onSynced: () => void }) {
  const toast = useToast();
  const { data: settings } = useSettings();
  const { data: review, reload: reloadReview } = useApi<{ items: ReviewOrder[] }>(settings?.onlinePayment ? "/payments/razorpay/review" : null);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resolving, setResolving] = useState<ReviewOrder | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveError, setResolveError] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);

  if (!settings?.onlinePayment) return null;

  async function sync() {
    setBusy(true);
    try {
      const r = await api<SyncResult>("/payments/razorpay/sync", { body: { days: Number(days) } });
      setResult(r);
      toast(r.recorded ? `${r.recorded} payment${r.recorded === 1 ? "" : "s"} recovered and marked paid.` : "Everything is up to date with Razorpay.", !r.errors);
      reloadReview();
      onSynced();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    if (!resolving) return;
    if (resolveNote.trim().length < 3) return setResolveError("Say what was done, e.g. refunded ₹900 on 15 Nov.");
    setResolveBusy(true);
    try {
      await api(`/payments/razorpay/review/${encodeURIComponent(resolving.orderId)}/resolve`, { body: { note: resolveNote.trim() } });
      toast("Marked as resolved.");
      setResolving(null);
      reloadReview();
    } catch (err) {
      setResolveError(errorMessage(err));
    } finally {
      setResolveBusy(false);
    }
  }

  const items = review?.items ?? [];

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-800">Online payments (Razorpay)</p>
            <p className="text-xs text-slate-500">Paid online but still showing unpaid? Sync checks every successful Razorpay payment and marks the right entries paid. Payments also update on their own within a few minutes.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={days} onChange={(e) => setDays(e.target.value)} className="h-10 w-36" aria-label="How far back to check">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
            <Button icon={<RefreshCw size={15} className={busy ? "animate-spin" : undefined} />} loading={busy} onClick={sync}>Sync with Razorpay</Button>
          </div>
        </div>

        {result && (
          <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="flex items-center gap-1.5 font-semibold text-slate-800"><CheckCircle2 size={14} className="text-emerald-600" /> Last sync</p>
            <p className="mt-1">
              {result.payments} successful payments checked · <b className="text-emerald-700">{result.recorded} recovered</b> · {result.alreadyRecorded} already recorded
              {result.review ? <> · <b className="text-amber-700">{result.review} need review</b></> : null}
              {result.notOurs ? <> · {result.notOurs} not from this website</> : null}
              {result.errors ? <> · <b className="text-red-700">{result.errors} couldn&apos;t be checked</b></> : null}
            </p>
            {result.problems.length > 0 && <ul className="mt-1 list-disc pl-5 text-red-700">{result.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60">
            <p className="flex items-center gap-1.5 border-b border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-900">
              <AlertTriangle size={15} /> {items.length} paid order{items.length === 1 ? "" : "s"} need{items.length === 1 ? "s" : ""} review
            </p>
            <ul className="divide-y divide-amber-100">
              {items.map((o) => (
                <li key={o.orderId} className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {o.student?.fullName ?? "Unknown player"} {o.student?.studentNo && <span className="font-mono text-xs text-brand">{o.student.studentNo}</span>} · {rupees(o.amount)}
                    </p>
                    <p className="text-slate-500">{o.tournament} · {[o.student?.phone, o.student?.email].filter(Boolean).join(" · ")}</p>
                    <p className="font-mono text-[11px] text-slate-400">{o.paymentId ?? "no payment"} · {o.orderId}{o.paidAt ? ` · paid ${formatDateTime(o.paidAt)}` : ""}</p>
                    <p className="mt-1 text-amber-900 [overflow-wrap:anywhere]">{o.note}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="shrink-0" onClick={() => { setResolveNote(""); setResolveError(""); setResolving(o); }}>Mark resolved</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title="Mark as resolved"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)}>Cancel</Button>
            <Button loading={resolveBusy} onClick={resolve}>Mark resolved</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <b>{resolving?.student?.fullName}</b> · {resolving && rupees(resolving.amount)} · <span className="font-mono text-xs">{resolving?.paymentId}</span>
        </p>
        <p className="mt-2 text-xs text-amber-800">{resolving?.note}</p>
        <div className="mt-4">
          <Field label="What was done" required error={resolveError || undefined}>
            <Textarea
              rows={3}
              maxLength={500}
              value={resolveNote}
              placeholder="e.g. Refunded ₹900 from the Razorpay dashboard on 15 Nov, or marked the entry paid by hand"
              onChange={(e) => { setResolveNote(e.target.value); setResolveError(""); }}
            />
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-500">Refunds are made in the Razorpay dashboard; this only records that it was sorted out.</p>
      </Modal>
    </>
  );
}
