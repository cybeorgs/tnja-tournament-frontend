"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { formatDateRange, titleCase } from "@/lib/format";
import type { TournamentListItem } from "@/lib/types";
import { TournamentStatusBadge } from "./TournamentStatus";

export function TournamentTable({ tournaments }: { tournaments: TournamentListItem[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {tournaments.map((t) => (
        <li key={t.id}>
          <Link href={`/admin/tournaments/${t.id}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-slate-50 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-slate-900">{t.title}</p>
                <TournamentStatusBadge tournament={t} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> {formatDateRange(t.startDate, t.endDate)}</span>
                <span className="inline-flex items-center gap-1"><MapPin size={13} /> {[t.venue, t.city].filter(Boolean).join(", ")}</span>
                <span>{titleCase(t.level)}</span>
              </div>
            </div>
            <div className="hidden gap-6 text-center text-xs text-slate-500 md:flex">
              <div><p className="text-base font-bold text-slate-800">{t._count.registrations}</p>Students</div>
              <div><p className="text-base font-bold text-slate-800">{t._count.referees}</p>Officials</div>
              <div><p className="text-base font-bold text-slate-800">{t.concludedDraws}/{t._count.draws}</p>Concluded</div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-300" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
