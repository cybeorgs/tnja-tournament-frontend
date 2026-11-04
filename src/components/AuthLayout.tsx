"use client";

import type { ReactNode } from "react";
import { useSettings } from "@/lib/hooks";
import { brandLogo, regNoLabel } from "./Brand";

/**
 * Used by the start page and the login pages.
 * Desktop: brand panel on the left, content on the right.
 * Mobile: an orange brand hero with a slanted edge, the content in a panel underneath.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-2">
      {/* Desktop brand panel — everything shown here comes from the organisation's settings. */}
      <aside className="relative m-3 hidden overflow-hidden rounded-[0.2rem] bg-gradient-to-br from-brand via-orange-500 to-amber-400 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown */}
          <img src={brandLogo(settings)} alt="" className="h-16 w-16 rounded-full bg-white object-contain p-1.5 shadow-md ring-4 ring-white/40" />
          {settings ? (
            <span>
              <span className="block text-lg font-bold">{settings.orgShortName}</span>
              {regNoLabel(settings) && <span className="block text-sm font-semibold text-white/85">{regNoLabel(settings)}</span>}
            </span>
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
          © {new Date().getFullYear()} {settings?.orgName}{regNoLabel(settings) && ` · ${regNoLabel(settings)}`}
        </p>
      </aside>

      <div className="flex min-h-dvh flex-col lg:min-h-0">
        {/* Mobile brand hero */}
        <header className="relative overflow-hidden bg-gradient-to-br from-brand via-orange-500 to-amber-400 px-6 pb-16 pt-[max(2.5rem,env(safe-area-inset-top))] text-white [clip-path:polygon(0_0,100%_0,100%_82%,0_100%)] lg:hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-white/5" />
          <div className="relative flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown */}
            <img src={brandLogo(settings)} alt="" className="h-20 w-20 rounded-full bg-white object-contain p-1.5 shadow-lg ring-4 ring-white/40" />
            {settings ? (
              <>
                <p className="mt-4 text-xl font-extrabold tracking-wide">{settings.orgShortName}</p>
                <p className="mt-1 max-w-xs text-sm leading-snug text-white/85">{settings.orgName}</p>
                {regNoLabel(settings) && <p className="mt-2 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold tracking-wide">{regNoLabel(settings)}</p>}
              </>
            ) : (
              <span className="mt-4 h-6 w-28 animate-pulse rounded bg-white/30" />
            )}
          </div>
        </header>

        <section className="flex flex-1 justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2 lg:items-center lg:py-12">
          <div className="w-full max-w-sm">{children}</div>
        </section>

        <p className="pb-6 text-center text-xs text-slate-400 lg:hidden">© {new Date().getFullYear()} {settings?.orgName}{regNoLabel(settings) && ` · ${regNoLabel(settings)}`}</p>
      </div>
    </main>
  );
}
