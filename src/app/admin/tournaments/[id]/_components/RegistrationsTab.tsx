"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileSpreadsheet, IndianRupee, Pencil, Plus, Ticket, Trash2, Upload, UserCog, Users } from "lucide-react";
import { api, downloadFile, openPdf } from "@/lib/api";
import { useApi, useNow } from "@/lib/hooks";
import { categoryLabel, formatDateTime, rupees } from "@/lib/format";
import { registrationPhase, type Registration, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { ALL, TournamentFilters, categoryOptions, distinct, matchesCategory, matchesPlayer, matchesText, tournamentAge, useFilters } from "@/components/TournamentFilters";
import { EntryStats } from "./EntryStats";
import { errorMessage, useToast } from "@/components/Toast";
import { EntryModal } from "./EntryModal";
import { ImportEntriesModal } from "./ImportEntriesModal";
import { EditPlayerModal } from "./EditPlayerModal";
import { PaymentBadge } from "@/components/Payment";

export function RegistrationsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const { data: registrations, loading, error, reload } = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const { filters, setFilters, active } = useFilters();
  const [editing, setEditing] = useState<Registration | null | "new">(null);
  const [removing, setRemoving] = useState<Registration | null>(null);
  /** Editing the player's own details (name, gender, DOB…) */
  const [editingPlayer, setEditingPlayer] = useState<Registration | null>(null);
  const [paying, setPaying] = useState<Registration | null>(null);
  /** Marking a hand-recorded payment unpaid again (asks why) */
  const [undoing, setUndoing] = useState<Registration | null>(null);
  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "OTHER">("CASH");
  /** Why the payment status is being changed; required, kept in the audit log */
  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState("");
  /** Why an entry is removed; optional, kept in the audit log */
  const [removeReason, setRemoveReason] = useState("");
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
  /** How many events (entries) each player has in this tournament */
  const eventCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all) m.set(r.studentId, (m.get(r.studentId) ?? 0) + 1);
    return m;
  }, [all]);
  const eventsOf = (studentId: string) => eventCount.get(studentId) ?? 0;
  /** Show only players with this many events (0: any) */
  const [events, setEvents] = useState(0);
  const filtered = all.filter(
    (r) =>
      (!events || eventsOf(r.studentId) === events) &&
      matchesCategory(filters, r) &&
      matchesPlayer(filters, { age: ageOf(r), state: r.student.state, district: r.student.district }) &&
      matchesText(filters.q, r.student.fullName, r.student.email, r.student.studentNo, r.student.club, r.student.district, r.student.phone),
  );

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/tournaments/${tournament.id}/registrations/${removing.id}`, { method: "DELETE", body: { reason: removeReason.trim() } });
      toast("Entry removed.");
      setRemoving(null);
      refresh();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  /** Unpaid entries in the list as currently filtered (the bulk delete works on these) */
  const unpaid = filtered.filter((r) => r.paymentStatus === "PENDING");
  const unpaidPlayers = new Set(unpaid.map((r) => r.studentId)).size;
  const unpaidTotal = unpaid.reduce((n, r) => n + r.fee, 0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState("");

  async function deleteUnpaid() {
    setBusy(true);
    try {
      const r = await api<{ message: string }>(`/tournaments/${tournament.id}/registrations/delete-unpaid`, { body: { ids: unpaid.map((e) => e.id), reason: bulkReason.trim() } });
      toast(r.message);
      setBulkOpen(false);
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

  /** Each paid (or free) event has its own Tournament Entry Pass, built fresh from the latest details. */
  const entryPass = (r: Registration) =>
    openPdf(`/tournaments/${tournament.id}/registrations/${r.id}/entry-pass`, "download", `Entry_Pass_${r.student.fullName}_${r.ageGroup}.pdf`).catch((err) => toast(errorMessage(err), false));

  /** Open the record-payment or undo dialog with an empty remark. */
  function startPayment(r: Registration, status: "PAID" | "PENDING") {
    setRemark("");
    setRemarkError("");
    if (status === "PAID") {
      setPayMode("CASH");
      setPaying(r);
    } else {
      setUndoing(r);
    }
  }

  async function setPayment(r: Registration, status: "PAID" | "PENDING") {
    const text = remark.trim();
    if (text.length < 3) {
      setRemarkError(status === "PAID" ? "Enter a remark, e.g. the UPI reference or receipt number." : "Enter why this payment is being undone.");
      return;
    }
    setRemarkError("");
    setBusy(true);
    try {
      await api(`/tournaments/${tournament.id}/registrations/${r.id}/payment`, { method: "PATCH", body: { status, mode: payMode, remark: text } });
      toast(status === "PAID" ? "Payment recorded. The Tournament Entry Pass for this event has been emailed." : "Marked unpaid.");
      setPaying(null);
      setUndoing(null);
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
        {unpaid.length > 0 && (
          <Button
            variant="secondary"
            icon={<Trash2 size={16} />}
            onClick={() => { setBulkReason(""); setBulkConfirm(""); setBulkOpen(true); }}
            title={active ? "Delete the unpaid entries in the filtered list" : "Delete every unpaid entry in this tournament"}
          >
            Delete unpaid ({unpaid.length})
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
        <EntryStats
          entries={all.filter((r) => filters.gender === ALL || r.gender === filters.gender)}
          eventsOf={eventsOf}
          ageGroup={filters.ageGroup === ALL ? "" : filters.ageGroup}
          events={events}
          onAgeGroup={(g) => setFilters({ ...filters, ageGroup: g || ALL, weight: ALL })}
          onEvents={setEvents}
        />
      )}
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
                    <p className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                      {r.student.fullName}
                      {eventsOf(r.studentId) > 1 && (
                        <span title={all.filter((e) => e.studentId === r.studentId).map((e) => e.ageGroup).join(" + ")}>
                          <Badge color="blue">{eventsOf(r.studentId)} events</Badge>
                        </span>
                      )}
                    </p>
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
                      <button onClick={() => startPayment(r, "PAID")} className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                        <IndianRupee size={12} /> Record payment
                      </button>
                    )}
                    {r.paymentStatus === "PAID" && r.paymentMode !== "RAZORPAY" && (
                      <button onClick={() => startPayment(r, "PENDING")} disabled={busy} className="mt-1 text-xs font-medium text-slate-400 hover:text-red-600 hover:underline">
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
                      <IconButton label="Edit player details (name, gender, date of birth…)" onClick={() => setEditingPlayer(r)}><UserCog size={15} /></IconButton>
                      <IconButton label="Edit category" onClick={() => setEditing(r)}><Pencil size={15} /></IconButton>
                      {r.paymentStatus !== "PENDING" && <IconButton label="Download Tournament Entry Pass (latest details)" onClick={() => entryPass(r)}><Ticket size={15} /></IconButton>}
                      <IconButton label="View certificate" onClick={() => certificate(r, "view")}><Eye size={15} /></IconButton>
                      <IconButton label="Download certificate" onClick={() => certificate(r, "download")}><Download size={15} /></IconButton>
                      <IconButton label="Remove entry" danger onClick={() => { setRemoveReason(""); setRemoving(r); }}><Trash2 size={15} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ImportEntriesModal tournament={tournament} open={importing} onClose={() => setImporting(false)} onImported={refresh} />
      {editingPlayer && (
        <EditPlayerModal tournamentId={tournament.id} entry={editingPlayer} onClose={() => setEditingPlayer(null)} onSaved={refresh} />
      )}
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
        <RemarkField
          label="Remark"
          placeholder="e.g. UPI ref 4321 5678 9012, or cash receipt no. 118"
          value={remark}
          error={remarkError}
          onChange={(v) => { setRemark(v); if (remarkError) setRemarkError(""); }}
        />
        <p className="mt-3 text-xs text-slate-500">For payments taken outside the website. The remark is saved in the audit log, and the Tournament Entry Pass for this event is emailed to the student.</p>
      </Modal>

      <Modal
        open={!!undoing}
        onClose={() => setUndoing(null)}
        title="Mark as unpaid"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUndoing(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => undoing && setPayment(undoing, "PENDING")}>Mark unpaid</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          <strong>{undoing?.student.fullName}</strong> · {undoing && categoryLabel(undoing)} · paid <strong>{undoing && rupees(undoing.amountPaid)}</strong>
        </p>
        <RemarkField
          label="Reason"
          placeholder="e.g. Recorded by mistake, or the UPI payment failed"
          value={remark}
          error={remarkError}
          onChange={(v) => { setRemark(v); if (remarkError) setRemarkError(""); }}
        />
        <p className="mt-3 text-xs text-slate-500">The entry goes back to unpaid. The reason is saved in the audit log.</p>
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
        <RemarkField
          label="Reason (optional)"
          placeholder="e.g. Fee not paid by the deadline"
          value={removeReason}
          onChange={setRemoveReason}
        />
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Delete unpaid entries"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={busy} disabled={bulkConfirm.trim().toUpperCase() !== "DELETE"} onClick={deleteUnpaid}>
              Delete {unpaid.length} entr{unpaid.length === 1 ? "y" : "ies"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-red-50 px-2 py-3"><p className="text-xl font-bold text-red-700">{unpaid.length}</p><p className="text-xs text-red-800">unpaid entries</p></div>
            <div className="rounded-xl bg-slate-50 px-2 py-3"><p className="text-xl font-bold text-slate-800">{unpaidPlayers}</p><p className="text-xs text-slate-500">players</p></div>
            <div className="rounded-xl bg-slate-50 px-2 py-3"><p className="text-xl font-bold text-slate-800">{rupees(unpaidTotal)}</p><p className="text-xs text-slate-500">fees not paid</p></div>
          </div>
          {active
            ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Only the unpaid entries matching your <b>filters</b> are deleted. Clear the filters to delete every unpaid entry in this tournament.</p>
            : <p>Every unpaid entry in <b>{tournament.title}</b> is deleted.</p>}
          <ul className="list-disc space-y-0.5 pl-5 text-xs">
            <li>Paid and free entries are never touched.</li>
            <li>The players stay in the Students list, and can register again while registration is open.</li>
            <li>Kept automatically: entries already in a draw, and entries the player is paying for right now.</li>
            <li>Each deletion is written to the player&apos;s history.</li>
          </ul>
          <RemarkField label="Reason (optional)" placeholder="e.g. Fee not paid by the deadline" value={bulkReason} onChange={setBulkReason} />
          <Field label='Type DELETE to confirm'>
            <Input value={bulkConfirm} onChange={(e) => setBulkConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

/** A short remark box (saved in the audit log with the change). */
function RemarkField({ label, placeholder, value, error, onChange }: { label: string; placeholder: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-4">
      <Field label={label} required={!label.includes("optional")} error={error || undefined}>
        <Textarea
          value={value}
          maxLength={500}
          rows={3}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-20"
        />
      </Field>
      <p className="mt-1 text-right text-[11px] text-slate-400">{value.length}/500</p>
    </div>
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
