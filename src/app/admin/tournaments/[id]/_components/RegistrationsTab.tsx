"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileSpreadsheet, IndianRupee, Pencil, Plus, Ticket, Trash2, Upload, Users } from "lucide-react";
import { api, downloadFile, openPdf } from "@/lib/api";
import { useApi, useNow } from "@/lib/hooks";
import { categoryLabel, formatDateTime, rupees } from "@/lib/format";
import { registrationPhase, type Registration, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Modal, Spinner } from "@/components/ui";
import { TournamentFilters, categoryOptions, distinct, matchesCategory, matchesPlayer, matchesText, tournamentAge, useFilters } from "@/components/TournamentFilters";
import { errorMessage, useToast } from "@/components/Toast";
import { EntryModal } from "./EntryModal";
import { ImportEntriesModal } from "./ImportEntriesModal";
import { PaymentBadge } from "@/components/Payment";

export function RegistrationsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const { data: registrations, loading, error, reload } = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const { filters, setFilters, active } = useFilters();
  const [editing, setEditing] = useState<Registration | null | "new">(null);
  const [removing, setRemoving] = useState<Registration | null>(null);
  const [paying, setPaying] = useState<Registration | null>(null);
  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "OTHER">("CASH");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const phase = registrationPhase(tournament, useNow());
  const canAdd = phase === "OPEN";

  const refresh = () => {
    reload();
    onChange();
  };

  const all = useMemo(() => registrations ?? [], [registrations]);
  const ageOf = (r: Registration) => tournamentAge(r.student.dob, tournament.startDate);
  const options = useMemo(() => {
    // Districts per state, so the district list follows the chosen state.
    const districts: Record<string, string[]> = {};
    for (const r of all) {
      const state = r.student.state.trim();
      if (state) districts[state] = distinct([...(districts[state] ?? []), r.student.district]);
    }
    return {
      ...categoryOptions(filters, all),
      ages: [...new Set(all.map(ageOf))].sort((a, b) => a - b),
      states: distinct(all.map((r) => r.student.state)),
      districts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, filters.gender, filters.ageGroup, tournament.startDate]);
  const filtered = all.filter(
    (r) =>
      matchesCategory(filters, r) &&
      matchesPlayer(filters, { age: ageOf(r), state: r.student.state, district: r.student.district }) &&
      matchesText(filters.q, r.student.fullName, r.student.email, r.student.studentNo, r.student.club, r.student.district, r.student.phone),
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

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile(`/tournaments/${tournament.id}/registrations/export`, `${tournament.slug}_entries.xlsx`);
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setExporting(false);
    }
  }

  /** Students whose entries are all paid (or free): they have a hall ticket. */
  const ticketReady = useMemo(() => {
    const unpaid = new Set(all.filter((r) => r.paymentStatus === "PENDING").map((r) => r.studentId));
    return new Set(all.map((r) => r.studentId).filter((id) => !unpaid.has(id)));
  }, [all]);
  const hallTicket = (r: Registration) =>
    openPdf(`/tournaments/${tournament.id}/hall-tickets/${r.studentId}`, "view", `Hall_ticket_${r.student.fullName}.pdf`).catch((err) => toast(errorMessage(err), false));

  async function setPayment(r: Registration, status: "PAID" | "PENDING") {
    setBusy(true);
    try {
      await api(`/tournaments/${tournament.id}/registrations/${r.id}/payment`, { method: "PATCH", body: { status, mode: payMode } });
      toast(status === "PAID" ? "Payment recorded. The hall ticket is emailed once all of the student's entries are paid." : "Marked unpaid.");
      setPaying(null);
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
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-bold text-slate-800">Entries</p>
        <div className="flex flex-wrap items-center gap-2">
        {all.length > 0 && (
          <Button variant="secondary" icon={<FileSpreadsheet size={16} />} loading={exporting} onClick={exportExcel} title="Every entry with the student's details, category and weigh-in">
            Download Excel
          </Button>
        )}
        <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setImporting(true)} disabled={!canAdd} title={canAdd ? "Enter many students from an Excel file" : "Registration isn't open — see the dates in Overview"}>
          Import
        </Button>
        <Button icon={<Plus size={16} />} onClick={() => setEditing("new")} disabled={!canAdd} title={canAdd ? "" : "Registration isn't open — see the dates in Overview"}>
          Register student
        </Button>
        </div>
      </div>
      {all.length > 0 && (
        <TournamentFilters
          fields={["search", "gender", "ageGroup", "weight", "age", "state", "district"]}
          filters={filters}
          onChange={setFilters}
          options={options}
          total={all.length}
          shown={filtered.length}
          searchPlaceholder="Search name, email, student ID, club or phone"
        />
      )}
      {phase === "NOT_OPEN" && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">Registration opens on {formatDateTime(tournament.registrationOpensAt)}. Change the dates from Overview → Edit.</p>
      )}
      {phase === "CLOSED" && (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">Registration closed on {formatDateTime(tournament.registrationClosesAt)}. There is no late registration.</p>
      )}

      {loading && !registrations ? (
        <Spinner />
      ) : error ? (
        <EmptyState title="Could not load entries">{error}</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title={registrations?.length ? "No entries match" : "No students registered yet"}>
          {registrations?.length ? active ? "Try other filters, or clear them." : "Try a different search." : "Weight class is worked out from each student's weight."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Player</th>
                <th className="px-4 py-2.5">Registered</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Payment</th>
                <th className="px-4 py-2.5">Weigh-in</th>
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
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {categoryLabel(r)}
                    <p className="text-xs text-slate-400">{r.weightKg} kg</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <PaymentBadge status={r.paymentStatus} fee={r.fee} amountPaid={r.amountPaid} />
                    {r.paidAt && <p className="mt-1 text-xs text-slate-400">{formatDateTime(r.paidAt)}</p>}
                    {r.paymentStatus === "PENDING" && (
                      <button onClick={() => { setPayMode("CASH"); setPaying(r); }} className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                        <IndianRupee size={12} /> Record payment
                      </button>
                    )}
                    {r.paymentStatus === "PAID" && r.paymentMode !== "RAZORPAY" && (
                      <button onClick={() => setPayment(r, "PENDING")} disabled={busy} className="mt-1 text-xs font-medium text-slate-400 hover:text-red-600 hover:underline">
                        Undo
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.weighInStatus === "CLEARED" ? <Badge color="green">Cleared{r.weighInKg ? ` · ${r.weighInKg} kg` : ""}</Badge>
                      : r.weighInStatus === "DISQUALIFIED" ? <Badge color="red">Disqualified</Badge>
                      : <Badge>Not weighed</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton label="Edit category" onClick={() => setEditing(r)}><Pencil size={15} /></IconButton>
                      {ticketReady.has(r.studentId) && <IconButton label="Hall ticket" onClick={() => hallTicket(r)}><Ticket size={15} /></IconButton>}
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

      <ImportEntriesModal tournament={tournament} open={importing} onClose={() => setImporting(false)} onImported={refresh} />
      {editing && (
        <EntryModal
          tournament={tournament}
          editing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}

      <Modal
        open={!!paying}
        onClose={() => setPaying(null)}
        title="Record payment"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaying(null)}>Cancel</Button>
            <Button variant="success" loading={busy} onClick={() => paying && setPayment(paying, "PAID")}>Mark paid</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <strong>{paying?.student.fullName}</strong> · {paying && categoryLabel(paying)} · <strong>{paying && rupees(paying.fee)}</strong>
        </p>
        <p className="mb-2 mt-4 text-[13px] font-medium text-slate-700">Paid by</p>
        <div className="flex gap-2">
          {(["CASH", "UPI", "OTHER"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPayMode(m)}
              aria-pressed={payMode === m}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${payMode === m ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : "Other"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">For payments taken outside the website. Once all of this student&apos;s entries are paid, their hall ticket is emailed.</p>
      </Modal>

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
