"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock, Loader2, MapPin, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { lookupPincode, type PincodeMatch } from "@/lib/locations";
import type { Tournament } from "@/lib/types";
import { BackLink, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { TournamentPicker, TournamentSummary, useOpenTournaments } from "@/components/OpenTournaments";
import { StudentFields, emptyDocs, emptyStudent, validateDocs, validateStudent, type StudentDocs, type StudentInput } from "@/components/StudentFields";
import { ErrorText, TournamentEntry } from "@/components/TournamentEntry";
import { useEmailOtp } from "@/components/EmailOtpField";
import { useAadhaarDigilocker } from "@/components/AadhaarDigilocker";
import { useSettings } from "@/lib/hooks";
import { errorMessage } from "@/components/Toast";

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
        <RegistrationForm key={chosen.id} tournament={chosen} onBack={() => setSlug(null)} />
      ) : (
        <TournamentPicker tournaments={tournaments} loading={loading} error={error} onPick={(t) => setSlug(t.slug)} />
      )}
    </div>
  );
}

type Step = { kind: "pincode" } | { kind: "details" } | { kind: "categories"; studentNo: string; dob: string } | { kind: "pending"; email: string; newAccount: boolean };

function RegistrationForm({ tournament, onBack }: { tournament: Tournament; onBack: () => void }) {
  const lockGender = tournament.gender === "BOTH" ? undefined : tournament.gender;
  const [step, setStep] = useState<Step>({ kind: "pincode" });
  const [student, setStudent] = useState<StudentInput>({ ...emptyStudent, gender: lockGender ?? "" });
  const [docs, setDocs] = useState<StudentDocs>(emptyDocs);
  const [agreed, setAgreed] = useState(false);
  const emailOtp = useEmailOtp();
  const digilocker = useAadhaarDigilocker();
  // The backend turns DigiLocker verification on only when it has Sandbox credentials.
  const needAadhaarCheck = !!useSettings().data?.aadhaarVerification;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newAccount, setNewAccount] = useState(false);

  /** The pincode decides the rest of the form: Tamil Nadu (BPL question) or elsewhere (proof of nativity). */
  function startWith(match: PincodeMatch) {
    setStudent((s) => ({
      ...s,
      residingPincode: match.pincode,
      outsideTamilNadu: !match.inTamilNadu,
      isBPL: false,
      district: match.district,
      taluk: match.inTamilNadu && match.taluks.length === 1 ? match.taluks[0]! : "",
    }));
    setStep({ kind: "details" });
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    const s: StudentInput = { ...student, gender: student.gender || lockGender || "" };
    const problem =
      validateStudent(s) ??
      validateDocs(s, docs) ??
      (needAadhaarCheck && !digilocker.tokenFor(s.aadhaarNumber, s.residingPincode) ? "Please verify your Aadhaar with DigiLocker." : null) ??
      (!emailOtp.tokenFor(s.email) ? "Please verify your email with the code we send." : null) ??
      (!agreed ? "Please confirm the details are correct." : null);
    setError(problem ?? "");
    if (problem) return;

    setBusy(true);
    try {
      const created = await api<{ status: string; studentNo: string | null; email: string; newAccount: boolean }>("/public/students/register", {
        body: {
          ...s,
          agreedToTerms: true,
          emailVerificationToken: emailOtp.tokenFor(s.email),
          aadhaarVerificationToken: digilocker.tokenFor(s.aadhaarNumber, s.residingPincode) ?? undefined,
          ...(s.outsideTamilNadu ? { nativityProof: docs.nativityProof, nativityProofLabel: docs.nativityProofLabel } : s.isBPL ? { bplProof: docs.bplProof } : {}),
        },
      });
      setNewAccount(created.newAccount);
      setStep(created.studentNo ? { kind: "categories", studentNo: created.studentNo, dob: s.dob } : { kind: "pending", email: created.email, newAccount: created.newAccount });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink onClick={step.kind === "details" ? () => setStep({ kind: "pincode" }) : onBack}>{step.kind === "details" ? "Back" : "All tournaments"}</BackLink>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-soft/80 to-white p-5 sm:p-6">
          <TournamentSummary tournament={tournament} />
        </div>

        <div className="p-5 sm:p-8">
          {step.kind === "pincode" && <PincodeStep onFound={startWith} />}

          {step.kind === "details" && (
            <form onSubmit={register} noValidate>
              <StudentFields value={student} onChange={setStudent} lockGender={lockGender} emailOtp={emailOtp} digilocker={needAadhaarCheck ? digilocker : undefined} docs={docs} onDocsChange={setDocs} />
              {error && <div className="mt-6"><ErrorText>{error}</ErrorText></div>}
              <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                  The details above are correct
                </label>
                <Button type="submit" loading={busy} className="h-12 px-10 text-base">{student.outsideTamilNadu ? "Submit for approval" : "Continue"}</Button>
              </div>
            </form>
          )}

          {step.kind === "categories" && (
            <TournamentEntry
              tournament={tournament}
              studentNo={step.studentNo}
              dob={step.dob}
              banner={
                <div className="animate-pop-in flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Registered! Your student ID is <span className="font-mono font-bold">{step.studentNo}</span>.{" "}
                    {newAccount ? "Your account is ready — check your email to set your password." : "It's been added to your account."}{" "}
                    If you can&apos;t pay now, you can log in and pay later.
                  </span>
                </div>
              }
            />
          )}

          {step.kind === "pending" && (
            <div className="mx-auto max-w-md py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Clock size={34} className="text-amber-500" />
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">Application sent for approval</p>
              <p className="mt-2 text-sm text-slate-500">
                Our team will check the document you uploaded. We&apos;ll email <span className="font-semibold text-slate-700">{step.email}</span> once you&apos;re approved —
                then log in to register for this tournament.
              </p>
              {step.newAccount && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs text-slate-600">
                  <Mail size={14} className="text-brand" /> Check your email to set your password
                </p>
              )}
              <div className="mt-6">
                <Link href="/student/login" className="text-sm font-semibold text-brand hover:underline">Go to student login</Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

/** First question: where does the student live? Tamil Nadu residents and others follow different paths. */
function PincodeStep({ onFound }: { onFound: (m: PincodeMatch) => void }) {
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[1-9]\d{5}$/.test(pincode)) return setError("Enter your 6-digit pincode.");
    setError("");
    setBusy(true);
    try {
      onFound(await lookupPincode(pincode));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm py-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <MapPin size={26} />
      </div>
      <h2 className="mt-4 text-xl font-bold text-slate-900">Where do you live?</h2>
      <p className="mt-1 text-sm text-slate-500">Start with the pincode of where you live or study.</p>
      <Field label="Pincode" className="mt-6 text-left">
        <Input
          autoFocus
          inputMode="numeric"
          placeholder="e.g. 641001"
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          aria-invalid={!!error}
          className="h-12 text-center text-lg tracking-[0.3em]"
        />
      </Field>
      {error && <p className="mt-2 text-left text-xs font-medium text-red-600">{error}</p>}
      <Button type="submit" disabled={pincode.length !== 6 || busy} icon={busy ? <Loader2 size={16} className="animate-spin" /> : undefined} className="mt-5 h-12 w-full text-base">
        Continue {!busy && <ArrowRight size={16} />}
      </Button>
    </form>
  );
}
