"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock, IndianRupee, KeyRound, LogOut, Trophy, XCircle } from "lucide-react";
import { studentApi, studentAuth, type MyRegistration, type MyStudent } from "@/lib/studentAuth";
import { formatDate, formatDateRange, formatDateTime, rupees, titleCase } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { openCheckout, type PaymentOrder } from "@/lib/razorpay";
import type { Tournament } from "@/lib/types";
import { BackLink, Badge, Button, Card, EmptyState, Field, Input, Modal, Spinner } from "@/components/ui";
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
            {me.students.map((s) => <StudentCard key={s.id} student={s} onEnter={() => setEntering(s)} onPaid={load} />)}
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

function StudentCard({ student: s, onEnter, onPaid }: { student: MyStudent; onEnter: () => void; onPaid: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  // Entries grouped by tournament, so each tournament's unpaid fees are paid together.
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
            <span>Born {formatDate(s.dob)}</span>
          </div>
        </div>
        {s.status === "APPROVED" && <Button icon={<Trophy size={16} />} onClick={onEnter}>Register for a tournament</Button>}
      </div>

      {s.status === "PENDING" && (
        <p className="flex items-start gap-2 border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <Clock size={16} className="mt-0.5 shrink-0" /> Waiting for approval — we&apos;ll email you when your documents are checked.
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
            <TournamentEntries key={tournament.id} studentId={s.id} tournament={tournament} entries={entries} onPaid={onPaid} />
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

/** One tournament's entries for a student, with a Pay button for any unpaid fees. */
function TournamentEntries({ studentId, tournament, entries, onPaid }: { studentId: string; tournament: MyRegistration["tournament"]; entries: MyRegistration[]; onPaid: () => void }) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const due = entries.filter((r) => r.paymentStatus === "PENDING").reduce((sum, r) => sum + r.fee, 0);
  // Payments close when the tournament starts (registration closes then too).
  const now = useNow();
  const canPay = due > 0 && tournament.status === "PUBLISHED" && now < new Date(tournament.startDate);

  async function pay() {
    setPaying(true);
    try {
      const base = `/student/tournaments/${tournament.id}/payment`;
      const order = await studentApi<PaymentOrder>(base, { body: { studentId } });
      await openCheckout(order, tournament.title, (resp) => studentApi(`${base}/verify`, { body: resp }));
      toast("Payment received. You're registered!");
      onPaid();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setPaying(false);
    }
  }

  return (
    <li className="px-5 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/t/${tournament.slug}`} className="font-semibold text-slate-800 hover:text-brand">{tournament.title}</Link>
          <p className="text-xs text-slate-500">{formatDateRange(tournament.startDate, tournament.endDate)}</p>
        </div>
        {canPay && <Button size="sm" icon={<IndianRupee size={14} />} loading={paying} onClick={pay}>Pay {rupees(due)}</Button>}
      </div>
      <ul className="mt-2 space-y-1.5">
        {entries.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-slate-700">{r.ageGroup} · {r.weightCategory}</span>
            <span className="flex items-center gap-1.5">
              {r.isLate && <Badge color="red">Late</Badge>}
              {r.paymentStatus === "PENDING" && <Badge color="yellow">Payment pending · {rupees(r.fee)}</Badge>}
              {r.paymentStatus === "PAID" && <Badge color="green">Paid {rupees(r.amountPaid)}</Badge>}
              {r.paymentStatus === "WAIVED" && <Badge color="green">Registered</Badge>}
            </span>
          </li>
        ))}
      </ul>
      {canPay && <p className="mt-2 text-xs text-slate-500">Pay before the tournament starts on {formatDateTime(tournament.startDate)}.</p>}
      {due > 0 && !canPay && <p className="mt-2 text-xs text-amber-700">The tournament has started, so this fee can no longer be paid online. Please contact the organiser.</p>}
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
    { title: "Contact", rows: [["Mobile", s.phone], ["Alternate mobile", s.alternatePhone], ["Email", s.email]] },
    {
      title: "Address",
      rows: [["Address", s.address], ["City", s.city], ["State", s.state], ["Pincode", s.pincode], ["District", s.district], ["Taluk", s.taluk], ["Residing pincode", s.residingPincode]],
    },
    {
      title: "Education & academy",
      rows: [
        [INSTITUTION[s.institutionType] ?? "Institution", s.institutionName], ["Standard / year", s.grade], ["Department", s.degreeDepartment],
        ["Club / academy", s.club], ["Coach", s.coachName], ["Belt", s.belt],
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
    if (next.length < 8) return toast("New password must be at least 8 characters.", false);
    setBusy(true);
    try {
      await studentApi("/student/change-password", { body: { currentPassword: current, newPassword: next } });
      toast("Password changed.");
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
        <Field label="New password" hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
