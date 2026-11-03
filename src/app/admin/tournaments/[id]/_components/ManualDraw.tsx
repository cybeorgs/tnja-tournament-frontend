"use client";

import { ArrowDown, ArrowUp, Shuffle } from "lucide-react";
import type { Draw, DrawFormat, Entrant } from "@/lib/types";
import { Button, Select, cx } from "@/components/ui";

/** First-round places, in order: match 1 A, match 1 B, match 2 A, … (registration id, or null for a BYE) */
export type Slots = (string | null)[];
/** A manual draw: first-round places (bracket formats) or the pool order (round robin) */
export type ManualValue = { slots: Slots } | { order: string[] };

export function bracketSize(players: number) {
  let p = 1;
  while (p < Math.max(players, 2)) p <<= 1;
  return p;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Players in the order given, BYEs (one per match) spread from the last match upwards. */
export function initialSlots(ids: string[]): Slots {
  const size = bracketSize(ids.length);
  const byes = size - ids.length;
  const slots: Slots = new Array(size).fill(null);
  let next = 0;
  for (let m = 0; m < size / 2; m++) {
    const withBye = m >= size / 2 - byes;
    slots[m * 2] = ids[next++] ?? null;
    slots[m * 2 + 1] = withBye ? null : ids[next++] ?? null;
  }
  return slots;
}

export const initialValue = (format: DrawFormat, ids: string[], random = false): ManualValue => {
  const list = random ? shuffled(ids) : ids;
  return format === "ROUND_ROBIN" ? { order: list } : { slots: initialSlots(list) };
};

/** The current pairings of a draw, to start editing from. */
export function valueFromDraw(draw: Draw): ManualValue {
  if (draw.format !== "ROUND_ROBIN") return { slots: draw.rounds[0]!.flatMap((m) => [m.slotA.playerId, m.slotB.playerId]) };
  return { order: poolOrderFromDraw(draw) };
}

/** Undo the circle method: the pool order that produces this round robin's first round. */
function poolOrderFromDraw(draw: Draw): string[] {
  const ids = draw.entrants.map((e) => e.id);
  const first = draw.rounds[0] ?? [];
  if (ids.length === 3 && draw.rounds.length === 3) {
    const [a, b] = [first[0]!.slotA.playerId!, first[0]!.slotB.playerId!];
    return [a, b, ids.find((id) => id !== a && id !== b)!];
  }
  const ring: (string | null)[] = new Array(ids.length % 2 ? ids.length + 1 : ids.length).fill(null);
  const offset = ids.length % 2 ? 1 : 0; // odd pools: ring[0] sits out the first round
  first.forEach((m, i) => {
    ring[i + offset] = m.slotA.playerId;
    ring[ring.length - 1 - i - offset] = m.slotB.playerId;
  });
  if (offset) ring[0] = ids.find((id) => !ring.includes(id)) ?? null;
  const order = ring.filter((x): x is string => !!x);
  return order.length === ids.length ? order : ids;
}

/** Round-robin bouts for a pool order (same rule as the server). */
function roundRobinPreview(order: string[]): [string, string][][] {
  if (order.length < 2) return [];
  if (order.length === 3) return [[[order[0]!, order[1]!]], [[order[1]!, order[2]!]], [[order[2]!, order[0]!]]];
  const ring: (string | null)[] = [...order];
  if (ring.length % 2) ring.push(null);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < ring.length - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < ring.length / 2; i++) {
      const a = ring[i];
      const b = ring[ring.length - 1 - i];
      if (a && b) round.push([a, b]);
    }
    rounds.push(round);
    ring.splice(1, 0, ring.pop()!);
  }
  return rounds;
}

/** What's wrong with a manual draw, or null when it can be saved. */
export function manualProblem(value: ManualValue): string | null {
  if (!("slots" in value)) return null;
  for (let i = 0; i < value.slots.length; i += 2) {
    if (value.slots[i] === null && value.slots[i + 1] === null) return `Match ${i / 2 + 1} has two BYEs — every first-round match needs at least one player.`;
  }
  return null;
}

