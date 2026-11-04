"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { History, IndianRupee, LayoutDashboard, LogOut, Settings as SettingsIcon, Trophy, Users } from "lucide-react";
import { api, auth } from "@/lib/api";
import { useSettings } from "@/lib/hooks";
import { Brand, brandLogo, regNoLabel } from "@/components/Brand";
import { Spinner, cx } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard, exact: true },
  { href: "/admin/tournaments", label: "Tournaments", short: "Events", icon: Trophy },
  { href: "/admin/students", label: "Students", short: "Students", icon: Users },
  { href: "/admin/payments", label: "Payments", short: "Payments", icon: IndianRupee },
  { href: "/admin/audit", label: "Audit log", short: "Log", icon: History },
  { href: "/admin/settings", label: "Settings", short: "Settings", icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: settings } = useSettings();
  const [admin, setAdmin] = useState<{ name: string; username: string } | null>(null);

  useEffect(() => {
    if (!auth.getToken()) {
      router.replace("/login");
      return;
    }
    api<{ name: string; username: string }>("/auth/me")
      .then(setAdmin)
      .catch(() => {
        auth.clear();
        router.replace("/login");
      });
  }, [router]);

  if (!admin) return <Spinner label="Checking your session…" />;

  const logout = () => {
    auth.clear();
    router.replace("/login");
  };
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-dvh overflow-x-clip lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 p-4">
          <Brand settings={settings} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive(href, exact) ? "bg-brand-soft font-semibold text-brand" : "text-slate-600 hover:translate-x-0.5 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold uppercase text-white">{admin.username.charAt(0)}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{admin.username}</span>
            <button onClick={logout} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600" aria-label="Log out" title="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 bg-gradient-to-r from-brand to-orange-500 pt-[env(safe-area-inset-top)] text-white shadow-md shadow-orange-500/20 lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown */}
          <img src={brandLogo(settings)} alt="" className="h-9 w-9 shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/40" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">{settings?.orgShortName}{regNoLabel(settings) && <span className="ml-1.5 text-[11px] font-semibold text-white/85">{regNoLabel(settings)}</span>}</p>
            <p className="truncate text-[11px] text-white/80">Admin · {admin.username}</p>
          </div>
          <button onClick={logout} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-colors active:bg-white/30" aria-label="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:py-6">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.06)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-6">
          {NAV.map(({ href, short, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors", active ? "text-brand" : "text-slate-500 active:text-slate-800")}
              >
                {active && <span className="absolute inset-x-3 top-0 h-[3px] bg-brand" />}
                <span className={cx("flex h-8 w-11 items-center justify-center rounded-full transition-colors", active && "bg-brand-soft")}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                </span>
                {short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
