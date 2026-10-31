"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, IndianRupee } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/hooks";
import { weightClassFor } from "@/lib/categories";
import { rupees } from "@/lib/format";
import { openCheckout, type PaymentOrder } from "@/lib/razorpay";
import type { Gender, StudentGender, Tournament } from "@/lib/types";
import { BackLink, Button, Card, Field, Input, Select, Spinner } from "@/components/ui";
import { TournamentPicker, TournamentSummary, useOpenTournaments } from "@/components/OpenTournaments";
import { PublicShell } from "@/components/PublicShell";
import { StudentFields, emptyStudent, validateStudent, type StudentInput } from "@/components/StudentFields";
import { useEmailOtp } from "@/components/EmailOtpField";
import { errorMessage } from "@/components/Toast";

interface Entry { id: string; ageGroup: string; gender: Gender; weightCategory: string; weightKg: number; paymentStatus: "PENDING" | "PAID" | "WAIVED" }
interface CheckResult {
  student: { studentNo: string; fullName: string; gender: StudentGender };
  genderAllowed: boolean;
  ageGroups: string[];
  entryFee: number;
  entry: Entry | null;
}

export default function TournamentRegistrationPage() {
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
  const { tournaments, loading, error } = useOpenTournaments();
  const [slug, setSlug] = useState<string | null>(params.get("t"));
  const chosen = tournaments.find((t) => t.slug === slug);

  return (
    <div className="mx-auto max-w-4xl">
      {chosen ? (
        <EntryForm key={chosen.id} tournament={chosen} onBack={() => setSlug(null)} />
      ) : (
        <TournamentPicker
          title="Tournament registration"
          subtitle="Choose a tournament to register for."
          tournaments={tournaments}
          loading={loading}
          error={error}
          onPick={(t) => setSlug(t.slug)}
        />
      )}
    </div>
  );
}

