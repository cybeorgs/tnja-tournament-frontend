"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSettings } from "@/lib/hooks";
import { Brand } from "./Brand";

export function PublicShell({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="min-w-0"><Brand settings={settings} /></Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm font-semibold">
            <Link href="/register" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Register</Link>
            <Link href="/enter" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100">Enter</Link>
            <Link href="/verify" className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 sm:block">Verify</Link>
            <Link href="/" className="rounded-lg bg-slate-900 px-3 py-2 text-white hover:bg-slate-700">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="no-print border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {settings?.orgName}
      </footer>
    </div>
  );
}
