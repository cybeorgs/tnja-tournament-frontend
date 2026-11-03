"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import { studentApi, studentAuth } from "@/lib/studentAuth";
import { AuthLayout } from "@/components/AuthLayout";
import { BackLink, Button, cx } from "@/components/ui";
import { errorMessage } from "@/components/Toast";

export default function StudentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (studentAuth.getToken()) router.replace("/student");
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { token } = await studentApi<{ token: string }>("/student-auth/login", { body: { login: email, password } });
        studentAuth.setToken(token);
        router.replace("/student");
        return;
      }
      const { message } = await studentApi<{ message: string }>("/student-auth/forgot-password", { body: { email } });
      setNotice(message);
      setMode("login");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <BackLink href="/" />
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{mode === "login" ? "Student login" : "Reset your password"}</h1>
      <p className="mt-2 text-sm text-slate-500">
        {mode === "login" ? "Use the username and password from your registration email. Your username is your email — your student ID or temporary ID also works." : "Enter the email you registered with. We'll email you a link to choose a new password."}
      </p>

      {notice && (
        <p className="animate-pop-in mt-6 flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {notice}
        </p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">{mode === "login" ? "Username" : "Email"}</label>
          <IconInput icon={<Mail size={16} />}>
            <input
              id="email"
              type={mode === "login" ? "text" : "email"}
              autoFocus
              autoComplete="username"
              placeholder={mode === "login" ? "Email, student ID or temporary ID" : "name@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              required
              className={inputClass}
            />
          </IconInput>
        </div>

        {mode === "login" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
              <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }} className="text-xs font-semibold text-brand hover:underline">
                Forgot password?
              </button>
            </div>
            <IconInput icon={<Lock size={16} />}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={cx(inputClass, "pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-brand"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </IconInput>
          </div>
        )}

        {error && (
          <p role="alert" className="animate-pop-in flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" loading={busy} icon={mode === "login" ? <LogIn size={16} /> : <Mail size={16} />} className="h-12 w-full text-base">
          {mode === "login" ? "Log in" : "Email me a reset link"}
        </Button>
        {mode === "forgot" && (
          <button type="button" onClick={() => { setMode("login"); setError(""); }} className="w-full text-center text-sm font-semibold text-slate-500 hover:text-brand">
            Back to login
          </button>
        )}
      </form>
    </AuthLayout>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

function IconInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400">{icon}</span>
      {children}
    </div>
  );
}
