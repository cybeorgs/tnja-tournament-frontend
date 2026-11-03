"use client";

import { API_BASE } from "@/lib/api";
import type { Settings } from "@/lib/types";

export const logoUrl = (settings: Settings) => `${API_BASE}/public/logo?v=${encodeURIComponent(settings.updatedAt)}`;
/** The TNJA logo bundled with the site: shown while settings load and if the API has none */
export const DEFAULT_LOGO = "/tnja-logo.jpeg";
/** An uploaded logo, otherwise the TNJA logo */
export const brandLogo = (settings: Settings | null) => (settings?.customLogo ? logoUrl(settings) : DEFAULT_LOGO);

/** Organisation logo (the TNJA logo unless another is uploaded in Settings) with name. */
export function Brand({ settings, compact }: { settings: Settings | null; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown */}
      <img src={brandLogo(settings)} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-slate-900">{settings?.orgShortName}</p>
        {!compact && <p className="truncate text-xs text-slate-500">{settings?.orgName || ""}</p>}
      </div>
    </div>
  );
}
