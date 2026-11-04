"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Circle, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateRange, formatDateTime, rupees, titleCase } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { registrationPhase, type RegistrationPhase, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, Field, Input, Modal } from "@/components/ui";
import { TournamentForm, fromTournament } from "@/components/TournamentForm";
import { feeLabel } from "@/components/Payment";
import { errorMessage, useToast } from "@/components/Toast";

type Tab = "overview" | "students" | "referees" | "draws" | "results" | "publish";

export function OverviewTab({ tournament, onChange, goTo }: { tournament: TournamentDetail; onChange: () => void; goTo: (tab: Tab) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const s = tournament.stats;

  const checklist: { done: boolean; label: string; tab: Tab }[] = [
    { done: s.registrations > 0, label: `Register students (${s.registrations})`, tab: "students" },
    { done: s.referees > 0, label: `Assign referees (${s.referees})`, tab: "referees" },
    { done: s.categories > 0 && s.draws >= s.categories, label: `Generate draws (${s.draws}/${s.categories} categories)`, tab: "draws" },
    { done: s.draws > 0 && s.concludedDraws >= s.draws, label: `Conclude categories (${s.concludedDraws}/${s.draws})`, tab: "results" },
    { done: tournament.resultsPublished, label: "Publish results & certificates", tab: "publish" },
  ];

  async function remove() {
    setDeleting(true);
    try {
      await api(`/tournaments/${tournament.id}`, { method: "DELETE" });
      toast("Tournament deleted.");
      router.replace("/admin/tournaments");
    } catch (err) {
      toast(errorMessage(err), false);
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-800">{editing ? "Edit tournament" : "Tournament details"}</h2>
          {!editing && <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</Button>}
        </div>
        {editing ? (
          <TournamentForm
            initial={fromTournament(tournament)}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              await api(`/tournaments/${tournament.id}`, { method: "PUT", body: data });
              toast("Saved.");
              setEditing(false);
              onChange();
            }}
          />
        ) : (
          <TournamentDetails tournament={tournament} onEditDates={() => setEditing(true)} />
        )}
      </Card>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Registered players", value: s.players, sub: `${s.registrations} entries` },
            { label: "Entries per player", value: s.players ? (s.registrations / s.players).toFixed(1) : "0", sub: "Cadet / Junior / Senior…" },
            { label: "Fees collected", value: rupees(s.amountCollected), sub: `${s.paidEntries} paid entr${s.paidEntries === 1 ? "y" : "ies"}`, tone: s.amountCollected ? "text-emerald-600" : undefined },
            { label: "Fees due", value: rupees(s.amountDue), sub: `${s.unpaidEntries} unpaid entr${s.unpaidEntries === 1 ? "y" : "ies"}`, tone: s.amountDue ? "text-amber-600" : undefined },
            { label: "Weighed in", value: s.weighedIn, sub: `of ${s.registrations} entries`, tone: s.registrations && s.weighedIn === s.registrations ? "text-emerald-600" : undefined },
            { label: "Categories", value: s.categories, sub: `${s.draws} drawn` },
            { label: "Officials", value: s.referees, sub: `${tournament.numberOfMats} mat${tournament.numberOfMats === 1 ? "" : "s"}` },
            { label: "Concluded", value: `${s.concludedDraws}/${s.draws}`, sub: "Categories with results", tone: s.draws && s.concludedDraws === s.draws ? "text-emerald-600" : undefined },
          ].map((x) => (
            <Card key={x.label} className="p-4">
              <p className={`text-lg font-bold ${x.tone ?? "text-slate-900"}`}>{x.value}</p>
              <p className="text-xs font-medium text-slate-600">{x.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{x.sub}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Progress</h2>
          <ul className="space-y-1">
            {checklist.map((c) => (
              <li key={c.label}>
                <button onClick={() => goTo(c.tab)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                  {c.done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <Circle size={18} className="shrink-0 text-slate-300" />}
                  <span className={c.done ? "text-slate-500" : "text-slate-800"}>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-red-100 p-5">
          <h2 className="text-sm font-bold text-red-700">Delete tournament</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">Deletes its entries, draws and results. Students and referees are kept.</p>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>Delete…</Button>
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete tournament"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={deleting} disabled={confirmText.trim() !== tournament.title.trim()} onClick={remove}>Delete for good</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">This cannot be undone. Type the tournament title to confirm:</p>
        <p className="mb-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{tournament.title}</p>
        <Field label="Title">
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}

const GENDER_LABEL = { BOTH: "Boys and girls", MALE: "Boys / men only", FEMALE: "Girls / women only" } as const;
const PHASE_LABEL: Record<RegistrationPhase, string> = { NOT_OPEN: "Not open yet", OPEN: "Open", CLOSED: "Closed" };
const PHASE_COLOR = { NOT_OPEN: "slate", OPEN: "green", CLOSED: "slate" } as const;

/** Read-only view of the tournament (Edit switches to the form), led by the live registration status. */
function TournamentDetails({ tournament: t, onEditDates }: { tournament: TournamentDetail; onEditDates: () => void }) {
  const now = useNow();
  const phase = registrationPhase(t, now);
  const status: Record<RegistrationPhase, string> = {
    NOT_OPEN: `Opens on ${formatDateTime(t.registrationOpensAt)}. ${feeLabel(t.entryFee)}.`,
    OPEN: `${feeLabel(t.entryFee)} until ${formatDateTime(t.registrationClosesAt)}. No late entries after that.`,
    CLOSED: "No new entries.",
  };

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Registration</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <Badge color={PHASE_COLOR[phase]}>{PHASE_LABEL[phase]}</Badge>
            <span className="text-sm text-slate-600">{status[phase]}</span>
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={<CalendarClock size={14} />} onClick={onEditDates} className="self-start sm:self-auto">Change dates</Button>
      </div>

      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Detail label="Tournament title" wide>{t.title}</Detail>
        <Detail label="Venue">{t.venue}</Detail>
        <Detail label="City">{t.city || "—"}</Detail>
        <Detail label="Starts">{formatDateTime(t.startDate)}</Detail>
        <Detail label="Dates">{formatDateRange(t.startDate, t.endDate)}</Detail>
        <Detail label="Registration opens">{formatDateTime(t.registrationOpensAt)}</Detail>
        <Detail label="Registration closes">{formatDateTime(t.registrationClosesAt)}</Detail>
        <Detail label="Entry fee">{feeLabel(t.entryFee)}</Detail>
        <Detail label="Level">{titleCase(t.level)}</Detail>
        <Detail label="Open to">{GENDER_LABEL[t.gender]}</Detail>
        <Detail label="Age groups" wide>
          <span className="flex flex-wrap gap-1.5">{t.ageGroups.map((g) => <Badge key={g} color="orange">{g}</Badge>)}</span>
        </Detail>
        {t.description && <Detail label="Description" wide><span className="whitespace-pre-line">{t.description}</span></Detail>}
      </dl>
    </>
  );
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{children}</dd>
    </div>
  );
}
