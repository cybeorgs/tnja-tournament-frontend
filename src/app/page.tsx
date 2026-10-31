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
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand to-orange-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
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

          <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to access the dashboard.</p>

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
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </IconInput>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <Button type="submit" loading={loading} icon={<LogIn size={16} />} className="h-11 w-full">
              Sign in
            </Button>
          </form>

          <div className="mt-10 border-t border-slate-100 pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">For students</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/register" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand/40 hover:text-brand">
                <UserPlus size={16} /> Register
              </Link>
              <Link href="/enter" className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand/40 hover:text-brand">
                <Trophy size={16} /> Enter tournament
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

function IconInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-slate-400">{icon}</span>
      {children}
    </div>
  );
}
