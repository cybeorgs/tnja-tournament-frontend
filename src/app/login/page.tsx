"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { api, auth } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { BackLink, Button, cx } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.getToken()) router.replace("/admin");
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await api<{ token: string }>("/auth/login", { body: { username, password } });
      auth.setToken(token);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <BackLink href="/" />
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Admin login</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in to manage your tournaments.</p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">Username</label>
          <IconInput icon={<User size={16} />}>
            <input
              id="username"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className={inputClass}
            />
          </IconInput>
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
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

        {error && (
          <p role="alert" className="animate-pop-in flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" loading={loading} icon={<LogIn size={16} />} className="h-12 w-full text-base">
          Sign in
        </Button>
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
