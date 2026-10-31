"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Copy, Sparkles, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { StudentFields, emptyStudent, validateStudent, type StudentInput } from "@/components/StudentFields";
import { useEmailOtp } from "@/components/EmailOtpField";
import { errorMessage } from "@/components/Toast";

export default function RegisterPage() {
  const [form, setForm] = useState<StudentInput>(emptyStudent);
  const [agreed, setAgreed] = useState(false);
  const emailOtp = useEmailOtp();
  const emailToken = emailOtp.tokenFor(form.email);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ studentNo: string; fullName: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem =
      validateStudent(form) ??
      (!emailToken ? "Please verify your email with the code we send." : null) ??
      (!agreed ? "Please confirm the details are correct." : null);
    setError(problem ?? "");
    if (problem) return;

    setSaving(true);
    try {
      setDone(await api("/public/students/register", { body: { ...form, agreedToTerms: agreed, emailVerificationToken: emailToken } }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (done) return <PublicShell><Success {...done} /></PublicShell>;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles size={13} /> Free · Instant student ID
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Student registration</h1>
          <p className="mt-2 text-slate-500">Register once and use your student ID for every tournament.</p>
        </header>

        <form onSubmit={submit} noValidate>
          <Card className="p-5 sm:p-8">
            <StudentFields value={form} onChange={setForm} emailOtp={emailOtp} />
          </Card>

          {error && (
            <p role="alert" className="animate-pop-in mt-5 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 cursor-pointer" />
              The details above are correct
            </label>
            <Button type="submit" loading={saving} className="h-12 px-10 text-base">Register</Button>
          </div>
        </form>
      </div>
    </PublicShell>
  );
}

function Success({ studentNo, fullName }: { studentNo: string; fullName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <CheckCircle2 size={36} className="text-emerald-500" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">You&apos;re registered!</h1>
      <p className="mt-1 text-slate-500">Welcome, {fullName}. Save your student ID.</p>

      <div className="mt-6 rounded-xl border border-orange-100 bg-brand-soft px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student ID</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wide text-brand">{studentNo}</p>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(studentNo).then(() => setCopied(true))}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand"
        >
          <Copy size={13} /> {copied ? "Copied" : "Copy ID"}
        </button>
      </div>

      <p className="mt-6 text-sm text-slate-500">Use it with your date of birth to enter tournaments.</p>
      <Link href="/enter" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-sm shadow-orange-500/25 transition-all hover:bg-brand-dark active:scale-[0.97]">
        <Trophy size={16} /> Enter a tournament
      </Link>
    </Card>
  );
}
