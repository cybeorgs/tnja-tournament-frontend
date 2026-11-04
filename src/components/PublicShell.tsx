"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSettings } from "@/lib/hooks";
import { Brand, brandLogo, regNoLabel } from "./Brand";

export function PublicShell({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Desktop header */}
      <header className="no-print sticky top-0 z-30 hidden border-b border-slate-200/70 bg-white/80 backdrop-blur-lg sm:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="min-w-0 rounded-xl transition-opacity hover:opacity-80"><Brand settings={settings} /></Link>
        </div>
      </header>

      {/* Mobile header: orange brand bar */}
      <header className="no-print sticky top-0 z-30 bg-gradient-to-r from-brand to-orange-500 pt-[env(safe-area-inset-top)] text-white shadow-md shadow-orange-500/20 sm:hidden">
        <Link href="/" className="flex items-center gap-3 px-4 py-2.5 active:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown */}
          <img src={brandLogo(settings)} alt="" className="h-9 w-9 shrink-0 rounded-full bg-white object-contain p-0.5 ring-2 ring-white/40" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold leading-tight">{settings?.orgShortName}{regNoLabel(settings) && <span className="ml-1.5 text-[11px] font-semibold text-white/85">{regNoLabel(settings)}</span>}</span>
            <span className="block truncate text-[11px] text-white/80">{settings?.orgName}</span>
          </span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:py-10">{children}</main>
      <footer className="no-print py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {settings?.orgName}{regNoLabel(settings) && ` · ${regNoLabel(settings)}`}
      </footer>
    </div>
  );
}
