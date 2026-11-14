"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock, Loader2, MapPin, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { lookupPincode, pincodeProblem, type PincodeMatch } from "@/lib/locations";
import { PARTICIPANT_TYPE_LABEL, type ParticipantType, type Tournament } from "@/lib/types";
import { BackLink, Button, Card, Field, Input, Spinner, cx } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { TournamentPicker, TournamentSummary, useOpenTournaments } from "@/components/OpenTournaments";
import { StudentFields, emptyDocs, emptyStudent, validateDocs, validateStudent, type StudentDocs, type StudentInput } from "@/components/StudentFields";
import { EntryDone, ErrorText, EventsPicker, emptyEvents, eventsProblem, type Entry, type EventsValue } from "@/components/TournamentEntry";
import { FeeTotal } from "@/components/Payment";
import { useEmailOtp } from "@/components/EmailOtpField";
import { useMeta } from "@/lib/hooks";
import { competitionAge, eligibleAgeGroups } from "@/lib/categories";
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

type Step =
  | { kind: "pincode" }
  | { kind: "details" }
  | { kind: "done"; studentNo: string; name: string; email: string; entries: Entry[]; newAccount: boolean; payToken: string | null; loginEmail: LoginEmail }
  | { kind: "pending"; email: string; tempId: string; newAccount: boolean; loginEmail: LoginEmail };

/** Whether the username/password email went out (the backend sends it before replying). */
/** QUEUED: today's email limit was reached; the office sends it shortly (nothing is lost). */
type LoginEmail = "SENT" | "FAILED" | "NOT_CONFIGURED" | "QUEUED";

/** Where the login details went, or what to do when the email couldn't be sent. */
function LoginEmailNote({ status, email, newAccount, withPdf }: { status: LoginEmail; email: string; newAccount: boolean; withPdf?: boolean }) {
  if (status === "SENT") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600">
        <Mail size={16} className="mt-0.5 shrink-0 text-brand" />
        <span>
          We&apos;ve emailed your username{newAccount ? " and password" : ""}{withPdf ? " with your registration PDF" : ""} to <span className="font-semibold text-slate-800">{email}</span>.
          <span className="mt-0.5 block text-xs text-slate-500">
            {newAccount ? "Not in your inbox in a few minutes? Check Spam / Promotions." : "Log in with the password you already use for this email."}
          </span>
        </span>
      </div>
    );
  }
  if (status === "QUEUED") {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-600">
        <Mail size={16} className="mt-0.5 shrink-0 text-brand" />
        <span>
          Your registration is saved. Your login details{withPdf ? " and registration PDF" : ""} will be emailed to <span className="font-semibold text-slate-800">{email}</span> shortly.
          <span className="mt-0.5 block text-xs text-slate-500">
            Need to log in sooner? Go to <Link href="/student/login" className="font-semibold underline">Player login</Link> → “Forgot password?”. Your username is your email.
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>
        <span className="font-semibold">We couldn&apos;t email your login details to {email}.</span> Your registration is saved.
        <span className="mt-0.5 block text-xs text-amber-800">
          Go to <Link href="/student/login" className="font-semibold underline">Player login</Link> → “Forgot password?” and enter this email to get a link to set your password. Your username is your email.
        </span>
      </span>
    </div>
  );
}

