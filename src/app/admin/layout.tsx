"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, Settings as SettingsIcon, ShieldCheck, Trophy, Users, X } from "lucide-react";
import { api, auth } from "@/lib/api";
import { useSettings } from "@/lib/hooks";
import { Brand } from "@/components/Brand";
import { Spinner, cx } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/referees", label: "Referees", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: settings } = useSettings();
  const [admin, setAdmin] = useState<{ name: string; username: string } | null>(null);
  // The mobile menu remembers the page it was opened on, so navigating closes it.
  const [menuOpenedOn, setMenuOpenedOn] = useState<string | null>(null);
  const menuOpen = menuOpenedOn === pathname;
  const setMenuOpen = (open: boolean) => setMenuOpenedOn(open ? pathname : null);

  useEffect(() => {
    if (!auth.getToken()) {
      router.replace("/");
      return;
    }
    api<{ name: string; username: string }>("/auth/me")
      .then(setAdmin)
      .catch(() => {
        auth.clear();
        router.replace("/");
      });
  }, [router]);

  if (!admin) return <Spinner label="Checking your session…" />;

  const logout = () => {
    auth.clear();
    router.replace("/");
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon size={18} /> {label}
          </Link>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-slate-100 pt-3">
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600">
          <LogOut size={18} /> Log out
        </button>
        <p className="px-3 pt-2 text-xs text-slate-400">Signed in as {admin.username}</p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 p-4">
          <Brand settings={settings} />
        </div>
        {nav}
      </aside>

      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Brand settings={settings} compact />
        <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Menu size={20} />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <aside className="flex h-full w-64 flex-col bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <Brand settings={settings} compact />
              <button onClick={() => setMenuOpen(false)} className="rounded-lg p-1 text-slate-400" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