/** Edit a manual draw for any format. */
export function ManualDrawEditor({ format, players, value, onChange }: { format: DrawFormat; players: Entrant[]; value: ManualValue; onChange: (v: ManualValue) => void }) {
  const ids = players.map((p) => p.id);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          {"slots" in value
            ? "Choose who fights whom in each first-round match. Picking a player who is already placed swaps the two."
            : "Set the pool order. Everyone meets everyone once; the order decides who fights whom in each round."}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<Shuffle size={13} />} onClick={() => onChange(initialValue(format, ids, true))}>Shuffle</Button>
          <Button size="sm" variant="ghost" onClick={() => onChange(initialValue(format, ids))}>Reset</Button>
        </div>
      </div>
      {"slots" in value ? (
        <SlotEditor players={players} slots={value.slots} onChange={(slots) => onChange({ slots })} />
      ) : (
        <PoolOrderEditor players={players} order={value.order} onChange={(order) => onChange({ order })} />
      )}
    </div>
  );
}

function SlotEditor({ players, slots, onChange }: { players: Entrant[]; slots: Slots; onChange: (s: Slots) => void }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const matchOf = (id: string) => Math.floor(slots.indexOf(id) / 2) + 1;
  // Put `id` (a player, or null for a BYE) at place i; whoever was there moves to where `id` was.
  const place = (i: number, id: string | null) => {
    const next = [...slots];
    const from = id === null ? -1 : next.indexOf(id);
    if (from >= 0) next[from] = next[i]!;
    else if (id === null) {
      // Turning a player into a BYE: the player takes the place of a BYE elsewhere
      const bye = next.findIndex((x, j) => x === null && j !== i);
      if (bye < 0) return;
      next[bye] = next[i]!;
    }
    next[i] = id;
    onChange(next);
  };
  const byes = slots.filter((s) => s === null).length;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {Array.from({ length: slots.length / 2 }, (_, m) => {
        const pair = [slots[m * 2]!, slots[m * 2 + 1]!] as const;
        const doubleBye = pair[0] === null && pair[1] === null;
        return (
          <div key={m} className={cx("rounded-lg border bg-white p-2", doubleBye ? "border-red-300" : "border-slate-200")}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Match {m + 1}</p>
            {pair.map((id, side) => (
              <div key={side} className="flex items-center gap-2 py-0.5">
                <span className={cx("w-4 shrink-0 text-center text-[11px] font-bold", side === 0 ? "text-slate-500" : "text-blue-600")}>{side === 0 ? "A" : "B"}</span>
                <Select
                  value={id ?? ""}
                  onChange={(e) => place(m * 2 + side, e.target.value || null)}
                  className="py-1.5 text-sm"
                  aria-label={`Match ${m + 1} player ${side === 0 ? "A" : "B"}`}
                >
                  {byes > 0 && <option value="">BYE</option>}
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.club ? ` · ${p.club}` : ""}{p.id !== id ? ` (match ${matchOf(p.id)})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            {pair[0] && pair[1] && byId.get(pair[0])?.club && byId.get(pair[0])?.club === byId.get(pair[1])?.club && (
              <p className="mt-1 text-[11px] text-amber-700">Same club</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PoolOrderEditor({ players, order, onChange }: { players: Entrant[]; order: string[]; onChange: (o: string[]) => void }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const move = (i: number, by: number) => {
    const next = [...order];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange(next);
  };
  const preview = roundRobinPreview(order);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ol className="space-y-1.5">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <span className="w-5 text-xs font-bold text-slate-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{byId.get(id)?.name}</span>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
            <button type="button" disabled={i === order.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
          </li>
        ))}
      </ol>
      <div className="space-y-2 text-xs">
        {preview.map((round, r) => (
          <div key={r}>
            <p className="font-bold uppercase tracking-wide text-slate-400">Round {r + 1}</p>
            {round.map(([a, b]) => (
              <p key={a + b} className="text-slate-700">{byId.get(a)?.name} <span className="text-slate-400">v</span> {byId.get(b)?.name}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
