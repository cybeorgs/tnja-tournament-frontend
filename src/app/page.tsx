"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Trophy, User, UserPlus } from "lucide-react";
import { api, auth } from "@/lib/api";
import { useSettings } from "@/lib/hooks";
import { Brand, logoUrl } from "@/components/Brand";
import { Button, cx } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { data: settings } = useSettings();
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
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Brand panel — everything shown here comes from the organisation's settings. */}
      <aside className="relative m-3 hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-orange-500 to-amber-400 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          {settings?.hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown
            <img src={logoUrl(settings)} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />
          )}
          {settings ? (
            <span className="text-lg font-bold">{settings.orgShortName}</span>
          ) : (
            <span className="h-5 w-32 animate-pulse rounded bg-white/30" />
          )}
        </div>

        <div className="relative max-w-md">
          {settings ? (
            <>
              <h2 className="text-4xl font-bold leading-tight">{settings.orgName}</h2>
              {settings.tagline && <p className="mt-4 text-lg text-white/85">{settings.tagline}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <span className="block h-9 w-80 animate-pulse rounded bg-white/30" />
              <span className="block h-5 w-56 animate-pulse rounded bg-white/20" />
            </div>
          )}
        </div>

        <p className="relative text-sm text-white/70">
          © {new Date().getFullYear()} {settings?.orgName}
        </p>
      </aside>

      {/* Sign-in form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Brand settings={settings} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back 👋</h1>
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

          <div className="mt-10">
            <div className="mb-4 flex items-center gap-3 text-xs font-medium text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> Students <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StudentLink href="/register" icon={<UserPlus size={18} />} label="Register" />
              <StudentLink href="/enter" icon={<Trophy size={18} />} label="Enter tournament" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

function StudentLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-2xl border border-slate-200 px-3 py-4 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand-soft/60 hover:text-brand active:scale-[0.98]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">{icon}</span>
      {label}
    </Link>
  );
}

function IconInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400">{icon}</span>
      {children}
    </div>
  );
}
