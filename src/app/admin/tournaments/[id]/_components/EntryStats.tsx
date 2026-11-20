"use client";

import { Layers, Users } from "lucide-react";
import type { Registration } from "@/lib/types";
import { cx } from "@/components/ui";

/** Youngest to oldest; anything else goes last. */
const ORDER = ["Mini Sub-Junior Age Group 1", "Mini Sub-Junior Age Group 2", "Mini Sub-Junior Age Group 3", "Sub-Junior", "Cadet", "Junior", "Senior"];
const rank = (g: string) => { const i = ORDER.indexOf(g); return i < 0 ? 99 : i; };
const short = (g: string) => g.replace(" Age Group ", " ");
const n = (v: number) => v.toLocaleString("en-IN");

/**
 * Count cards above the entries: entries and players, players by how many events they play (1, 2, 3…),
 * and per category the entries and how many of those players also play other events.
 * `eventsOf` is a player's number of entries in the whole tournament. Clicking a card filters the list.
 */
export function EntryStats({ entries, eventsOf, ageGroup, events, onAgeGroup, onEvents }: {
  entries: Registration[];
  eventsOf: (studentId: string) => number;
  ageGroup: string;
  events: number;
  onAgeGroup: (g: string) => void;
  onEvents: (count: number) => void;
}) {
  const players = [...new Set(entries.map((r) => r.studentId))];
  const byEvents = new Map<number, number>();
  for (const id of players) byEvents.set(eventsOf(id), (byEvents.get(eventsOf(id)) ?? 0) + 1);
  const eventCounts = [...byEvents.entries()].sort((a, b) => a[0] - b[0]);
  const multi = players.filter((id) => eventsOf(id) > 1).length;

  const groups = [...new Set(entries.map((r) => r.ageGroup))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((g) => {
    const ids = [...new Set(entries.filter((r) => r.ageGroup === g).map((r) => r.studentId))];
    const split = new Map<number, number>();
    for (const id of ids) if (eventsOf(id) > 1) split.set(eventsOf(id), (split.get(eventsOf(id)) ?? 0) + 1);
    return { name: g, entries: ids.length, multi: [...split.entries()].sort((a, b) => a[0] - b[0]) };
  });

  const tile = "rounded-xl border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md";
  return (
    <div className="border-b border-slate-100 px-4 py-4">
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-2xl font-bold leading-none text-slate-900">{n(entries.length)}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Entries</p>
        </div>
        <button type="button" onClick={() => onEvents(0)} aria-pressed={!events} className={cx(tile, !events ? "border-brand ring-2 ring-brand/15" : "border-slate-200")}>
          <p className="flex items-center gap-1.5 text-2xl font-bold leading-none text-slate-900"><Users size={16} className="text-slate-400" />{n(players.length)}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Players</p>
          <p className="text-[11px] text-slate-400">{n(multi)} in 2+ events</p>
        </button>
        {eventCounts.map(([count, total]) => {
          const active = events === count;
          return (
            <button key={count} type="button" onClick={() => onEvents(active ? 0 : count)} aria-pressed={active} className={cx(tile, active ? "border-brand ring-2 ring-brand/15" : "border-slate-200")}>
              <p className={cx("text-2xl font-bold leading-none", count > 1 ? "text-violet-700" : "text-slate-900")}>{n(total)}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">Playing {count} {count === 1 ? "event" : "events"}</p>
              <p className="text-[11px] text-slate-400">players</p>
            </button>
          );
        })}
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Layers size={13} /> By category</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {groups.map((g) => {
          const active = ageGroup === g.name;
          return (
            <button key={g.name} type="button" title={g.name} onClick={() => onAgeGroup(active ? "" : g.name)} aria-pressed={active} className={cx(tile, active ? "border-brand ring-2 ring-brand/15" : "border-slate-200")}>
              <p className="text-xl font-bold leading-none text-slate-900">{n(g.entries)}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-700">{short(g.name)}</p>
              {g.multi.length ? (
                g.multi.map(([count, total]) => <p key={count} className="text-[11px] text-violet-700">{n(total)} play {count} events</p>)
              ) : (
                <p className="text-[11px] text-slate-400">no multi-event players</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
