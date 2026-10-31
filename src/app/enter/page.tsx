"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronRight, IndianRupee, MapPin, Trophy, UserCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useMeta, useSettings } from "@/lib/hooks";
import { weightClassFor } from "@/lib/categories";
import { formatDateRange, rupees, titleCase } from "@/lib/format";
import { openCheckout, type PaymentOrder } from "@/lib/razorpay";
import type { Gender, Tournament } from "@/lib/types";
import { BackLink, Badge, Button, Card, EmptyState, Field, Input, Select, Spinner, cx } from "@/components/ui";
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
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Enter a tournament</h1>
        <p className="mt-2 text-slate-500">
          No student ID yet?{" "}
          <Link href="/register" className="font-semibold text-brand hover:underline">Register first</Link>
        </p>
      </header>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card><EmptyState title="Could not load tournaments">{error}</EmptyState></Card>
      ) : chosen ? (
        <EntryForm key={chosen.id} tournament={chosen} onBack={() => setSlug(null)} />
      ) : !open.length ? (
        <Card><EmptyState icon={<Trophy />} title="No open tournaments">Check back soon.</EmptyState></Card>
      ) : (
        <div className="space-y-3">
          {open.map((t) => (
            <button key={t.id} onClick={() => setSlug(t.slug)} className="group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20">
              <Card className="flex items-center gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-md group-hover:shadow-orange-500/5">
                <div className="min-w-0 flex-1"><TournamentSummary tournament={t} /></div>
                <ChevronRight size={20} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
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
        {t.gender !== "BOTH" && <Badge>{t.gender === "MALE" ? "Boys" : "Girls"}</Badge>}
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
  const { data: settings } = useSettings();
  const idPrefix = settings?.orgShortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ID";
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
    <>
    <BackLink onClick={onBack}>All tournaments</BackLink>
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 bg-gradient-to-br from-brand-soft/80 to-white p-5 sm:p-6">
        <TournamentSummary tournament={tournament} />
      </div>

      <div className="p-5 sm:p-6">
        {confirmed && check ? (
          <div className="py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>
            <p className="mt-4 text-lg font-bold text-slate-900">You&apos;re in, {check.student.fullName}!</p>
            <p className="mt-1 text-sm text-slate-500">
              {confirmed.ageGroup} · {confirmed.weightCategory}
              {confirmed.paymentStatus === "PAID" && " · Paid"}
            </p>
            <Link href={`/t/${tournament.slug}`} className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">View tournament</Link>
          </div>
        ) : !check ? (
          <form onSubmit={identify} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Student ID">
                <Input value={studentNo} onChange={(e) => setStudentNo(e.target.value.toUpperCase())} placeholder={`e.g. ${idPrefix}-S-000001`} className="font-mono uppercase tracking-wide" autoFocus required />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} required />
              </Field>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            <Button type="submit" loading={busy} icon={<UserCheck size={16} />} className="h-11 w-full sm:w-auto sm:px-8">Continue</Button>
          </form>
        ) : (
          <form onSubmit={enter} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {check.student.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{check.student.fullName}</p>
                <p className="font-mono text-xs text-slate-500">{check.student.studentNo}</p>
              </div>
              <button type="button" onClick={() => { setCheck(null); setError(""); }} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-brand">Not you?</button>
            </div>

            {!check.genderAllowed ? (
              <ErrorText>This tournament is for {tournament.gender === "MALE" ? "boys" : "girls"} only.</ErrorText>
            ) : !check.ageGroups.length ? (
              <ErrorText>Your age isn&apos;t in this tournament&apos;s groups ({tournament.ageGroups.join(", ")}).</ErrorText>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Age group">
                    <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required>
                      <option value="">Select</option>
                      {check.ageGroups.map((g) => <option key={g}>{g}</option>)}
                    </Select>
                  </Field>
                  <Field label="Weight" hint={previewClass ? `Category ${previewClass}` : undefined}>
                    <div className="relative">
                      <Input type="number" inputMode="decimal" min={10} max={250} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} required className="pr-12" />
                      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-400">kg</span>
                    </div>
                  </Field>
                </div>
                {check.entry?.paymentStatus === "PENDING" && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">Your earlier entry isn&apos;t paid yet.</p>
                )}
                {error && <ErrorText>{error}</ErrorText>}
                <Button type="submit" loading={busy} icon={check.entryFee > 0 ? <IndianRupee size={16} /> : <CheckCircle2 size={16} />} className={cx("h-11 w-full sm:w-auto sm:px-8")}>
                  {check.entryFee > 0 ? `Pay ${rupees(check.entryFee)}` : "Confirm entry"}
                </Button>
              </>
            )}
          </form>
        )}
      </div>
    </Card>
    </>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="animate-pop-in rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{children}</p>;
}
