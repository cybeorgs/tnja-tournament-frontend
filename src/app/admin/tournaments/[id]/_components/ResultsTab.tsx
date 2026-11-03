"use client";

import { useState } from "react";
import { Award, CheckCircle2, Download, Eye, FileStack, Lock, Medal, RotateCcw, Trophy } from "lucide-react";
import { api, openPdf } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { PLACEMENT_LABEL, categoryLabel } from "@/lib/format";
import { DRAW_FORMAT_LABEL, type Draw, type Placement, type Registration, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Modal, Select, Spinner, cx } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";
import { IconButton } from "./RegistrationsTab";
import { TournamentFilters, categoryOptions, matchesCategory, matchesText, useFilters } from "@/components/TournamentFilters";

const ORDER: Record<Placement, number> = { FIRST: 0, SECOND: 1, THIRD: 2, PARTICIPATION: 3 };
const ROW_STYLE: Record<Placement, string> = {
  FIRST: "border-amber-300 bg-amber-50",
  SECOND: "border-slate-300 bg-slate-50",
  THIRD: "border-orange-300 bg-orange-50",
  PARTICIPATION: "border-slate-200 bg-white",
};

function PlacementIcon({ p }: { p: Placement }) {
  if (p === "FIRST") return <Trophy size={15} className="text-amber-500" />;
  if (p === "SECOND") return <Medal size={15} className="text-slate-400" />;
  if (p === "THIRD") return <Medal size={15} className="text-orange-600" />;
  return <Award size={15} className="text-blue-500" />;
}

