"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/hooks";
import { Brand } from "./Brand";
import { cx } from "./ui";

const LINKS: { href: string; label: string; hideOnMobile?: boolean }[] = [];

export function PublicShell({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="min-w-0 rounded-xl transition-opacity hover:opacity-80"><Brand settings={settings} /></Link>
          <nav className="flex shrink-0 items-center gap-1 text-sm font-medium">
            {LINKS.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cx(
                    "rounded-full px-3.5 py-2 transition-colors",
                    l.hideOnMobile && "hidden sm:block",
                    active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
      <footer className="no-print py-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} {settings?.orgName}
      </footer>
    </div>
  );
}
