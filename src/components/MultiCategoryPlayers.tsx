"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Layers, Search } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { downloadFile } from "@/lib/api";
import { errorMessage, useToast } from "@/components/Toast";
import type { TournamentListItem } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, Select, Spinner, cx } from "@/components/ui";

/** GET /students/multi-category */
type MultiCategory = {
  totalPlayers: number;
  totalEntries: number;
  multiPlayers: number;
  singlePlayers: number;
  multiEntries: number;
  byCount: { categories: number; players: number }[];
  byCombo: { combo: string; players: number }[];
  players: {
    studentId: string; studentNo: string | null; fullName: string; club: string | null; district: string | null;
    tournamentId: string; tournamentTitle: string; combo: string;
    entries: { ageGroup: string; weightCategory: string; label: string; paymentStatus: string }[];
  }[];
};

const PAGE = 50;
/** "Mini Sub-Junior Age Group 1" → "Mini Sub-Junior 1" */
const short = (s: string) => s.replaceAll(" Age Group ", " ");

/** Players entered in more than one category of a tournament: how many, which combinations, and who. */
export function MultiCategoryPlayers({ tournaments }: { tournaments: TournamentListItem[] }) {
  const [tournamentId, setTournamentId] = useState("");
  const [combo, setCombo] = useState("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const query = tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : "";
  const { data, loading, error } = useApi<MultiCategory>(`/students/multi-category${query}`);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.players ?? []).filter(
      (p) => (!combo || p.combo === combo) && (!term || [p.fullName, p.studentNo, p.club, p.district].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [data, combo, q]);

  async function download() {
    setExporting(true);
    try {
      await downloadFile(`/students/multi-category${query ? `${query}&` : "?"}format=xlsx`, "multi-category-players.xlsx");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setExporting(false);
    }
  }

  const pct = data?.totalPlayers ? Math.round((data.multiPlayers / data.totalPlayers) * 100) : 0;
  const tiles = data
    ? [
        { label: "Players in 2+ categories", value: data.multiPlayers, sub: `${pct}% of ${data.totalPlayers.toLocaleString("en-IN")} players` },
        { label: "Entries from them", value: data.multiEntries, sub: `of ${data.totalEntries.toLocaleString("en-IN")} entries` },
        ...data.byCount.map((c) => ({ label: `Playing ${c.categories} categories`, value: c.players, sub: "players" })),
      ]
    : [];

  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Layers size={16} /></span>
          <div>
            <h2 className="font-semibold text-slate-900">Players in multiple categories</h2>
            <p className="text-xs text-slate-500">Players entered in more than one category of the same tournament</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select aria-label="Tournament" value={tournamentId} onChange={(e) => { setTournamentId(e.target.value); setCombo(""); setShown(PAGE); }} className="sm:w-64">
            <option value="">All tournaments</option>
            {tournaments.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
          <Button variant="secondary" icon={<FileSpreadsheet size={16} />} loading={exporting} onClick={download} disabled={!data?.multiPlayers}>Download</Button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState title="Could not load players">{error}</EmptyState>
      ) : !data?.multiPlayers ? (
        <EmptyState icon={<Layers size={40} />} title="No players in multiple categories">Players entered in two or more categories will show here.</EmptyState>
      ) : (
        <div className="p-5">
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border border-slate-200 p-4">
                <p className="text-2xl font-bold leading-none text-slate-900">{t.value.toLocaleString("en-IN")}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{t.label}</p>
                <p className="text-xs text-slate-400">{t.sub}</p>
              </div>
            ))}
          </div>

          <h3 className="mb-2 text-sm font-semibold text-slate-700">Which categories they play</h3>
          <div className="mb-5 flex flex-wrap gap-2">
            {data.byCombo.map((c) => {
              const active = combo === c.combo;
              return (
                <button
                  key={c.combo}
                  type="button"
                  onClick={() => { setCombo(active ? "" : c.combo); setShown(PAGE); }}
                  aria-pressed={active}
                  className={cx(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-700 hover:border-slate-300",
                  )}
                >
                  {short(c.combo)}
                  <span className={cx("rounded-full px-2 text-xs font-bold", active ? "bg-brand text-white" : "bg-slate-100 text-slate-600")}>{c.players}</span>
                </button>
              );
            })}
          </div>

          <div className="relative mb-3">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search name, ID, club or district" className="pl-9" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Player</th>
                  {!tournamentId && <th className="py-2 pr-4">Tournament</th>}
                  <th className="py-2 pr-4 text-center">Categories</th>
                  <th className="py-2">Playing in</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((p) => (
                  <tr key={`${p.tournamentId}-${p.studentId}`} className="border-b border-slate-50 align-top">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-800">{p.fullName}</p>
                      <p className="font-mono text-xs text-slate-500">{p.studentNo ?? "—"}</p>
                      {(p.club || p.district) && <p className="text-xs text-slate-400">{[p.club, p.district].filter(Boolean).join(", ")}</p>}
                    </td>
                    {!tournamentId && <td className="py-3 pr-4 text-slate-600">{p.tournamentTitle}</td>}
                    <td className="py-3 pr-4 text-center font-bold text-slate-800">{p.entries.length}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.entries.map((e) => <Badge key={e.ageGroup} color={e.paymentStatus === "PENDING" ? "yellow" : "blue"}>{short(e.label)}</Badge>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p className="py-8 text-center text-sm text-slate-400">No players match.</p>}
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {Math.min(shown, rows.length).toLocaleString("en-IN")} of {rows.length.toLocaleString("en-IN")} · <span className="text-amber-700">yellow</span> = entry fee unpaid</span>
            {shown < rows.length && <button type="button" onClick={() => setShown((n) => n + PAGE)} className="font-semibold text-brand hover:underline">Show more</button>}
          </div>
        </div>
      )}
    </Card>
  );
}