function EntryForm({ tournament, onBack }: { tournament: Tournament; onBack: () => void }) {
  const meta = useMeta();
  const lockGender = tournament.gender === "BOTH" ? undefined : tournament.gender;

  const [studentNo, setStudentNo] = useState("");
  const [dob, setDob] = useState("");
  const [newStudent, setNewStudent] = useState<StudentInput>({ ...emptyStudent, gender: lockGender ?? "" });
  const [agreed, setAgreed] = useState(false);
  const emailOtp = useEmailOtp();

  const [check, setCheck] = useState<CheckResult | null>(null);
  const [ageGroup, setAgeGroup] = useState("");
  const [weight, setWeight] = useState("");
  /** Boys' or girls' categories, for students whose gender is Other */
  const [competeAs, setCompeteAs] = useState<Gender | "">(lockGender ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<Entry | null>(null);

  const base = `/public/tournaments/${tournament.slug}/entry`;
  const weightKg = parseFloat(weight) || 0;
  const isOther = check?.student.gender === "OTHER";
  const catGender: Gender | null = !check ? null : isOther ? lockGender ?? (competeAs || null) : (check.student.gender as Gender);
  const previewClass = meta && catGender && ageGroup ? weightClassFor(meta, ageGroup, catGender, weightKg) : "";

  /** Look the student up for this tournament and move on to choosing the category. */
  async function lookUp(no: string, birth: string) {
    const result = await api<CheckResult>(`${base}/check`, { body: { studentNo: no, dob: birth } });
    setStudentNo(no);
    setDob(birth);
    setCheck(result);
    setAgeGroup(result.entry?.ageGroup ?? (result.ageGroups.length === 1 ? result.ageGroups[0]! : ""));
    setWeight(result.entry ? String(result.entry.weightKg) : "");
    if (result.entry && result.entry.paymentStatus !== "PENDING") setConfirmed(result.entry);
  }

  async function run(task: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await task();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function registerNew(e: FormEvent) {
    e.preventDefault();
    const student = { ...newStudent, gender: lockGender ?? newStudent.gender };
    const problem =
      validateStudent(student) ??
      (!emailOtp.tokenFor(student.email) ? "Please verify your email with the code we send." : null) ??
      (!agreed ? "Please confirm the details are correct." : null);
    if (problem) return setError(problem);

    run(async () => {
      const created = await api<{ studentNo: string }>("/public/students/register", {
        body: { ...student, agreedToTerms: true, emailVerificationToken: emailOtp.tokenFor(student.email) },
      });
      await lookUp(created.studentNo, student.dob);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function enter(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const { entry, payment } = await api<{ entry: Entry; payment: PaymentOrder | null }>(base, { body: { studentNo, dob, ageGroup, weightKg, competeAs: isOther ? catGender : undefined } });
      if (!payment) return setConfirmed(entry);
      const paid = await openCheckout(payment, tournament.title, (resp) => api<{ entry: Entry }>(`${base}/${entry.id}/verify`, { body: resp }));
      setConfirmed(paid.entry);
    });
  }

  return (
    <>
      <BackLink onClick={onBack}>All tournaments</BackLink>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-soft/80 to-white p-5 sm:p-6">
          <TournamentSummary tournament={tournament} />
        </div>

        <div className="p-5 sm:p-8">
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
              <StudentIdNote studentNo={check.student.studentNo} />
              <Link href={`/t/${tournament.slug}`} className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">View tournament</Link>
            </div>
          ) : check ? (
            <form onSubmit={enter} className="mx-auto max-w-2xl space-y-5">
              <div className="animate-pop-in flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>Registered! Your student ID is <span className="font-mono font-bold">{check.student.studentNo}</span>.</span>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {check.student.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-800">{check.student.fullName}</p>
                  <p className="font-mono text-xs text-slate-500">{check.student.studentNo}</p>
                </div>
              </div>

              {!check.genderAllowed ? (
                <ErrorText>This tournament is for {tournament.gender === "MALE" ? "boys" : "girls"} only.</ErrorText>
              ) : !check.ageGroups.length ? (
                <ErrorText>Your age isn&apos;t in this tournament&apos;s groups ({tournament.ageGroups.join(", ")}).</ErrorText>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {isOther && (
                      <Field label="Compete in" required className="sm:col-span-2">
                        <Select value={lockGender ?? competeAs} disabled={!!lockGender} onChange={(e) => setCompeteAs(e.target.value as Gender)} required>
                          <option value="">Select</option>
                          <option value="MALE">Boys&apos; categories</option>
                          <option value="FEMALE">Girls&apos; categories</option>
                        </Select>
                      </Field>
                    )}
                    <Field label="Age group" required>
                      <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required>
                        <option value="">Select</option>
                        {check.ageGroups.map((g) => <option key={g}>{g}</option>)}
                      </Select>
                    </Field>
                    <Field label="Weight" required hint={previewClass ? `Category ${previewClass}` : undefined}>
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
                  <Button type="submit" loading={busy} icon={check.entryFee > 0 ? <IndianRupee size={16} /> : <CheckCircle2 size={16} />} className="h-12 w-full sm:w-auto sm:px-10">
                    {check.entryFee > 0 ? `Pay ${rupees(check.entryFee)} & register` : "Confirm registration"}
                  </Button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={registerNew} noValidate>
              <StudentFields value={newStudent} onChange={setNewStudent} lockGender={lockGender} emailOtp={emailOtp} />
              {error && <div className="mt-6"><ErrorText>{error}</ErrorText></div>}
              <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                  The details above are correct
                </label>
                <Button type="submit" loading={busy} className="h-12 px-10 text-base">Continue</Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </>
  );
}

function StudentIdNote({ studentNo }: { studentNo: string }) {
  return (
    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs text-slate-600">
      Student ID <span className="font-mono font-bold text-brand">{studentNo}</span>
    </p>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="animate-pop-in rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{children}</p>;
}
