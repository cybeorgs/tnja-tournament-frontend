"use client";

import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Clock, IndianRupee, MapPin, Trophy, Users } from "lucide-react";
import { useApi, useNow } from "@/lib/hooks";
import { formatDateRange, formatDateTime, rupees, titleCase } from "@/lib/format";
import { registrationPhase, type Tournament } from "@/lib/types";
import { Badge, Card, EmptyState, Spinner, cx } from "./ui";
import { extraFee } from "./Payment";

/**
 * Published tournaments that can be signed up for right now, by their schedule: students while
 * registration is open; officials any time before the start. The list updates on its own.
 */
export function useOpenTournaments(forOfficials = false) {
  const { data, loading, error } = useApi<Tournament[]>("/public/tournaments");
  const now = useNow();
  const open = (t: Tournament) => {
    const phase = registrationPhase(t, now);
    return forOfficials ? phase !== "CLOSED" : phase === "OPEN";
  };
  return { tournaments: (data ?? []).filter((t) => t.status === "PUBLISHED" && open(t)), loading, error };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Closes today", "Closes tomorrow", "Closes in 5 days" (by calendar day). */
function closesIn(iso: string, now: Date) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
  return days <= 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`;
}

/** Calendar-style tile: month and day of the start. */
function DateTile({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <div className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-orange-200 bg-white text-center sm:w-16">
      <span className="w-full bg-brand py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{d.toLocaleString("en-IN", { month: "short" })}</span>
      <span className="py-1 text-2xl font-extrabold leading-tight text-slate-900 sm:text-[1.7rem]">{d.getDate()}</span>
    </div>
  );
}

function Meta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <div className="text-sm font-semibold text-slate-800">{children}</div>
      </div>
    </div>
  );
}

/** Title, badges and the key facts (dates, venue, fee, deadline) of a tournament. */
export function TournamentSummary({ tournament: t, showClosing = true }: { tournament: Tournament; showClosing?: boolean }) {
  const now = useNow();
  const open = registrationPhase(t, now) === "OPEN";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge color="orange">{titleCase(t.level)}</Badge>
        {t.gender !== "BOTH" && <Badge>{t.gender === "MALE" ? "Boys only" : "Girls only"}</Badge>}
        {showClosing && open && <Badge color="green">Registration open</Badge>}
      </div>
      <h2 className="mt-2 text-lg font-bold leading-snug text-slate-900 sm:text-xl">{t.title}</h2>

      <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Meta icon={<CalendarDays />} label="Dates">{formatDateRange(t.startDate, t.endDate)}</Meta>
        <Meta icon={<MapPin />} label="Venue"><span className="block truncate">{[t.venue, t.city].filter(Boolean).join(", ")}</span></Meta>
        {showClosing && (
          <Meta icon={<IndianRupee />} label="Entry fee">
            {t.entryFee <= 0 ? "Free" : extraFee(t) === t.entryFee ? (
              <>{rupees(t.entryFee)} <span className="font-normal text-slate-500">per category</span></>
            ) : (
              <>
                {rupees(t.entryFee)} <span className="font-normal text-slate-500">first category</span>
                <span className="block text-xs font-medium text-emerald-700">{extraFee(t) ? `${rupees(extraFee(t))} each additional category` : "Additional categories free"}</span>
              </>
            )}
          </Meta>
        )}
        {showClosing && open && (
          <Meta icon={<Clock />} label="Register by">
            {formatDateTime(t.registrationClosesAt)}
            <span className="ml-1.5 text-xs font-semibold text-amber-600">· {closesIn(t.registrationClosesAt, now)}</span>
          </Meta>
        )}
        <Meta icon={<Users />} label="Age groups">
          <span className="block truncate font-medium">{t.ageGroups.join(", ")}</span>
        </Meta>
      </div>
    </div>
  );
}

/** Page header plus the list of open tournaments to choose from. */
export function TournamentPicker({ title = "Tournament registration", subtitle = "Choose a tournament to register for.", tournaments, loading, error, onPick, showClosing }: {
  title?: string;
  subtitle?: string;
  tournaments: Tournament[];
  loading: boolean;
  error: string | null;
  onPick: (t: Tournament) => void;
  showClosing?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex flex-col gap-1 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="border-l-4 border-brand pl-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-1.5 pl-4 text-sm text-slate-500 sm:text-base">{subtitle}</p>
        </div>
        {!loading && !error && tournaments.length > 0 && (
          <p className="pl-4 text-sm font-medium text-slate-500 sm:pl-0">
            {tournaments.length} open tournament{tournaments.length === 1 ? "" : "s"}
          </p>
        )}
      </header>

      {loading ? (
        <Spinner />
      ) : error ? (
        <Card><EmptyState title="Couldn't load tournaments">{error}</EmptyState></Card>
      ) : !tournaments.length ? (
        <Card><EmptyState icon={<Trophy />} title="No tournaments open right now">Check back soon.</EmptyState></Card>
      ) : (
        <ul className="space-y-4">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md hover:shadow-slate-900/5">
                <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
                  <DateTile iso={t.startDate} />
                  <div className="min-w-0 flex-1">
                    <TournamentSummary tournament={t} showClosing={showClosing} />
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-xs text-slate-500">
                    {showClosing === false ? "Sign up as an official" : "You'll need your Aadhaar, a passport-size photo and your email."}
                  </p>
                  <button
                    onClick={() => onPick(t)}
                    className={cx(
                      "group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-sm shadow-orange-500/25 transition-all",
                      "hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 active:scale-[0.98] sm:h-10",
                    )}
                  >
                    Register <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
