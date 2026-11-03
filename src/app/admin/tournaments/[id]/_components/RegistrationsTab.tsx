"use client";

import { useMemo, useState } from "react";
import { Download, Eye, IndianRupee, Mail, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { api, openPdf } from "@/lib/api";
import { useApi, useNow } from "@/lib/hooks";
import { collectPayment } from "@/lib/razorpay";
import { categoryLabel, formatDateTime, rupees, titleCase } from "@/lib/format";
import { lateEntryFee, registrationPhase, type EmailKind, type Registration, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Spinner } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";
import { EntryModal } from "./EntryModal";

export function RegistrationsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const { data: registrations, loading, error, reload } = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");
  const [editing, setEditing] = useState<Registration | null | "new">(null);
  const [paying, setPaying] = useState<Registration | null>(null);
  const [removing, setRemoving] = useState<Registration | null>(null);
  const [busy, setBusy] = useState(false);
  const phase = registrationPhase(tournament, useNow());
  const canAdd = phase === "OPEN" || phase === "LATE";

  const refresh = () => {
    reload();
    onChange();
  };

  const categories = useMemo(() => [...new Set((registrations ?? []).map(categoryLabel))], [registrations]);
  const filtered = (registrations ?? []).filter(
    (r) => (category === "ALL" || categoryLabel(r) === category) && `${r.student.fullName} ${r.student.club} ${r.student.district}`.toLowerCase().includes(q.toLowerCase()),
  );

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/tournaments/${tournament.id}/registrations/${removing.id}`, { method: "DELETE" });
      toast("Entry removed.");
      setRemoving(null);
      refresh();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  const certificate = (r: Registration, mode: "view" | "download") =>
    openPdf(`/tournaments/${tournament.id}/registrations/${r.id}/certificate`, mode, `${r.student.fullName}_certificate.pdf`).catch((err) => toast(errorMessage(err), false));

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search students" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="lg:w-72">
          <option value="ALL">All categories ({registrations?.length ?? 0})</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Button icon={<Plus size={16} />} onClick={() => setEditing("new")} disabled={!canAdd} title={canAdd ? "" : "Registration isn't open — see the dates in Overview"}>
          {phase === "LATE" ? "Late entry" : "Register student"}
        </Button>
      </div>
      {phase === "LATE" && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          Late registration until {formatDateTime(tournament.startDate)}. New entries are marked late and cost {tournament.entryFee > 0 ? rupees(lateEntryFee(tournament)) : "nothing"}.
        </p>
      )}
      {phase === "NOT_OPEN" && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">Registration opens on {formatDateTime(tournament.registrationOpensAt)}. Change the dates from Overview → Edit.</p>
      )}
      {phase === "CLOSED" && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">Registration is closed — the tournament has started. Payments for existing entries can still be recorded.</p>
      )}

      {loading && !registrations ? (
        <Spinner />
      ) : error ? (
        <EmptyState title="Could not load entries">{error}</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title={registrations?.length ? "No entries match" : "No students registered yet"}>
          {registrations?.length ? "Try a different search." : "Weight class is worked out from each student's weight."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Player</th>
                <th className="px-4 py-2.5">Registered</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Fee</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="align-top hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{r.student.fullName}</p>
                    <p className="text-xs text-slate-500" title="Username (registered email)">{r.student.email}</p>
                    <p className="text-xs text-slate-400">{[r.student.studentNo, r.student.club || r.student.district].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {formatDateTime(r.createdAt)}
                    <p className="mt-1">{r.isLate ? <Badge color="red">Late</Badge> : <Badge color="blue">Regular</Badge>}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {categoryLabel(r)}
                    <p className="text-xs text-slate-400">{r.weightKg} kg</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{r.fee ? rupees(r.fee) : "Free"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setPaying(r)} className="text-left hover:opacity-80" title="Payment details">
                      {r.paymentStatus === "PAID" && <Badge color="green">Paid {rupees(r.amountPaid)}</Badge>}
                      {r.paymentStatus === "PENDING" && <Badge color="orange">Pending</Badge>}
                      {r.paymentStatus === "WAIVED" && <Badge>{r.fee ? "Waived" : "Free"}</Badge>}
                      {r.paymentStatus === "PAID" && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {r.paymentMode === "RAZORPAY" ? "Online" : titleCase(r.paymentMode ?? "")}{r.paidAt ? ` · ${formatDateTime(r.paidAt)}` : ""}
                          {r.razorpayPaymentId && <span className="block font-mono text-[11px] text-slate-400">{r.razorpayPaymentId}</span>}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Edit category" onClick={() => setEditing(r)}><Pencil size={15} /></IconButton>
                      <IconButton label="Payment" onClick={() => setPaying(r)}><IndianRupee size={15} /></IconButton>
                      <IconButton label="View certificate" onClick={() => certificate(r, "view")}><Eye size={15} /></IconButton>
                      <IconButton label="Download certificate" onClick={() => certificate(r, "download")}><Download size={15} /></IconButton>
                      <IconButton label="Remove entry" danger onClick={() => setRemoving(r)}><Trash2 size={15} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EntryModal
          tournament={tournament}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      {paying && (
        <PaymentModal
          tournament={tournament}
          registration={paying}
          onClose={() => setPaying(null)}
          onSaved={() => { setPaying(null); refresh(); }}
        />
      )}

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove entry"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={remove}>Remove</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Remove <strong>{removing?.student.fullName}</strong> from this tournament? The student stays in your master list.
          {removing?.paymentStatus === "PAID" && " Their fee is recorded as paid — refund it separately if needed."}
        </p>
      </Modal>
    </Card>
  );
}

export function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition-colors ${danger ? "text-slate-400 hover:bg-red-50 hover:text-red-600" : "text-slate-400 hover:bg-orange-50 hover:text-brand"}`}
    >
      {children}
    </button>
  );
}

