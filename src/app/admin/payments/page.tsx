"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Clock, IndianRupee, Search } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { categoryLabel, formatDate, formatDateTime, rupees } from "@/lib/format";
import type { Gender, PaymentStatus, TournamentListItem } from "@/lib/types";
import { Button, Card, EmptyState, Input, PageHeader, Select, Spinner, cx } from "@/components/ui";
import { PaymentBadge } from "@/components/Payment";

interface PaymentRow {
  id: string;
  ageGroup: string;
  gender: Gender;
  weightCategory: string;
  fee: number;
  paymentStatus: PaymentStatus;
  paymentMode: string | null;
  amountPaid: number;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  student: { id: string; studentNo: string | null; fullName: string; phone: string; email: string; club: string };
  tournament: { id: string; title: string; startDate: string };
}

interface PaymentList {
  items: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { collected: number; paidCount: number; due: number; unpaidCount: number };
}

const STATUS_TABS: { id: "" | PaymentStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Unpaid" },
  { id: "PAID", label: "Paid" },
];
const MODE_LABEL: Record<string, string> = { RAZORPAY: "Online", CASH: "Cash", UPI: "UPI", OTHER: "Other" };
const modeLabel = (mode: string | null) => (mode ? MODE_LABEL[mode] ?? mode : "");

export default function PaymentsPage() {
  const { data: tournaments } = useApi<TournamentListItem[]>("/tournaments");
  const [tournamentId, setTournamentId] = useState("");
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (tournamentId) params.set("tournamentId", tournamentId);
  if (status) params.set("status", status);
  if (debounced) params.set("q", debounced);
  const { data, loading, error } = useApi<PaymentList>(`/payments?${params}`);

  /** Any filter change goes back to the first page. */
  const filter = (change: () => void) => {
    change();
    setPage(1);
  };
  const s = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Payments" subtitle="Entry fees for tournament registrations." />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<IndianRupee size={18} />} tone="text-emerald-600" label="Collected" value={s ? rupees(s.collected) : "—"} />
        <Stat icon={<CheckCircle2 size={18} />} label="Paid entries" value={s?.paidCount ?? "—"} />
        <Stat icon={<IndianRupee size={18} />} tone="text-amber-600" label="Due" value={s ? rupees(s.due) : "—"} />
        <Stat icon={<Clock size={18} />} label="Unpaid entries" value={s?.unpaidCount ?? "—"} />
      </div>

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex w-full rounded-2xl bg-slate-100 p-1 text-sm sm:inline-flex sm:w-auto">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => filter(() => setStatus(t.id))}
                className={cx("flex-1 rounded-xl px-4 py-2 font-semibold transition-all sm:flex-none", status === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search name, student ID, phone or email" value={q} onChange={(e) => filter(() => setQ(e.target.value))} className="bg-slate-50/60 pl-10 focus:bg-white" />
            </div>
            <Select value={tournamentId} onChange={(e) => filter(() => setTournamentId(e.target.value))} className="sm:w-72">
              <option value="">All tournaments</option>
              {tournaments?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
          </div>
        </div>

        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <EmptyState title="Couldn't load payments">{error}</EmptyState>
        ) : !data?.items.length ? (
          <EmptyState icon={<IndianRupee size={40} />} title="No payments here">
            {debounced || tournamentId || status ? "Try other filters." : "Entries for tournaments with an entry fee show up here."}
          </EmptyState>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="divide-y divide-slate-100 sm:hidden">
              {data.items.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{r.student.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{r.tournament.title}</p>
                      <p className="text-xs text-slate-400">{categoryLabel(r)}</p>
                    </div>
                    <PaymentBadge status={r.paymentStatus} fee={r.fee} amountPaid={r.amountPaid} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    {r.paidAt ? `Paid ${formatDateTime(r.paidAt)}${r.paymentMode ? ` · ${modeLabel(r.paymentMode)}` : ""}` : `Entered ${formatDateTime(r.createdAt)}`}
                  </p>
                </li>
              ))}
            </ul>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Player</th>
                    <th className="px-5 py-3">Tournament</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Payment</th>
                    <th className="px-5 py-3">Paid on</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-brand-soft/40">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-800">{r.student.fullName}</p>
                        <p className="text-xs text-slate-400">{[r.student.studentNo, r.student.phone].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {r.tournament.title}
                        <p className="text-xs text-slate-400">{formatDate(r.tournament.startDate)}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{categoryLabel(r)}</td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <PaymentBadge status={r.paymentStatus} fee={r.fee} amountPaid={r.amountPaid} />
                        {r.paymentMode && <p className="mt-1 text-xs text-slate-400">{modeLabel(r.paymentMode)}</p>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                        {r.paidAt ? formatDateTime(r.paidAt) : "—"}
                        {r.razorpayPaymentId && <p className="font-mono text-[11px] text-slate-400">{r.razorpayPaymentId}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
                <span>Page {page} of {pages} · {data.total} entries</span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-xs font-medium text-slate-600">{label}</span></div>
      <p className={cx("mt-1.5 text-xl font-bold", tone ?? "text-slate-900")}>{value}</p>
    </Card>
  );
}
