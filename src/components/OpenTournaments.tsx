"use client";

import { CalendarDays, ChevronRight, MapPin, Trophy } from "lucide-react";
import { useApi, useNow } from "@/lib/hooks";
import { formatDateRange, formatDateTime, titleCase } from "@/lib/format";
import { registrationPhase, type Tournament } from "@/lib/types";
import { Badge, Card, EmptyState, Spinner } from "./ui";

/**
 * Published tournaments that can be signed up for right now, by their schedule: students during
 * regular or late registration; officials any time before the start. The list updates on its own.
 */
export function useOpenTournaments(forOfficials = false) {
  const { data, loading, error } = useApi<Tournament[]>("/public/tournaments");
  const now = useNow();
  const open = (t: Tournament) => {
    const phase = registrationPhase(t, now);
    return forOfficials ? phase !== "CLOSED" : phase === "OPEN" || phase === "LATE";
  };
  return { tournaments: (data ?? []).filter((t) => t.status === "PUBLISHED" && open(t)), loading, error };
}

export function TournamentSummary({ tournament: t, showClosing = true }: { tournament: Tournament; showClosing?: boolean }) {
  const now = useNow();
  const phase = registrationPhase(t, now);
  return (
    <>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <Badge color="orange">{titleCase(t.level)}</Badge>
        {t.gender !== "BOTH" && <Badge>{t.gender === "MALE" ? "Boys" : "Girls"}</Badge>}
        {phase === "LATE" && <Badge color="red">Late registration</Badge>}
      </div>
      <p className="font-bold text-slate-900">{t.title}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
        <span className="flex items-center gap-1.5"><CalendarDays size={14} /> {formatDateRange(t.startDate, t.endDate)}</span>
        <span className="flex items-center gap-1.5"><MapPin size={14} /> {[t.venue, t.city].filter(Boolean).join(", ")}</span>
        {showClosing && (phase === "OPEN" || phase === "LATE") && (
          <span className="text-xs">Free · register until {formatDateTime(phase === "LATE" ? t.startDate : t.registrationClosesAt)}</span>
        )}
      </div>
    </>
  );
}

/** Page header plus the list of open tournaments to choose from. */
export function TournamentPicker({ title, subtitle, tournaments, loading, error, onPick, showClosing }: {
  title?: string;
  subtitle?: string;
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  onPick: (t: Tournament) => void;
  showClosing?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      {(title || subtitle) && (
        <header className="mb-8 text-center">
          {title && <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>}
          {subtitle && <p className="mt-2 text-slate-500">{subtitle}</p>}
        </header>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card><EmptyState title="Couldn't load tournaments">{error}</EmptyState></Card>
      ) : !tournaments.length ? (
        <Card><EmptyState icon={<Trophy />} title="No tournaments open right now">Check back soon.</EmptyState></Card>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <button key={t.id} onClick={() => onPick(t)} className="group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20">
              <Card className="flex items-center gap-4 p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-md group-hover:shadow-orange-500/5">
                <div className="min-w-0 flex-1"><TournamentSummary tournament={t} showClosing={showClosing} /></div>
                <span className="hidden shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand transition-colors group-hover:bg-brand group-hover:text-white sm:inline">Register</span>
                <ChevronRight size={20} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand sm:hidden" />
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
