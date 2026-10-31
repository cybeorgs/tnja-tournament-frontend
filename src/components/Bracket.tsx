"use client";

import { Trophy } from "lucide-react";
import type { Draw, Match, Slot } from "@/lib/types";
import { WIN_METHOD_LABEL } from "@/lib/format";
import { cx } from "./ui";

type BracketDraw = Pick<Draw, "rounds" | "entrants" | "format" | "standings">;

function roundLabel(index: number, total: number) {
  const fromEnd = total - index;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semi-finals";
  if (fromEnd === 3) return "Quarter-finals";
  return `Round ${index + 1}`;
}

const canScore = (m: Match) => !!m.slotA.playerId && !!m.slotB.playerId && !m.byeResolved;

function SlotRow({ slot, match, side }: { slot: Slot; match: Match; side: "A" | "B" }) {
  const won = match.status === "COMPLETED" && !!match.winnerId && match.winnerId === slot.playerId;
  const lost = match.status === "COMPLETED" && !!match.winnerId && !won && !!slot.playerId;
  const score = side === "A" ? match.scoreA : match.scoreB;
  return (
    <div className={cx("flex items-center gap-2 px-2.5 py-1.5", side === "A" ? "border-l-[3px] border-l-white" : "border-l-[3px] border-l-blue-500", won && "bg-emerald-50")}>
      {slot.seedNumber && <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">S{slot.seedNumber}</span>}
      <div className="min-w-0 flex-1">
        <p className={cx("truncate text-xs font-semibold", slot.isBye ? "italic text-slate-300" : slot.playerId ? (lost ? "text-slate-400" : "text-slate-800") : "text-slate-400")}>
          {slot.playerName}
        </p>
        {slot.club && <p className="truncate text-[10px] text-slate-400">{slot.club}</p>}
      </div>
      {score && match.status === "COMPLETED" && !match.byeResolved && (
        <span className="shrink-0 font-mono text-[10px] text-slate-500" title="Ippon · Waza-ari · Shido">
          {score.ippon}{score.wazaAri}{score.shido > 0 ? <span className="text-red-500">·{score.shido}</span> : ""}
        </span>
      )}
      {won && <Trophy size={12} className="shrink-0 text-emerald-600" />}
    </div>
  );
}

function MatchCard({ match, onClick, label }: { match: Match; onClick?: (m: Match) => void; label?: string }) {
  const clickable = !!onClick && canScore(match);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onClick!(match)}
      className={cx(
        "w-52 overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-all",
        match.status === "COMPLETED" ? "border-slate-200" : canScore(match) ? "border-orange-200" : "border-slate-200 border-dashed",
        clickable && "hover:-translate-y-0.5 hover:border-brand hover:shadow-md",
        !clickable && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span>{label ?? `Match ${match.matchNumber}`}</span>
        {match.status === "COMPLETED" && match.winMethod && <span className="normal-case text-emerald-600">{WIN_METHOD_LABEL[match.winMethod]?.split(" ")[0] ?? match.winMethod}</span>}
        {match.status !== "COMPLETED" && canScore(match) && <span className="text-brand">Ready</span>}
      </div>
      <div className="divide-y divide-slate-100">
        <SlotRow slot={match.slotA} match={match} side="A" />
        <SlotRow slot={match.slotB} match={match} side="B" />
      </div>
    </button>
  );
}

export function Bracket({ draw, onMatchClick }: { draw: BracketDraw; onMatchClick?: (m: Match) => void }) {
  if (draw.rounds.length === 0) {
    return (
      <div className="rounded-xl bg-emerald-50 p-6 text-center text-sm text-emerald-800">
        <Trophy className="mx-auto mb-2" />
        Only one entrant — <strong>{draw.entrants[0]?.name}</strong> wins this category without a match.
      </div>
    );
  }

  if (draw.format === "ROUND_ROBIN") {
    const byId = new Map(draw.entrants.map((e) => [e.id, e]));
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {draw.rounds.map((round, ri) => (
            <div key={ri}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Round {ri + 1}</p>
              <div className="flex flex-wrap gap-3">
                {round.map((m) => <MatchCard key={m.matchId} match={m} onClick={onMatchClick} />)}
              </div>
            </div>
          ))}
        </div>
        {draw.standings && (
          <div className="h-fit overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Player</th><th className="px-3 py-2 text-center">W</th><th className="px-3 py-2 text-center">L</th><th className="px-3 py-2 text-center">Pts</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draw.standings.map((s, i) => (
                  <tr key={s.entrantId}>
                    <td className="px-3 py-2 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{byId.get(s.entrantId)?.name}</td>
                    <td className="px-3 py-2 text-center">{s.wins}</td>
                    <td className="px-3 py-2 text-center">{s.losses}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">Ranked by wins, then head-to-head, then points (ippon 10, waza-ari 1).</p>
          </div>
        )}
      </div>
    );
  }

  const main = draw.rounds.map((r) => r.filter((m) => !m.isBronze));
  const bronze = draw.rounds.at(-1)?.find((m) => m.isBronze);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-6">
        {main.map((round, ri) => (
          <div key={ri} className="flex flex-col">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{roundLabel(ri, main.length)}</p>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {round.map((m) => <MatchCard key={m.matchId} match={m} onClick={onMatchClick} />)}
            </div>
            {ri === main.length - 1 && bronze && !(bronze.slotA.isBye && bronze.slotB.isBye) && (
              <div className="mt-6">
                <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-amber-700">Bronze medal</p>
                <MatchCard match={bronze} onClick={onMatchClick} label="Bronze" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