export function ResultsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const draws = useApi<Draw[]>(`/tournaments/${tournament.id}/draws`);
  const registrations = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const { filters, setFilters } = useFilters();

  const refresh = () => {
    draws.reload();
    registrations.reload();
    onChange();
  };

  if ((draws.loading && !draws.data) || (registrations.loading && !registrations.data)) return <Spinner />;
  if (draws.error || registrations.error) return <EmptyState title="Could not load results">{draws.error || registrations.error}</EmptyState>;

  const regById = new Map((registrations.data ?? []).map((r) => [r.id, r]));
  const list = draws.data ?? [];
  const concluded = list.filter((d) => d.isConcluded).length;
  // Search finds a category by its name or by any player in it.
  const shown = list.filter((d) => matchesCategory(filters, d) && matchesText(filters.q, categoryLabel(d), ...d.entrants.map((e) => regById.get(e.id)?.student.fullName)));

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">{concluded} of {list.length} categories concluded</p>
          <p className="text-xs text-slate-500">Conclude a category to lock its medals.</p>
        </div>
        <Button
          variant="secondary"
          icon={<FileStack size={16} />}
          disabled={!registrations.data?.length}
          onClick={() => openPdf(`/tournaments/${tournament.id}/certificates?kind=students`, "download", `${tournament.title}_certificates.pdf`).catch((err) => toast(errorMessage(err), false))}
        >
          All student certificates (PDF)
        </Button>
      </Card>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Award size={40} />} title="No draws yet">
            Generate draws and record matches in Draws & Matches. Until then you can still print participation certificates from the Students tab.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <TournamentFilters
              fields={["search", "gender", "ageGroup", "weight"]}
              filters={filters}
              onChange={setFilters}
              options={categoryOptions(filters, list)}
              total={list.length}
              shown={shown.length}
              searchPlaceholder="Search a player or a category"
              className="border-b-0"
            />
          </Card>
          {!shown.length && <Card><EmptyState title="No categories match">Try other filters, or clear them.</EmptyState></Card>}
          <div className="grid gap-6 xl:grid-cols-2">
            {shown.map((d) => (
              <CategoryResults
                key={`${d.id}:${d.isConcluded}:${d.matchesDone}:${d.entrants.map((e) => regById.get(e.id)?.placement ?? d.placements[e.id]).join(",")}`}
                tournamentId={tournament.id}
                draw={d}
                regById={regById}
                onChange={refresh}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryResults({ tournamentId, draw, regById, onChange }: { tournamentId: string; draw: Draw; regById: Map<string, Registration>; onChange: () => void }) {
  const toast = useToast();
  // Concluded draws use the saved placements; otherwise start from what the bracket says.
  const initial = () =>
    Object.fromEntries(draw.entrants.map((e) => [e.id, (draw.isConcluded ? regById.get(e.id)?.placement : null) ?? draw.placements[e.id] ?? "PARTICIPATION"])) as Record<string, Placement>;
  // The parent re-keys this component whenever the draw changes, which resets this state.
  const [placements, setPlacements] = useState<Record<string, Placement>>(initial);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const edited = draw.entrants.some((e) => placements[e.id] !== (draw.placements[e.id] ?? "PARTICIPATION"));
  const sorted = [...draw.entrants].sort((a, b) => ORDER[placements[a.id]!] - ORDER[placements[b.id]!] || a.name.localeCompare(b.name));
  const label = categoryLabel(draw);

  async function conclude() {
    setBusy(true);
    try {
      await api(`/draws/${draw.id}/conclude`, { body: edited || !draw.complete ? { placements } : {} });
      toast(`${label} concluded.`);
      setConfirming(false);
      onChange();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (!confirm(`Reopen ${label}? Its medals will be cleared until you conclude it again.`)) return;
    setBusy(true);
    try {
      await api(`/draws/${draw.id}/reopen`, { body: {} });
      toast("Category reopened.");
      onChange();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  const certificate = (regId: string, mode: "view" | "download") => {
    const name = regById.get(regId)?.student.fullName ?? "certificate";
    // Before concluding, print with the placement currently chosen on screen.
    const query = draw.isConcluded ? "" : `?placement=${placements[regId]}`;
    openPdf(`/tournaments/${tournamentId}/registrations/${regId}/certificate${query}`, mode, `${name}_certificate.pdf`).catch((err) => toast(errorMessage(err), false));
  };

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500">{draw.matchesDone}/{draw.matchesTotal} matches · {DRAW_FORMAT_LABEL[draw.format] ?? draw.format}</p>
        </div>
        {draw.isConcluded ? <Badge color="green"><Lock size={11} /> Concluded</Badge> : draw.complete ? <Badge color="blue">All matches done</Badge> : <Badge color="orange">In progress</Badge>}
      </div>

      <ul className="flex-1 space-y-2 p-4">
        {sorted.map((e) => {
          const p = placements[e.id]!;
          return (
            <li key={e.id} className={cx("flex items-center gap-3 rounded-lg border px-3 py-2", ROW_STYLE[p])}>
              <PlacementIcon p={p} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{e.name}</p>
                <p className="truncate text-xs text-slate-500">{e.club || "—"}</p>
              </div>
              {draw.isConcluded ? (
                <span className="text-xs font-semibold text-slate-600">{PLACEMENT_LABEL[p]}</span>
              ) : (
                <Select value={p} onChange={(ev) => setPlacements((s) => ({ ...s, [e.id]: ev.target.value as Placement }))} className="w-32 py-1 text-xs" aria-label={`Placement for ${e.name}`}>
                  {(Object.keys(PLACEMENT_LABEL) as Placement[]).map((x) => <option key={x} value={x}>{PLACEMENT_LABEL[x]}</option>)}
                </Select>
              )}
              <div className="flex">
                <IconButton label="View certificate" onClick={() => certificate(e.id, "view")}><Eye size={15} /></IconButton>
                <IconButton label="Download certificate" onClick={() => certificate(e.id, "download")}><Download size={15} /></IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <Button
          size="sm"
          variant="ghost"
          icon={<FileStack size={14} />}
          onClick={() => openPdf(`/tournaments/${tournamentId}/certificates?kind=students&drawId=${draw.id}`, "download", `${label}_certificates.pdf`).catch((err) => toast(errorMessage(err), false))}
        >
          Category certificates
        </Button>
        {draw.isConcluded ? (
          <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} loading={busy} onClick={reopen}>Reopen</Button>
        ) : (
          <Button size="sm" icon={<CheckCircle2 size={14} />} onClick={() => setConfirming(true)}>Conclude category</Button>
        )}
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Conclude ${label}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button loading={busy} onClick={conclude}>Conclude</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Medals will be saved and the bracket locked. You can reopen it later.</p>
        {!draw.complete && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {draw.matchesTotal - draw.matchesDone} match(es) haven&apos;t been played. The placements you picked by hand will be used.
          </p>
        )}
        {edited && draw.complete && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">Your changes override the bracket.</p>}
      </Modal>
    </Card>
  );
}
