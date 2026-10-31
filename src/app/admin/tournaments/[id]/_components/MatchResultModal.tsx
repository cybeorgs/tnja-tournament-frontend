"use client";

import { useState } from "react";
import { Minus, Plus, RotateCcw, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/hooks";
import { WIN_METHOD_LABEL } from "@/lib/format";
import type { Draw, Match, Score } from "@/lib/types";
import { Button, Field, Modal, Select, cx } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";

const LIMITS: Record<keyof Score, number> = { ippon: 1, wazaAri: 2, shido: 3 };
const LABELS: Record<keyof Score, string> = { ippon: "Ippon", wazaAri: "Waza-ari", shido: "Shido" };
const zero = (): Score => ({ ippon: 0, wazaAri: 0, shido: 0 });

/** Winner implied by the scores, if any (IJF: ippon, two waza-ari, or three shido = hansoku-make). */
function implied(a: Score, b: Score): { winner: "A" | "B"; method: string } | null {
  if (a.shido >= 3) return { winner: "B", method: "HANSOKU_MAKE" };
  if (b.shido >= 3) return { winner: "A", method: "HANSOKU_MAKE" };
  if (a.ippon || a.wazaAri >= 2) return { winner: "A", method: "IPPON" };
  if (b.ippon || b.wazaAri >= 2) return { winner: "B", method: "IPPON" };
  if (a.wazaAri > b.wazaAri) return { winner: "A", method: "WAZA_ARI" };
  if (b.wazaAri > a.wazaAri) return { winner: "B", method: "WAZA_ARI" };
  return null;
}

export function MatchResultModal({ drawId, match, onClose, onSaved }: { drawId: string; match: Match; onClose: () => void; onSaved: (d: Draw) => void }) {
  const toast = useToast();
  const meta = useMeta();
  const [scoreA, setScoreA] = useState<Score>(match.scoreA ?? zero());
  const [scoreB, setScoreB] = useState<Score>(match.scoreB ?? zero());
  const initialWinner = match.winnerId ? (match.winnerId === match.slotA.playerId ? "A" : "B") : null;
  const [winner, setWinner] = useState<"A" | "B" | null>(initialWinner);
  const [method, setMethod] = useState(match.winMethod ?? "IPPON");
  const [saving, setSaving] = useState<"save" | "undo" | null>(null);

  function bump(side: "A" | "B", key: keyof Score, delta: number) {
    const [score, setScore] = side === "A" ? [scoreA, setScoreA] : [scoreB, setScoreB];
    const next = { ...score, [key]: Math.max(0, Math.min(LIMITS[key], score[key] + delta)) };
    setScore(next);
    const auto = implied(side === "A" ? next : scoreA, side === "B" ? next : scoreB);
    if (auto) {
      setWinner(auto.winner);
      setMethod(auto.method);
    }
  }

  async function save() {
    if (!winner) return toast("Pick the winner.", false);
    setSaving("save");
    try {
      const draw = await api<Draw>(`/draws/${drawId}/matches/${match.matchId}/result`, { body: { winner, winMethod: method, scoreA, scoreB } });
      toast("Result saved.");
      onSaved(draw);
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(null);
    }
  }

  async function undo() {
    setSaving("undo");
    try {
      const draw = await api<Draw>(`/draws/${drawId}/matches/${match.matchId}/result`, { method: "DELETE" });
      toast("Result cleared.");
      onSaved(draw);
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(null);
    }
  }

  const side = (s: "A" | "B") => {
    const slot = s === "A" ? match.slotA : match.slotB;
    const score = s === "A" ? scoreA : scoreB;
    const picked = winner === s;
    return (
      <div className={cx("rounded-xl border-2 p-4 transition-colors", picked ? "border-emerald-500 bg-emerald-50" : "border-slate-200", s === "B" && !picked && "border-l-blue-500")}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s === "A" ? "White" : "Blue"}</p>
            <p className="truncate font-bold text-slate-900">{slot.playerName}</p>
            <p className="truncate text-xs text-slate-500">{slot.club || "—"}</p>
          </div>
          <button
            onClick={() => setWinner(s)}
            className={cx("flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold", picked ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            <Trophy size={13} /> {picked ? "Winner" : "Set winner"}
          </button>
        </div>
        <div className="space-y-2">
          {(Object.keys(LIMITS) as (keyof Score)[]).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <span className={cx("text-sm font-medium", key === "shido" ? "text-red-600" : "text-slate-700")}>{LABELS[key]}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => bump(s, key, -1)} className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50" aria-label={`Remove ${LABELS[key]}`}><Minus size={14} /></button>
                <span className="w-5 text-center font-mono font-bold">{score[key]}</span>
                <button onClick={() => bump(s, key, 1)} className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50" aria-label={`Add ${LABELS[key]}`}><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={match.isBronze ? "Bronze medal match" : `Round ${match.round} · Match ${match.matchNumber}`}
      footer={
        <>
          {match.status === "COMPLETED" && (
            <Button variant="ghost" icon={<RotateCcw size={15} />} loading={saving === "undo"} onClick={undo} className="mr-auto">Undo result</Button>
          )}
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" loading={saving === "save"} onClick={save}>Save result</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {side("A")}
        {side("B")}
      </div>
      <Field label="Won by" className="mt-4">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          {(meta?.winMethods ?? Object.keys(WIN_METHOD_LABEL)).map((m) => <option key={m} value={m}>{WIN_METHOD_LABEL[m] ?? m}</option>)}
        </Select>
      </Field>
      <p className="mt-3 text-xs text-slate-400">The winner moves on automatically.</p>
    </Modal>
  );
}
