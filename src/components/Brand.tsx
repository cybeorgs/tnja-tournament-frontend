"use client";

import { Trophy } from "lucide-react";
import { API_BASE } from "@/lib/api";
import type { Settings } from "@/lib/types";

export const logoUrl = (settings: Settings) => `${API_BASE}/public/logo?v=${encodeURIComponent(settings.updatedAt)}`;

/** Organisation logo (or a trophy fallback) with name, driven by white-label settings. */
export function Brand({ settings, compact }: { settings: Settings | null; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {settings?.hasLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the API, size unknown
        <img src={logoUrl(settings)} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
          <Trophy size={20} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-slate-900">{settings?.orgShortName}</p>
        {!compact && <p className="truncate text-xs text-slate-500">{settings?.orgName || ""}</p>}
      </div>
    </div>
  );
}
