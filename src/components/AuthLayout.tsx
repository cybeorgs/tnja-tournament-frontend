"use client";

import type { ReactNode } from "react";
import { useSettings } from "@/lib/hooks";
import { Brand, logoUrl } from "./Brand";

/** Split screen used by the start page and admin login: brand panel on the left, content on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
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

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Brand settings={settings} />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
