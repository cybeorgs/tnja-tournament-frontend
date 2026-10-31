"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, IndianRupee, MapPin, Trophy, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useMeta } from "@/lib/hooks";
import { weightClassFor } from "@/lib/categories";
import { formatDateRange, rupees, titleCase } from "@/lib/format";
import { openCheckout, type PaymentOrder } from "@/lib/razorpay";
import type { Gender, Tournament } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, cx } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { errorMessage } from "@/components/Toast";

interface Entry { id: string; ageGroup: string; gender: Gender; weightCategory: string; weightKg: number; paymentStatus: "PENDING" | "PAID" | "WAIVED" }
interface CheckResult {
  student: { studentNo: string; fullName: string; gender: Gender };
  genderAllowed: boolean;
  ageGroups: string[];
  entryFee: number;
  entry: Entry | null;
}

export default function EnterPage() {
  return (
    <PublicShell>
      <Suspense fallback={<Spinner />}>
        <EnterFlow />
      </Suspense>
    </PublicShell>
  );
}

function EnterFlow() {
  const params = useSearchParams();
  const { data: tournaments, loading, error } = useApi<Tournament[]>("/public/tournaments");
  const [slug, setSlug] = useState<string | null>(params.get("t"));

  const open = (tournaments ?? []).filter((t) => t.status === "PUBLISHED" && t.registrationOpen);
  const chosen = open.find((t) => t.slug === slug);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Enter a tournament</h1>
        <p className="mt-2 text-slate-500">
          Use your student ID to enter. Your entry is confirmed once the entry fee is paid.{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">No student ID yet? Register first.</Link>
        </p>
      </header>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card><EmptyState title="Could not load tournaments">{error}</EmptyState></Card>
      ) : chosen ? (
        <EntryForm key={chosen.id} tournament={chosen} onBack={() => setSlug(null)} />
      ) : !open.length ? (
        <Card><EmptyState icon={<Trophy size={40} />} title="No tournaments are taking entries right now">Check back later.</EmptyState></Card>
      ) : (
        <div className="space-y-3">
          {open.map((t) => (
            <button key={t.id} onClick={() => setSlug(t.slug)} className="block w-full text-left">
              <Card className="p-5 transition-colors hover:border-brand/40 hover:bg-orange-50/30">
                <TournamentSummary tournament={t} />
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentSummary({ tournament: t }: { tournament: Tournament }) {
  return (
    <>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <Badge color="orange">{titleCase(t.level)}</Badge>
        {t.gender !== "BOTH" && <Badge>{t.gender === "MALE" ? "Boys / men" : "Girls / women"}</Badge>}
      </div>
      <p className="font-bold text-slate-900">{t.title}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
        <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {formatDateRange(t.startDate, t.endDate)}</span>
        <span className="flex items-center gap-1.5"><MapPin size={14} /> {[t.venue, t.city].filter(Boolean).join(", ")}</span>
        <span className="flex items-center gap-1.5"><IndianRupee size={14} /> {t.entryFee > 0 ? rupees(t.entryFee) : "Free"}</span>
      </div>
    </>
  );
}

function EntryForm({ tournament, onBack }: { tournament: Tournament; onBack: () => void }) {
  const meta = useMeta();
  const [studentNo, setStudentNo] = useState("");
  const [dob, setDob] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [ageGroup, setAgeGroup] = useState("");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Entry | null>(null);

  const base = `/public/tournaments/${tournament.slug}/entry`;
  const weightKg = parseFloat(weight) || 0;
  const previewClass = meta && check && ageGroup ? weightClassFor(meta, ageGroup, check.student.gender, weightKg) : "";

  async function identify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await api<CheckResult>(`${base}/check`, { body: { studentNo, dob } });
      setCheck(result);
      setAgeGroup(result.entry?.ageGroup ?? (result.ageGroups.length === 1 ? result.ageGroups[0]! : ""));
      setWeight(result.entry ? String(result.entry.weightKg) : "");
      if (result.entry && result.entry.paymentStatus !== "PENDING") setConfirmed(result.entry);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function enter(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { entry, payment } = await api<{ entry: Entry; payment: PaymentOrder | null }>(base, { body: { studentNo, dob, ageGroup, weightKg } });
      if (!payment) return setConfirmed(entry);
      const paid = await openCheckout(payment, tournament.title, (resp) => api<{ entry: Entry }>(`${base}/${entry.id}/verify`, { body: resp }));
      setConfirmed(paid.entry);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <button onClick={onBack} className="mb-3 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-brand">
          <ArrowLeft size={15} /> All tournaments
        </button>
        <TournamentSummary tournament={tournament} />
      </div>

      <div className="p-5">
        {confirmed && check ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
            <p className="mt-3 text-lg font-bold text-slate-900">{check.student.fullName} is entered</p>
            <p className="mt-1 text-sm text-slate-500">
              {confirmed.ageGroup} · {confirmed.weightCategory}
              {confirmed.paymentStatus === "PAID" && ` · Fee paid`}
            </p>
            <Link href={`/t/${tournament.slug}`} className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">View tournament page</Link>
          </div>
        ) : !check ? (
          <form onSubmit={identify} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student ID">
                <Input value={studentNo} onChange={(e) => setStudentNo(e.target.value.toUpperCase())} placeholder="As shown after registering"className="font-mono uppercase" autoFocus required />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} required />
              </Field>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit" loading={busy} icon={<UserCheck size={16} />} className="w-full sm:w-auto">Continue</Button>
          </form>
        ) : (
          <form onSubmit={enter} className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-800">{check.student.fullName}</p>
                <p className="font-mono text-xs text-slate-500">{check.student.studentNo}</p>
              </div>
              <button type="button" onClick={() => { setCheck(null); setError(""); }} className="text-xs font-semibold text-slate-500 hover:text-brand">Not you?</button>
            </div>

            {!check.genderAllowed ? (
              <ErrorText>This tournament is for {tournament.gender === "MALE" ? "boys / men" : "girls / women"} only.</ErrorText>
            ) : !check.ageGroups.length ? (
              <ErrorText>Your age doesn&apos;t fall in any age group of this tournament ({tournament.ageGroups.join(", ")}).</ErrorText>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Age group">
                    <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required>
                      <option value="">Select…</option>
                      {check.ageGroups.map((g) => <option key={g}>{g}</option>)}
                    </Select>
                  </Field>
                  <Field label="Body weight (kg)" hint={previewClass ? `Weight category ${previewClass}` : undefined}>
                    <Input type="number" inputMode="decimal" min={10} max={250} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} required />
                  </Field>
                </div>
                {check.entry?.paymentStatus === "PENDING" && (
                  <p className="text-sm text-amber-700">You started an entry earlier but the fee wasn&apos;t paid. Pay now to confirm it.</p>
                )}
                {error && <ErrorText>{error}</ErrorText>}
                <Button type="submit" loading={busy} icon={check.entryFee > 0 ? <IndianRupee size={16} /> : <CheckCircle2 size={16} />} className={cx("h-11 w-full sm:w-auto sm:px-8")}>
                  {check.entryFee > 0 ? `Pay ${rupees(check.entryFee)} and enter` : "Confirm entry"}
                </Button>
              </>
            )}
          </form>
        )}
      </div>
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">{children}</p>;
}
