"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Clock, Lock, RotateCcw, Scale, UserX } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useMeta } from "@/lib/hooks";
import { weightClassFor } from "@/lib/categories";
import { categoryLabel, formatDateTime } from "@/lib/format";
import type { CategorySummary, Registration, TournamentDetail, WeighInStatus } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Spinner, cx } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";
import {
  ALL, TournamentFilters, categoryOptions, distinct, matchesCategory, matchesPlayer, matchesText, tournamentAge, useFilters,
} from "@/components/TournamentFilters";

const keyOf = (c: { ageGroup: string; gender: string; weightCategory: string }) => `${c.ageGroup}|${c.gender}|${c.weightCategory}`;

type StatusFilter = "ALL" | WeighInStatus;
const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Not weighed" },
  { value: "CLEARED", label: "Cleared" },
  { value: "DISQUALIFIED", label: "Disqualified" },
];

/**
 * Weigh-in comes before the draw: every player in a section (age group · gender · weight class) is
 * weighed, and the section's draw can only be generated once nobody in it is still "not weighed".
 */
export function WeighInTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const registrations = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const categories = useApi<CategorySummary[]>(`/tournaments/${tournament.id}/categories`);
  const { filters, setFilters } = useFilters();
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const all = useMemo(() => registrations.data ?? [], [registrations.data]);
  const drawn = useMemo(() => new Set((categories.data ?? []).filter((c) => c.draw).map(keyOf)), [categories.data]);
  const ageOf = (r: Registration) => tournamentAge(r.student.dob, tournament.startDate);

  const refresh = () => {
    registrations.reload();
    categories.reload();
    onChange();
  };

  if ((registrations.loading && !registrations.data) || (categories.loading && !categories.data)) return <Spinner />;
  if (registrations.error || categories.error) return <EmptyState title="Could not load the weigh-in">{registrations.error || categories.error}</EmptyState>;
  if (!all.length) {
    return <Card><EmptyState icon={<Scale size={40} />} title="No players yet">Players appear here once they are registered.</EmptyState></Card>;
  }

  const districts: Record<string, string[]> = {};
  for (const r of all) {
    const state = r.student.state.trim();
    if (state) districts[state] = distinct([...(districts[state] ?? []), r.student.district]);
  }
  const options = {
    ...categoryOptions(filters, all),
    ages: [...new Set(all.map(ageOf))].sort((a, b) => a - b),
    states: distinct(all.map((r) => r.student.state)),
    districts,
  };

  const matching = all.filter(
    (r) =>
      matchesCategory(filters, r) &&
      matchesPlayer(filters, { age: ageOf(r), state: r.student.state, district: r.student.district }) &&
      matchesText(filters.q, r.student.fullName, r.student.studentNo, r.student.email, r.student.club, r.student.phone),
  );
  const shown = matching.filter((r) => status === "ALL" || r.weighInStatus === status);
  const count = (s: WeighInStatus) => matching.filter((r) => r.weighInStatus === s).length;
  const sections = (categories.data ?? []).filter((c) => matchesCategory(filters, c));
  const ready = sections.filter((c) => c.entrants > 0 && c.weighIn.pending === 0).length;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Players", value: matching.length, tone: "text-slate-900" },
          { label: "Cleared", value: count("CLEARED"), tone: "text-emerald-600" },
          { label: "Not weighed", value: count("PENDING"), tone: count("PENDING") ? "text-amber-600" : "text-slate-900" },
          { label: "Sections ready for draw", value: `${ready}/${sections.length}`, tone: ready === sections.length ? "text-emerald-600" : "text-slate-900" },
        ].map((x) => (
          <Card key={x.label} className="p-4">
            <p className={`text-xl font-bold ${x.tone}`}>{x.value}</p>
            <p className="text-xs text-slate-500">{x.label}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <TournamentFilters
          fields={["search", "gender", "ageGroup", "weight", "age", "state", "district"]}
          filters={filters}
          onChange={setFilters}
          options={options}
          total={all.length}
          shown={shown.length}
          searchPlaceholder="Search name, student ID, email, club or phone"
        />

        {/* Sections: one per age group · gender · weight class, with their readiness for the draw */}
        <div className="border-b border-slate-100 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sections — draw allowed once everyone is weighed</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {sections.map((c) => {
              const total = c.weighIn.cleared + c.weighIn.pending;
              const isReady = total > 0 && c.weighIn.pending === 0;
              const selected = filters.ageGroup === c.ageGroup && filters.gender === c.gender && filters.weight === c.weightCategory;
              return (
                <button
                  key={keyOf(c)}
                  type="button"
                  onClick={() => setFilters(selected ? { ...filters, ageGroup: ALL, weight: ALL, gender: ALL } : { ...filters, ageGroup: c.ageGroup, gender: c.gender, weight: c.weightCategory })}
                  className={cx("rounded-xl border p-3 text-left transition-colors", selected ? "border-brand bg-brand-soft/50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")}
                  title={selected ? "Show all sections" : "Show only this section"}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{categoryLabel(c)}</p>
                    {c.draw ? <Badge color="blue">Drawn</Badge> : isReady ? <Badge color="green">Ready for draw</Badge> : <Badge color="yellow">{c.weighIn.pending} to weigh</Badge>}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cx("h-full rounded-full", isReady ? "bg-emerald-500" : "bg-amber-400")} style={{ width: `${total ? (c.weighIn.cleared / total) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.weighIn.cleared} of {total} weighed{c.weighIn.disqualified ? ` · ${c.weighIn.disqualified} disqualified` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3" role="radiogroup" aria-label="Weigh-in status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={status === s.value}
              onClick={() => setStatus(s.value)}
              className={cx("rounded-full border px-3 py-1 text-xs font-semibold", status === s.value ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}
            >
              {s.label} ({s.value === "ALL" ? matching.length : count(s.value)})
            </button>
          ))}
        </div>

        {!shown.length ? (
          <EmptyState title="No players match">Try other filters, or clear them.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((r) => (
              <WeighInRow key={`${r.id}:${r.weighInStatus}:${r.weightCategory}`} tournamentId={tournament.id} registration={r} locked={drawn.has(keyOf(r))} onSaved={refresh} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** One player: enter the scale weight, then clear, move to the right class, or disqualify. */
function WeighInRow({ tournamentId, registration: r, locked, onSaved }: { tournamentId: string; registration: Registration; locked: boolean; onSaved: () => void }) {
  const toast = useToast();
  const meta = useMeta();
  const [weight, setWeight] = useState(r.weighInKg ? String(r.weighInKg) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const kg = parseFloat(weight) || 0;
  const scaleClass = meta && kg ? weightClassFor(meta, r.ageGroup, r.gender, kg) : "";
  const mismatch = !!scaleClass && scaleClass !== r.weightCategory;

  async function act(action: "RECORD" | "MOVE" | "DISQUALIFY" | "RESET", e?: FormEvent) {
    e?.preventDefault();
    if ((action === "RECORD" || action === "MOVE") && !kg) return toast("Enter the scale weight.", false);
    if (action === "DISQUALIFY" && !confirm(`Disqualify ${r.student.fullName}? They will be left out of the ${r.weightCategory} draw.`)) return;
    setBusy(action);
    try {
      await api(`/tournaments/${tournamentId}/registrations/${r.id}/weigh-in`, { method: "PATCH", body: action === "RESET" ? { action } : { action, weightKg: kg || undefined } });
      toast(action === "RECORD" ? "Weigh-in cleared." : action === "MOVE" ? `Moved to ${scaleClass} and cleared.` : action === "DISQUALIFY" ? "Player disqualified." : "Weigh-in undone.");
      onSaved();
    } catch (err) {
      toast(errorMessage(err), false);
      setBusy(null);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
          {r.student.fullName}
        </p>
        <p className="text-xs text-slate-500">{[r.student.studentNo, r.student.club || r.student.district].filter(Boolean).join(" · ")}</p>
        <p className="mt-0.5 text-xs text-slate-600">
          {categoryLabel(r)} · registered at {r.weightKg} kg
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 lg:w-[30rem] lg:items-end">
        {r.weighInStatus === "PENDING" && !locked && (
          <form onSubmit={(e) => act("RECORD", e)} className="flex w-full flex-wrap items-center gap-2 lg:justify-end">
            <div className="relative w-32">
              <Input type="number" inputMode="decimal" step={0.1} min={10} max={250} placeholder="Scale" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-9 pr-9" aria-label={`Scale weight for ${r.student.fullName}`} />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">kg</span>
            </div>
            {mismatch ? (
              <>
                <Button size="sm" icon={<ArrowRight size={14} />} loading={busy === "MOVE"} onClick={() => act("MOVE")}>Move to {scaleClass}</Button>
                <Button size="sm" variant="danger" icon={<UserX size={14} />} loading={busy === "DISQUALIFY"} onClick={() => act("DISQUALIFY")}>Disqualify</Button>
              </>
            ) : (
              <>
                <Button type="submit" size="sm" icon={<CheckCircle2 size={14} />} loading={busy === "RECORD"} disabled={!kg}>Clear</Button>
                <Button size="sm" variant="ghost" icon={<UserX size={14} />} loading={busy === "DISQUALIFY"} onClick={() => act("DISQUALIFY")}>Disqualify</Button>
              </>
            )}
            {mismatch && <p className="w-full text-xs font-medium text-red-600 lg:text-right">{kg} kg is outside {r.weightCategory} — the scale puts this player in {scaleClass}.</p>}
          </form>
        )}

        {r.weighInStatus !== "PENDING" && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {r.weighInStatus === "CLEARED" ? (
              <Badge color="green"><CheckCircle2 size={12} /> Cleared{r.weighInKg ? ` · ${r.weighInKg} kg` : ""}</Badge>
            ) : (
              <Badge color="red"><UserX size={12} /> Disqualified{r.weighInKg ? ` · ${r.weighInKg} kg` : ""}</Badge>
            )}
            {r.weighedAt && <span className="text-xs text-slate-400">{formatDateTime(r.weighedAt)}</span>}
            {!locked && <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} loading={busy === "RESET"} onClick={() => act("RESET")}>Undo</Button>}
          </div>
        )}

        {r.weighInStatus === "PENDING" && locked && <Badge color="yellow"><Clock size={12} /> Not weighed</Badge>}
        {locked && (
          <p className="flex items-center gap-1 text-xs text-slate-400"><Lock size={12} /> Draw already generated — delete it to change the weigh-in.</p>
        )}
      </div>
    </li>
  );
}