function RegistrationForm({ tournament, onBack }: { tournament: Tournament; onBack: () => void }) {
  const lockGender = tournament.gender === "BOTH" ? undefined : tournament.gender;
  const [step, setStep] = useState<Step>({ kind: "pincode" });
  const [student, setStudent] = useState<StudentInput>({ ...emptyStudent, gender: lockGender ?? "" });
  const [docs, setDocs] = useState<StudentDocs>(emptyDocs);
  const [agreed, setAgreed] = useState(false);
  const emailOtp = useEmailOtp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<EventsValue>({ ...emptyEvents, competeAs: lockGender ?? "" });
  const meta = useMeta();
  // The events question is part of the form: worked out from the date of birth as it's typed.
  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(student.dob);
  const age = dobValid ? competitionAge(student.dob, tournament.startDate) : null;
  const eligible = meta && dobValid ? eligibleAgeGroups(meta, student.dob, tournament.startDate, tournament.ageGroups) : [];
  // Applicants outside Tamil Nadu wait for approval first, then choose their events by logging in.
  const asksEvents = !student.outsideTamilNadu;
  // One weight: the events picker shows (and edits) the weight from Additional details.
  const eventsValue: EventsValue = { ...events, weight: student.weightKg };
  const changeEvents = (v: EventsValue) => {
    setEvents(v);
    if (v.weight !== student.weightKg) setStudent((s) => ({ ...s, weightKg: v.weight }));
  };

  /** The pincode decides the rest of the form: Tamil Nadu (BPL question) or elsewhere (proof of nativity). */
  function startWith(match: PincodeMatch, participantType: ParticipantType) {
    setStudent((s) => ({
      ...s,
      participantType,
      // One pincode: the permanent address's (the form has no second pincode box).
      residingPincode: match.pincode,
      pincode: match.pincode,
      state: match.inTamilNadu ? "Tamil Nadu" : match.state || "",
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
      (!emailOtp.tokenFor(s.email) ? "Please verify your email — click Verify and enter the code we send." : null) ??
      (asksEvents && age !== null && !eligible.length ? "There is no event in this tournament for your age." : null) ??
      (asksEvents ? eventsProblem(eventsValue, eligible, s.gender === "OTHER" && !lockGender) : null) ??
      (!agreed ? "Please confirm the details are correct." : null);
    setError(problem ?? "");
    if (problem) return;

    setBusy(true);
    try {
      const created = await api<{ status: string; studentNo: string | null; tempId: string | null; fullName: string; email: string; newAccount: boolean; entries: Entry[]; payToken: string | null; loginEmail: LoginEmail }>("/public/students/register", {
        body: {
          ...s,
          agreedToTerms: true,
          emailVerificationToken: emailOtp.tokenFor(s.email),
          photo: docs.photo,
          ...(s.outsideTamilNadu ? { nativityProof: docs.nativityProof, nativityProofLabel: docs.nativityProofLabel } : s.isBPL ? { bplProof: docs.bplProof } : {}),
          ...(asksEvents
            ? {
                entry: {
                  slug: tournament.slug,
                  ageGroups: events.ageGroups.filter((g) => eligible.includes(g)),
                  weightKg: parseFloat(s.weightKg),
                  competeAs: s.gender === "OTHER" ? lockGender ?? events.competeAs : undefined,
                },
              }
            : {}),
        },
      });
      setStep(
        created.studentNo
          ? { kind: "done", studentNo: created.studentNo, name: created.fullName, email: created.email, entries: created.entries, newAccount: created.newAccount, payToken: created.payToken, loginEmail: created.loginEmail }
          : { kind: "pending", email: created.email, tempId: created.tempId ?? "", newAccount: created.newAccount, loginEmail: created.loginEmail },
      );
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
              <StudentFields publicForm value={student} onChange={setStudent} lockGender={lockGender} emailOtp={emailOtp} docs={docs} onDocsChange={setDocs} />
              <div className="mt-8">
                {asksEvents ? (
                  <div className="space-y-4">
                    <EventsPicker eligible={eligible} age={age} gender={student.gender} lockGender={lockGender} value={eventsValue} onChange={changeEvents} />
                    <FeeTotal fees={tournament} count={events.ageGroups.filter((g) => eligible.includes(g)).length} />
                  </div>
                ) : (
                  <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Events:</span> because you live outside Tamil Nadu, your registration is checked first. Once it&apos;s approved, log in to choose the events you will play.
                  </p>
                )}
              </div>
              {error && <div className="mt-6"><ErrorText>{error}</ErrorText></div>}
              <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                  The details above are correct
                </label>
                <Button type="submit" loading={busy} className="h-12 px-10 text-base">{student.outsideTamilNadu ? "Submit for approval" : "Register"}</Button>
              </div>
            </form>
          )}

          {step.kind === "done" && (
            <EntryDone
              name={step.name}
              studentNo={step.studentNo}
              entries={step.entries}
              tournament={tournament}
              payToken={step.payToken}
              note={<LoginEmailNote status={step.loginEmail} email={step.email} newAccount={step.newAccount} withPdf />}
            />
          )}

          {step.kind === "pending" && (
            <div className="mx-auto max-w-md py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <Clock size={34} className="text-amber-500" />
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">Application sent for approval</p>
              {step.tempId && (
                <p className="mt-3 text-sm text-slate-600">
                  Temporary ID <span className="rounded-md bg-brand-soft px-2 py-0.5 font-mono font-bold text-brand">{step.tempId}</span>
                </p>
              )}
              <p className="mt-2 text-sm text-slate-500">
                Our team will check the document you uploaded; once you&apos;re approved we&apos;ll email your registration PDF, then you can log in and choose your events.
              </p>
              <div className="mt-4">
                <LoginEmailNote status={step.loginEmail} email={step.email} newAccount={step.newAccount} />
              </div>
              <div className="mt-6">
                <Link href="/student/login" className="text-sm font-semibold text-brand hover:underline">Go to player login</Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

/**
 * First questions: student or working professional, and where do they live? Tamil Nadu residents and
 * others follow different paths. (Both types play the same categories and pay the same fees.)
 */
function PincodeStep({ onFound }: { onFound: (m: PincodeMatch, type: ParticipantType) => void }) {
  const [type, setType] = useState<ParticipantType>("STUDENT");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = pincodeProblem(pincode);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      onFound(await lookupPincode(pincode), type);
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
      <h2 className="mt-4 text-xl font-bold text-slate-900">Let&apos;s get started</h2>
      <p className="mt-1 text-sm text-slate-500">Tell us who is registering and where you live.</p>
      <Field label="I am a" group className="mt-6 text-left">
        <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
          {(Object.keys(PARTICIPANT_TYPE_LABEL) as ParticipantType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cx("rounded-lg px-3 py-2.5 font-semibold transition-all", type === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
            >
              {PARTICIPANT_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Pincode where you live" className="mt-4 text-left">
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
