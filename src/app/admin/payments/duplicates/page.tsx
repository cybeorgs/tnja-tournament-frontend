"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Search, Trash2 } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { errorMessage, useToast } from "@/components/Toast";
import { formatDate, formatDateTime, rupees } from "@/lib/format";
import type { TournamentListItem } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { PaymentsTabs } from "../_components/PaymentsTabs";

interface DupEntry {
  id: string; name: string; ageGroup: string; weightCategory: string; fee: number;
  paymentStatus: "PENDING" | "PAID" | "WAIVED"; paymentMode: string | null; amountPaid: number; enteredAt: string;
}
interface DupRecord {
  student: { id: string; studentNo: string | null; fullName: string; dob: string; phone: string; email: string; district: string; aadhaarLast4: string | null; registeredAt: string };
  entries: DupEntry[];
}
interface DupGroup { matchedOn: string[]; anyPaid: boolean; unpaidCount: number; unpaidTotal: number; records: DupRecord[] }

const MODE_LABEL: Record<string, string> = { RAZORPAY: "Online", CASH: "Cash", UPI: "UPI", OTHER: "Other" };

/**
 * Payments → Duplicates: people who filled the registration form more than once and so have a second
 * student ID with unpaid entries. Lists them side by side; an unpaid duplicate entry can be removed
 * (logged in the audit trail). Nothing is removed automatically.
 */
export default function DuplicatesPage() {
  const toast = useToast();
  const { data: tournaments } = useApi<TournamentListItem[]>("/tournaments");
  const [tournamentId, setTournamentId] = useState("");
  const { data, loading, error, reload } = useApi<{ items: DupGroup[] }>(tournamentId ? `/payments/duplicates?tournamentId=${tournamentId}` : null);
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<{ entry: DupEntry; record: DupRecord } | null>(null);
  const [reason, setReason] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = data?.items ?? [];
    if (!needle) return all;
    return all.filter((g) => g.records.some((r) => [r.student.fullName, r.student.studentNo ?? "", r.student.phone, r.student.email].some((v) => v.toLowerCase().includes(needle))));
  }, [data, q]);
  const unpaidTotal = groups.reduce((n, g) => n + g.unpaidTotal, 0);

  function askRemove(entry: DupEntry, record: DupRecord) {
    setReason("Duplicate registration — the same person is registered under another student ID");
    setRemoveError("");
    setRemoving({ entry, record });
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await api(`/tournaments/${tournamentId}/registrations/${removing.entry.id}`, { method: "DELETE", body: { reason: reason.trim() } });
      toast(`Removed ${removing.entry.name} for ${removing.record.student.fullName}.`);
      setRemoving(null);
      reload();
    } catch (err) {
      setRemoveError(errorMessage(err));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Payments" subtitle="Find people who registered more than once and have unpaid duplicate entries." />
      <PaymentsTabs />

      <Card className="mb-4 p-4 sm:p-5">
        <Field label="Tournament" hint="Players registered under more than one student ID, with an unpaid entry, are listed below">
          <Select value={tournamentId} onChange={(e) => { setTournamentId(e.target.value); setQ(""); }} className="sm:max-w-md">
            <option value="">Choose a tournament</option>
            {tournaments?.map((t) => <option key={t.id} value={t.id}>{t.title} · {formatDate(t.startDate)}</option>)}
          </Select>
        </Field>
      </Card>

      {!tournamentId ? (
        <Card><EmptyState icon={<Copy size={40} />} title="Choose a tournament">Then check the people who registered more than once.</EmptyState></Card>
      ) : loading && !data ? (
        <Card><div className="flex justify-center py-14"><Spinner /></div></Card>
      ) : error ? (
        <Card><p className="px-5 py-8 text-center text-sm text-red-700">{error}</p></Card>
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                <b className="text-slate-900">{groups.length}</b> {groups.length === 1 ? "person" : "people"} registered more than once ·{" "}
                <b className="text-amber-700">{rupees(unpaidTotal)}</b> shown as unpaid on the duplicates
              </p>
              <div className="relative sm:w-72">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, mobile, email" className="pl-9" />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Matched when two student IDs have the same date of birth and the same name (ignoring dots, spaces and initials) or the same mobile.
              Check before removing. Brothers or sisters (twins) can share a mobile and a date of birth.
            </p>
          </Card>

          {groups.length === 0 ? (
            <Card><EmptyState icon={<Copy size={40} />} title="No duplicates found">Nobody in this tournament has an unpaid entry under a second student ID.</EmptyState></Card>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => {
                const twinRisk = !g.matchedOn.includes("name");
                return (
                  <Card key={g.records.map((r) => r.student.id).join()} className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-slate-800">{g.records.length} student IDs</span>
                      <span className="text-slate-500">· same {g.matchedOn.join(" + ")}</span>
                      {g.anyPaid && <Badge color="green">Paid under another ID</Badge>}
                      {twinRisk && <Badge color="yellow"><AlertTriangle size={11} /> Names differ: could be twins, check</Badge>}
                      <span className="ml-auto font-semibold text-amber-700">{rupees(g.unpaidTotal)} unpaid</span>
                    </div>
                    <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                      {g.records.map((r) => (
                        <div key={r.student.id} className="min-w-0 p-4">
                          <p className="text-sm font-semibold text-slate-900">
                            {r.student.fullName} {r.student.studentNo ? <span className="font-mono text-xs text-brand">{r.student.studentNo}</span> : <span className="text-xs font-normal text-slate-400">(awaiting approval)</span>}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 [overflow-wrap:anywhere]">
                            DOB {formatDate(r.student.dob)} · {r.student.phone || "no mobile"} · {r.student.email || "no email"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {r.student.district || "—"} · Aadhaar {r.student.aadhaarLast4 ? `…${r.student.aadhaarLast4}` : "not given"} · registered {formatDateTime(r.student.registeredAt)}
                          </p>
                          <ul className="mt-3 space-y-2">
                            {r.entries.map((e) => (
                              <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-xs">
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800">{e.name}</p>
                                  <p className="text-slate-400">entered {formatDateTime(e.enteredAt)}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {e.paymentStatus === "PAID" ? (
                                    <Badge color="green">Paid {rupees(e.amountPaid)}{e.paymentMode ? ` · ${MODE_LABEL[e.paymentMode] ?? e.paymentMode}` : ""}</Badge>
                                  ) : e.paymentStatus === "WAIVED" ? (
                                    <Badge color="slate">Free</Badge>
                                  ) : (
                                    <>
                                      <Badge color="red">Unpaid {rupees(e.fee)}</Badge>
                                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => askRemove(e, r)} aria-label={`Remove ${e.name}`}>Remove</Button>
                                    </>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove duplicate entry"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" loading={removeBusy} onClick={remove}>Remove entry</Button>
          </>
        }
      >
        {removing && (
          <>
            <p className="text-sm text-slate-700">
              Remove <b>{removing.entry.name}</b> (unpaid {rupees(removing.entry.fee)}) from <b>{removing.record.student.fullName}</b>{" "}
              {removing.record.student.studentNo && <span className="font-mono text-xs text-brand">{removing.record.student.studentNo}</span>}?
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Only this unpaid entry is removed. The student record and their other entries stay. The removal is kept in the audit log.
            </p>
            <div className="mt-4">
              <Field label="Reason" error={removeError || undefined}>
                <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setRemoveError(""); }} />
              </Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