function PaymentModal({ tournament, registration: r, onClose, onSaved }: { tournament: TournamentDetail; registration: Registration; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function manual(status: "PENDING" | "PAID" | "WAIVED", mode?: "CASH" | "UPI") {
    setBusy(status + (mode ?? ""));
    try {
      await api(`/tournaments/${tournament.id}/registrations/${r.id}/payment`, { method: "PATCH", body: { status, mode } });
      toast("Payment updated.");
      onSaved();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  async function email(kind: EmailKind) {
    setBusy(kind);
    try {
      const res = await api<{ sent: number; status: string | null; error: string }>(`/tournaments/${tournament.id}/emails`, { body: { kind, studentId: r.studentId } });
      const message =
        res.status === "FAILED" ? `Email failed: ${res.error}`
        : res.status === "NOT_CONFIGURED" ? "Email isn't set up (SMTP), so it was only written to the server log."
        : res.sent ? "Email sent." : "Nothing to send.";
      toast(message, res.status !== "FAILED");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  async function online() {
    setBusy("ONLINE");
    try {
      await collectPayment(tournament.id, r, tournament.title);
      toast("Payment received.");
      onSaved();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Entry fee — ${r.student.fullName}`}>
      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-4">
        <div>
          <p className="text-xs text-slate-500">{r.isLate ? "Late entry fee" : "Entry fee"}</p>
          <p className="text-xl font-bold text-slate-900">{rupees(r.paymentStatus === "PAID" ? r.amountPaid : r.fee)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Status</p>
          <p className="font-semibold text-slate-800">{r.paymentStatus === "PAID" ? `Paid (${r.paymentMode === "RAZORPAY" ? "online" : r.paymentMode?.toLowerCase()})` : r.paymentStatus === "WAIVED" ? "Waived" : "Pending"}</p>
        </div>
      </div>

      {r.paymentStatus === "PAID" && (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-100 p-4 text-sm">
          <dt className="text-slate-500">Amount paid</dt><dd className="text-right font-semibold text-slate-900">{rupees(r.amountPaid)}</dd>
          <dt className="text-slate-500">Paid on</dt><dd className="text-right text-slate-800">{formatDateTime(r.paidAt)}</dd>
          {r.razorpayPaymentId && (<><dt className="text-slate-500">Transaction ID</dt><dd className="break-all text-right font-mono text-xs text-slate-800">{r.razorpayPaymentId}</dd></>)}
        </dl>
      )}

      {r.paymentStatus !== "PAID" && r.fee > 0 && (
        <>
          <Button className="w-full" loading={busy === "ONLINE"} onClick={online}>Collect online with Razorpay</Button>
          <p className="mb-4 mt-1.5 text-center text-xs text-slate-400">Pay by UPI, card or net banking on this device.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" loading={busy === "PAIDCASH"} onClick={() => manual("PAID", "CASH")}>Paid in cash</Button>
            <Button variant="secondary" loading={busy === "PAIDUPI"} onClick={() => manual("PAID", "UPI")}>Paid by UPI</Button>
          </div>
        </>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {r.paymentStatus !== "WAIVED" && <Button variant="ghost" size="sm" loading={busy === "WAIVED"} onClick={() => manual("WAIVED")}>Waive fee</Button>}
        {r.paymentStatus !== "PENDING" && r.fee > 0 && <Button variant="ghost" size="sm" loading={busy === "PENDING"} onClick={() => manual("PENDING")}>Mark as unpaid</Button>}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Email {r.student.email}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon={<Mail size={14} />} loading={busy === "CONFIRMATION"} onClick={() => email("CONFIRMATION")}>Registration confirmation</Button>
          {r.paymentStatus === "PENDING" && r.fee > 0 && !r.isLate && (
            <Button variant="secondary" size="sm" icon={<Mail size={14} />} loading={busy === "REMINDER"} onClick={() => email("REMINDER")}>Deadline reminder</Button>
          )}
          {r.paymentStatus === "PAID" && r.paymentMode === "RAZORPAY" && (
            <Button variant="secondary" size="sm" icon={<Mail size={14} />} loading={busy === "PAYMENT"} onClick={() => email("PAYMENT")}>Payment receipt</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
