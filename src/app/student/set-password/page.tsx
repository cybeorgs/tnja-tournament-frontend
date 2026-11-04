"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { PASSWORD_HINT, passwordProblem, studentApi, studentAuth } from "@/lib/studentAuth";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Spinner, cx } from "@/components/ui";
import { errorMessage } from "@/components/Toast";

/** Opened from the registration email or a "forgot password" email: choose a password, then go to the account. */
export default function SetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<Spinner />}>
        <SetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("The two passwords don't match.");
    setError("");
    setBusy(true);
    try {
      const { token: session } = await studentApi<{ token: string }>("/student-auth/set-password", { body: { token, password } });
      studentAuth.setToken(session);
      router.replace("/student");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Link not valid</h1>
        <p className="mt-2 text-sm text-slate-500">Open the link from your email again, or get a new one from the login page.</p>
        <Link href="/student/login" className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">Go to login</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Set your password</h1>
      <p className="mt-2 text-sm text-slate-500">Choose a password for your account. You&apos;ll use it with your email to log in.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <PasswordField id="password" label="New password" hint={PASSWORD_HINT} value={password} onChange={setPassword} show={show} onToggle={() => setShow((s) => !s)} autoFocus />
        <PasswordField id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} show={show} />

        {error && (
          <p role="alert" className="animate-pop-in flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" loading={busy} icon={<KeyRound size={16} />} className="h-12 w-full text-base">Set password and log in</Button>
      </form>
    </>
  );
}

function PasswordField({ id, label, hint, value, onChange, show, onToggle, autoFocus }: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"><Lock size={16} /></span>
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={cx(
            "h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow] hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10",
            onToggle ? "pr-11" : "pr-3",
          )}
        />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-brand"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
