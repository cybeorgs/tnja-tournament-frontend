"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, Download, Eye, KeyRound, LogOut, Ticket, Trophy, XCircle } from "lucide-react";
import { PASSWORD_HINT, passwordProblem, studentApi, studentAuth, studentPdf, type MyRegistration, type MyStudent } from "@/lib/studentAuth";
import { formatDate, formatDateRange, rupees, titleCase } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { BackLink, Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner } from "@/components/ui";
import { PaymentBadge } from "@/components/Payment";
import { PayNow } from "@/components/PayNow";
import { findBelt } from "@/lib/belts";
import { PublicShell } from "@/components/PublicShell";
import { TournamentPicker, TournamentSummary, useOpenTournaments } from "@/components/OpenTournaments";
import { TournamentEntry } from "@/components/TournamentEntry";
import { errorMessage, useToast } from "@/components/Toast";

export default function StudentHomePage() {
  const router = useRouter();
  const [me, setMe] = useState<{ email: string; students: MyStudent[] } | null>(null);
  const [error, setError] = useState("");
  const [entering, setEntering] = useState<MyStudent | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const load = useCallback(() => {
    studentApi<{ email: string; students: MyStudent[] }>("/student/me").then(setMe, (err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!studentAuth.getToken()) {
      router.replace("/student/login");
      return;
    }
    load();
  }, [router, load]);

  const logout = () => {
    studentAuth.clear();
    router.replace("/student/login");
  };

  if (entering) {
    return (
      <PublicShell>
        <EnterTournament student={entering} onClose={() => { setEntering(null); load(); }} />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My account</h1>
            {me && <p className="mt-1 text-sm text-slate-500">{me.email}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<KeyRound size={15} />} onClick={() => setChangingPassword(true)}>Change password</Button>
            <Button variant="ghost" icon={<LogOut size={15} />} onClick={logout}>Log out</Button>
          </div>
        </header>

        {error ? (
          <Card><EmptyState title="Couldn't load your account">{error}</EmptyState></Card>
        ) : !me ? (
          <Spinner />
        ) : !me.students.length ? (
          <Card><EmptyState title="No students on this account">Register from the tournament page first.</EmptyState></Card>
        ) : (
          <div className="space-y-4">
            {me.students.map((s) => <StudentCard key={s.id} student={s} onEnter={() => setEntering(s)} onChanged={load} />)}
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          Registering another child? <Link href="/enter" className="font-semibold text-brand hover:underline">Use the same email</Link> — they&apos;ll appear here.
        </p>
      </div>
      {changingPassword && <ChangePassword onClose={() => setChangingPassword(false)} />}
    </PublicShell>
  );
}

function StudentCard({ student: s, onEnter, onChanged }: { student: MyStudent; onEnter: () => void; onChanged: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  // Entries grouped by tournament.
  const byTournament = [...new Map(s.registrations.map((r) => [r.tournament.id, r.tournament])).values()].map((t) => ({
    tournament: t,
    entries: s.registrations.filter((r) => r.tournament.id === t.id),
  }));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white">{s.fullName.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-slate-900">{s.fullName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {s.studentNo && <span className="rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-brand">{s.studentNo}</span>}
            {!s.studentNo && s.tempId && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-700" title="Temporary ID until approval">{s.tempId}</span>}
            <span>Born {formatDate(s.dob)}</span>
          </div>
        </div>
        {s.status === "APPROVED" && <Button icon={<Trophy size={16} />} onClick={onEnter}>Register for a tournament</Button>}
      </div>

      {s.status === "PENDING" && (
        <p className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <Clock size={16} className="mt-0.5 shrink-0" /> Waiting for approval — once your documents are checked we&apos;ll email your registration PDF with your permanent student ID.
        </p>
      )}
      {s.status === "REJECTED" && (
        <p className="flex items-start gap-2 border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" /> Not approved{s.reviewNote ? `: ${s.reviewNote}` : "."} Please contact the organiser.
        </p>
      )}

      {byTournament.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {byTournament.map(({ tournament, entries }) => (
            <TournamentEntries key={tournament.id} student={s} tournament={tournament} entries={entries} onChanged={onChanged} />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
        className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand"
      >
        Registration details
        <ChevronDown size={16} className={showDetails ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {showDetails && <RegistrationDetails student={s} />}
    </Card>
  );
}

const WEIGH_IN = {
  PENDING: { label: "Weigh-in pending", color: "slate" },
  CLEARED: { label: "Weighed in", color: "green" },
  DISQUALIFIED: { label: "Disqualified at weigh-in", color: "red" },
} as const;

/** One tournament's entries (events) for a student: what each one owes, and each event's Tournament Entry Pass once paid. */
function TournamentEntries({ student, tournament, entries, onChanged }: { student: MyStudent; tournament: MyRegistration["tournament"]; entries: MyRegistration[]; onChanged: () => void }) {
  const toast = useToast();
  const due = entries.filter((r) => r.paymentStatus === "PENDING").reduce((n, r) => n + r.fee, 0);
  const canPay = tournament.status !== "COMPLETED" && new Date(tournament.startDate) > new Date();
  const payPath = `/student/students/${student.id}/tournaments/${tournament.id}/pay`;
  const entryPass = (r: MyRegistration, mode: "view" | "download") =>
    studentPdf(`/student/students/${student.id}/entries/${r.id}/entry-pass`, mode, `Entry_Pass_${student.studentNo ?? student.fullName}_${r.ageGroup}_${r.weightCategory}.pdf`).catch((err) => toast(errorMessage(err), false));
  const anyPass = entries.some((r) => r.paymentStatus !== "PENDING");
  return (
    <li className="px-5 py-3 text-sm">
      <div className="min-w-0">
        <Link href={`/t/${tournament.slug}`} className="font-semibold text-slate-800 hover:text-brand">{tournament.title}</Link>
        <p className="text-xs text-slate-500">{formatDateRange(tournament.startDate, tournament.endDate)} · {entries.length} event{entries.length === 1 ? "" : "s"}</p>
      </div>
      <ul className="mt-2 space-y-1.5">
        {entries.map((r) => (
          <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-700">{r.ageGroup} · {r.weightCategory}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge color="green">Registered</Badge>
                <PaymentBadge status={r.paymentStatus} fee={r.fee} amountPaid={r.amountPaid} />
                <Badge color={WEIGH_IN[r.weighInStatus].color}>{WEIGH_IN[r.weighInStatus].label}</Badge>
              </span>
            </div>
            {r.paymentStatus !== "PENDING" && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-2">
                <Ticket size={14} className="shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1 text-xs font-medium text-emerald-800">Tournament Entry Pass ready</span>
                <Button size="sm" variant="secondary" icon={<Eye size={13} />} onClick={() => entryPass(r, "view")}>View</Button>
                <Button size="sm" icon={<Download size={13} />} onClick={() => entryPass(r, "download")}>Download</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {due === 0 ? (
        anyPass && <p className="mt-2 text-xs text-slate-500">Each event has its own Tournament Entry Pass — print each on A4 and bring it to the weigh-in.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3 sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-sm text-amber-900">
            <Ticket size={16} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">Entry fee due: {rupees(due)}</span>
              <span className="block text-xs text-amber-800">{canPay ? "Pay now to get a Tournament Entry Pass for each event by email." : "The tournament has started — please contact the organiser."}</span>
            </span>
          </p>
          {canPay && (
            <PayNow
              size="sm"
              amount={due}
              createOrder={() => studentApi(payPath, { method: "POST" })}
              verify={(result) => studentApi(`${payPath}/verify`, { body: result })}
              onPaid={() => {
                toast("Payment received. Your Tournament Entry Passes have been emailed.");
                onChanged();
              }}
              className="shrink-0"
            />
          )}
        </div>
      )}
    </li>
  );
}

const INSTITUTION = { SCHOOL: "School", COLLEGE: "College", DIPLOMA: "Diploma" } as Record<string, string>;

/** Everything the student registered with (Aadhaar shown masked). */
function RegistrationDetails({ student: s }: { student: MyStudent }) {
  const sections: { title: string; rows: [string, ReactNode][] }[] = [
    {
      title: "Personal",
      rows: [
        ["Full name", s.fullName], ["Father's name", s.fatherName], ["Mother's name", s.motherName], ["Gender", titleCase(s.gender)],
        ["Date of birth", formatDate(s.dob)], ["Blood group", s.bloodGroup], ["Aadhaar", s.aadhaarNumber], ["Nationality", s.nationality],
      ],
    },
    { title: "Contact", rows: [["Mobile", s.phone], ["Parent / emergency contact", s.parentPhone || s.emergencyPhone], ["Email", s.email]] },
    {
      title: "Address",
      rows: [["Address", s.address], ["City", s.city], ["State", s.state], ["Pincode", s.pincode], ["District", s.district], ["Taluk", s.taluk], ["Residing pincode", s.residingPincode]],
    },
    {
      title: "Education & academy",
      rows: [
        [INSTITUTION[s.institutionType] ?? "Institution", s.institutionName], ["Standard / year", s.grade], ["Department", s.degreeDepartment],
        ["Club / academy", s.club], ["Coach", s.coachName], ["Belt", findBelt(s.belt)?.label ?? s.belt],
      ],
    },
  ];

  return (
    <div className="space-y-5 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
      {sections.map((sec) => (
        <div key={sec.title}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{sec.title}</p>
          <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {sec.rows.filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-sm font-medium text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p className="text-xs text-slate-500">Need to correct something? Please contact the organiser.</p>
    </div>
  );
}

function EnterTournament({ student, onClose }: { student: MyStudent; onClose: () => void }) {
  const { tournaments, loading, error } = useOpenTournaments();
  const [chosen, setChosen] = useState<Tournament | null>(null);

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink onClick={chosen ? () => setChosen(null) : onClose}>{chosen ? "All tournaments" : "My account"}</BackLink>
      {chosen ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 bg-gradient-to-br from-brand-soft/80 to-white p-5 sm:p-6">
            <TournamentSummary tournament={chosen} />
          </div>
          <div className="p-5 sm:p-8">
            <TournamentEntry tournament={chosen} studentNo={student.studentNo!} dob={student.dob.slice(0, 10)} />
          </div>
        </Card>
      ) : (
        <TournamentPicker title="Register for a tournament" subtitle={`For ${student.fullName}`} tournaments={tournaments} loading={loading} error={error} onPick={setChosen} />
      )}
    </div>
  );
}

function ChangePassword({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    const problem = !current ? "Enter your current password." : passwordProblem(next) ?? (next === current ? "Choose a new password that's different from the current one." : null);
    if (problem) return toast(problem, false);
    setBusy(true);
    try {
      // Changing the password logs out every other device; keep this one logged in with the new session.
      const { message, token } = await studentApi<{ message: string; token: string }>("/student/change-password", { body: { currentPassword: current, newPassword: next } });
      studentAuth.setToken(token);
      toast(message);
      onClose();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change password"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={() => save()}>Save</Button></>}
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus /></Field>
        <Field label="New password" hint={PASSWORD_HINT}><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
