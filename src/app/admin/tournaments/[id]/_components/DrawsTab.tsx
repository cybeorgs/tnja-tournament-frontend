"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Printer, RefreshCw, Shuffle, Swords, Trash2, Wand2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { categoryLabel } from "@/lib/format";
import type { CategorySummary, Draw, Match, Registration, TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Modal, Select, Spinner, cx } from "@/components/ui";
import { Bracket } from "@/components/Bracket";
import { errorMessage, useToast } from "@/components/Toast";
import { MatchResultModal } from "./MatchResultModal";

const keyOf = (c: { ageGroup: string; gender: string; weightCategory: string }) => `${c.ageGroup}|${c.gender}|${c.weightCategory}`;

export function DrawsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const { data: categories, loading, error, reload } = useApi<CategorySummary[]>(`/tournaments/${tournament.id}/categories`);
  const [chosen, setSelected] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const selected = chosen ?? (categories?.[0] ? keyOf(categories[0]) : null);
  const current = categories?.find((c) => keyOf(c) === selected) ?? null;
  const refresh = () => {
    reload();
    onChange();
  };

  async function generateAll() {
    setGeneratingAll(true);
    try {
      const res = await api<{ created: number; skipped: string[] }>(`/tournaments/${tournament.id}/draws/generate-all`, { body: { format: "AUTO", onlyPaid: tournament.entryFee > 0 } });
      toast(res.created ? `Generated ${res.created} draw(s).` : "Every category already has a draw.");
      if (res.skipped.length) toast(`Skipped: ${res.skipped.join("; ")}`, false);
      refresh();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setGeneratingAll(false);
    }
  }

  if (loading && !categories) return <Spinner />;
  if (error) return <EmptyState title="Could not load categories">{error}</EmptyState>;
  if (!categories?.length) {
    return (
      <Card>
        <EmptyState icon={<Swords size={40} />} title="No categories yet">Register students first — each age group, gender and weight class becomes a category with its own draw.</EmptyState>
      </Card>
    );
  }

  const missing = categories.filter((c) => !c.draw).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Card className="no-print h-fit overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-800">Categories</p>
          {missing > 0 && <Button size="sm" variant="secondary" icon={<Wand2 size={14} />} loading={generatingAll} onClick={generateAll}>Draw all ({missing})</Button>}
        </div>
        <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
          {categories.map((c) => {
            const k = keyOf(c);
            return (
              <li key={k}>
                <button
                  onClick={() => setSelected(k)}
                  className={cx("flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left", selected === k ? "bg-brand-soft" : "hover:bg-slate-50")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">{c.weightCategory} · {c.gender === "FEMALE" ? "Girls" : "Boys"}</span>
                    <span className="block truncate text-xs text-slate-500">{c.ageGroup} · {c.entrants} entr{c.entrants === 1 ? "y" : "ies"}</span>
                  </span>
                  {!c.draw ? <Badge>No draw</Badge>
                    : c.draw.isConcluded ? <Badge color="green">Concluded</Badge>
                    : c.draw.complete ? <Badge color="blue">Done</Badge>
                    : <Badge color="orange">{c.draw.matchesDone}/{c.draw.matchesTotal}</Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {current && <CategoryPanel key={selected} tournament={tournament} category={current} onChange={refresh} />}
    </div>
  );
}

function CategoryPanel({ tournament, category, onChange }: { tournament: TournamentDetail; category: CategorySummary; onChange: () => void }) {
  const toast = useToast();
  const { data: draw, setData: setDraw, loading } = useApi<Draw>(category.draw ? `/draws/${category.draw.id}` : null);
  const [scoring, setScoring] = useState<Match | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changeMat(matNumber: number) {
    if (!draw) return;
    try {
      setDraw(await api<Draw>(`/draws/${draw.id}`, { method: "PUT", body: { matNumber } }));
      onChange();
    } catch (err) {
      toast(errorMessage(err), false);
    }
  }

  async function remove() {
    if (!draw || !confirm("Delete this draw? All results recorded in it will be lost.")) return;
    setBusy(true);
    try {
      await api(`/draws/${draw.id}`, { method: "DELETE" });
      toast("Draw deleted.");
      onChange();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{categoryLabel(category)}</h2>
        <p className="text-sm text-slate-500">
          {category.entrants} entr{category.entrants === 1 ? "y" : "ies"}
          {tournament.entryFee > 0 && ` · ${category.paid} paid`}
          {draw && ` · ${draw.format === "ROUND_ROBIN" ? "Round robin" : "Elimination"} · ${draw.matchesDone}/${draw.matchesTotal} matches played`}
        </p>
      </div>
      {draw && (
        <div className="no-print flex flex-wrap items-center gap-2">
          <Select value={draw.matNumber} onChange={(e) => changeMat(Number(e.target.value))} className="w-28 py-1.5" aria-label="Mat" disabled={draw.isConcluded}>
            {Array.from({ length: tournament.numberOfMats }, (_, i) => <option key={i} value={i + 1}>Mat {i + 1}</option>)}
          </Select>
          <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>Print</Button>
          {!draw.isConcluded && (
            <>
              <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={() => setShowGenerate(true)}>Redraw</Button>
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />} loading={busy} onClick={remove}>Delete</Button>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (!category.draw) {
    return (
      <Card className="p-5">
        {header}
        <GeneratePanel tournament={tournament} category={category} onDone={onChange} />
      </Card>
    );
  }

  if (loading || !draw) return <Card className="p-5">{header}<Spinner /></Card>;

  return (
    <Card className="p-5">
      {header}
      {draw.isConcluded && (
        <p className="no-print mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 size={16} /> This category is concluded. Reopen it from Results & Certificates to change results.
        </p>
      )}
      {!draw.isConcluded && category.draw.notInDraw > 0 && (
        <p className="no-print mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} /> {category.draw.notInDraw} student(s) registered after this draw was made. Use Redraw to include them.
        </p>
      )}
      {!draw.isConcluded && draw.matchesDone < draw.matchesTotal && (
        <p className="no-print mb-3 text-xs text-slate-500">Click a match marked <span className="font-semibold text-brand">Ready</span> to record its result.</p>
      )}
      <Bracket draw={draw} onMatchClick={draw.isConcluded ? undefined : setScoring} />

      {scoring && (
        <MatchResultModal
          drawId={draw.id}
          match={scoring}
          onClose={() => setScoring(null)}
          onSaved={(d) => { setDraw(d); setScoring(null); onChange(); }}
        />
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Redraw this category" wide>
        <GeneratePanel tournament={tournament} category={category} existing={draw} onDone={() => { setShowGenerate(false); onChange(); }} />
      </Modal>
    </Card>
  );
}

function GeneratePanel({ tournament, category, existing, onDone }: { tournament: TournamentDetail; category: CategorySummary; existing?: Draw; onDone: () => void }) {
  const toast = useToast();
  const { data: registrations } = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const [format, setFormat] = useState<"AUTO" | "ELIMINATION" | "ROUND_ROBIN">(existing?.format ?? "AUTO");
  const [seeds, setSeeds] = useState<string[]>(["", "", "", ""]);
  const [onlyPaid, setOnlyPaid] = useState(tournament.entryFee > 0);
  const [mat, setMat] = useState(existing?.matNumber ?? 1);
  const [saving, setSaving] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);

  const entrants = (registrations ?? []).filter((r) => keyOf(r) === keyOf(category));

  async function generate(force = false) {
    setSaving(true);
    try {
      await api<Draw>(`/tournaments/${tournament.id}/draws`, {
        body: { ageGroup: category.ageGroup, gender: category.gender, weightCategory: category.weightCategory, format, seedIds: seeds.filter(Boolean), onlyPaid, matNumber: mat, force },
      });
      toast("Draw generated.");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !force && /erase/.test(err.message)) setConfirmForce(true);
      else toast(errorMessage(err), false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Format" hint="Auto: round robin for 5 or fewer, elimination with a bronze match above that">
          <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="AUTO">Auto</option>
            <option value="ELIMINATION">Elimination (IJF seeding)</option>
            <option value="ROUND_ROBIN">Round robin (everyone fights everyone)</option>
          </Select>
        </Field>
        <Field label="Mat">
          <Select value={mat} onChange={(e) => setMat(Number(e.target.value))}>
            {Array.from({ length: tournament.numberOfMats }, (_, i) => <option key={i} value={i + 1}>Mat {i + 1}</option>)}
          </Select>
        </Field>
      </div>

      {format !== "ROUND_ROBIN" && entrants.length > 2 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Seeds (optional)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {seeds.map((value, i) => (
              <Select
                key={i}
                value={value}
                onChange={(e) => setSeeds((s) => s.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Seed ${i + 1}`}
              >
                <option value="">Seed {i + 1} — none</option>
                {entrants.filter((r) => r.id === value || !seeds.includes(r.id)).map((r) => <option key={r.id} value={r.id}>Seed {i + 1}: {r.student.fullName}</option>)}
              </Select>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">Seed 1 goes to the bottom, seed 2 to the top, seeds 3 and 4 to opposite quarters. Team-mates are kept apart where possible.</p>
        </div>
      )}

      {tournament.entryFee > 0 && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyPaid} onChange={(e) => setOnlyPaid(e.target.checked)} className="h-4 w-4 accent-[#ff7400]" />
          Leave out entries whose fee is still pending ({category.entrants - category.paid})
        </label>
      )}

      <Button icon={<Shuffle size={16} />} loading={saving} onClick={() => generate()}>{existing ? "Redraw" : "Generate draw"}</Button>

      <Modal
        open={confirmForce}
        onClose={() => setConfirmForce(false)}
        title="Erase recorded results?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmForce(false)}>Keep current draw</Button>
            <Button variant="danger" loading={saving} onClick={() => { setConfirmForce(false); generate(true); }}>Erase and redraw</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">Results have already been recorded in this draw. Redrawing creates a fresh bracket and those results will be lost.</p>
      </Modal>
    </div>
  );
}
