"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Hand, Lock, Printer, RefreshCw, Scale, Shuffle, Swords, Trash2, Wand2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { categoryLabel } from "@/lib/format";
import { DRAW_FORMAT_LABEL, REPECHAGE_MIN, type CategorySummary, type Draw, type DrawFormat, type Entrant, type Match, type Registration, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Modal, Select, Spinner, cx } from "@/components/ui";
import { Bracket } from "@/components/Bracket";
import { errorMessage, useToast } from "@/components/Toast";
import { MatchResultModal } from "./MatchResultModal";
import { ManualDrawEditor, initialValue, manualProblem, valueFromDraw, type ManualValue } from "./ManualDraw";
import { TournamentFilters, categoryOptions, matchesCategory, matchesText, useFilters } from "@/components/TournamentFilters";

const FORMAT_HINT: Record<DrawFormat, string> = {
  ELIMINATION: "Knock-out; the two semi-final losers fight for one bronze",
  REPECHAGE: "After the final, the players the champion beat get a second chance at one bronze",
  DOUBLE_REPECHAGE: "Quarter-final losers get a second chance; two bronze medals (IJF)",
  ROUND_ROBIN: "Everyone fights everyone; ranked by wins",
};

const keyOf = (c: { ageGroup: string; gender: string; weightCategory: string }) => `${c.ageGroup}|${c.gender}|${c.weightCategory}`;

export function DrawsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const { data: categories, loading, error, reload } = useApi<CategorySummary[]>(`/tournaments/${tournament.id}/categories`);
  const [chosen, setSelected] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const { filters, setFilters } = useFilters();

  const shown = (categories ?? []).filter((c) => matchesCategory(filters, c) && matchesText(filters.q, categoryLabel(c)));
  // Keep the chosen category open while it matches the filters; otherwise open the first that does.
  const selected = chosen && shown.some((c) => keyOf(c) === chosen) ? chosen : shown[0] ? keyOf(shown[0]) : null;
  const current = shown.find((c) => keyOf(c) === selected) ?? null;
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
        <EmptyState icon={<Swords size={40} />} title="No categories yet">Add students first. Each weight class gets its own draw.</EmptyState>
      </Card>
    );
  }

  // Sections still waiting for weigh-in can't be drawn (counting only paid entries when unpaid ones are left out).
  const onlyPaid = tournament.entryFee > 0;
  const toWeigh = (c: CategorySummary) => (onlyPaid ? c.weighIn.pendingPaid : c.weighIn.pending);
  const undrawn = categories.filter((c) => !c.draw);
  const readyToDraw = undrawn.filter((c) => toWeigh(c) === 0).length;
  const heldForWeighIn = undrawn.length - readyToDraw;

  return (
    <div className="space-y-6">
      <Card className="no-print overflow-hidden">
        <TournamentFilters
          fields={["search", "gender", "ageGroup", "weight"]}
          filters={filters}
          onChange={setFilters}
          options={categoryOptions(filters, categories)}
          total={categories.length}
          shown={shown.length}
          searchPlaceholder="Search categories, e.g. Cadet -50kg"
          className="border-b-0"
        />
      </Card>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="no-print h-fit overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-800">Categories</p>
            {readyToDraw > 0 && <Button size="sm" variant="secondary" icon={<Wand2 size={14} />} loading={generatingAll} onClick={generateAll}>Draw all ready ({readyToDraw})</Button>}
          </div>
          {heldForWeighIn > 0 && (
            <a href="#weigh-in" className="flex items-center gap-1.5 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800 hover:underline">
              <Scale size={13} /> {heldForWeighIn} section{heldForWeighIn === 1 ? "" : "s"} held until weigh-in is complete
            </a>
          )}
          {!shown.length && <p className="px-4 py-6 text-center text-sm text-slate-500">No categories match the filters.</p>}
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {shown.map((c) => {
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
                    {!c.draw ? (toWeigh(c) > 0 ? <Badge color="yellow"><Scale size={11} /> {toWeigh(c)} to weigh</Badge> : <Badge color="green">Ready</Badge>)
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
    </div>
  );
}

function CategoryPanel({ tournament, category, onChange }: { tournament: TournamentDetail; category: CategorySummary; onChange: () => void }) {
  const toast = useToast();
  const { data: draw, setData: setDraw, loading } = useApi<Draw>(category.draw ? `/draws/${category.draw.id}` : null);
  const [scoring, setScoring] = useState<Match | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [editing, setEditing] = useState<ManualValue | null>(null);
  const [busy, setBusy] = useState(false);

  async function savePairings() {
    if (!draw || !editing) return;
    const problem = manualProblem(editing);
    if (problem) return toast(problem, false);
    setBusy(true);
    try {
      setDraw(await api<Draw>(`/draws/${draw.id}/pairings`, { method: "PUT", body: editing }));
      setEditing(null);
      toast("Pairings updated.");
      onChange();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(false);
    }
  }

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
          {draw && ` · ${DRAW_FORMAT_LABEL[draw.format] ?? draw.format} · ${draw.matchesDone}/${draw.matchesTotal} matches played`}
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
              {draw.rounds.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Hand size={14} />}
                  disabled={draw.matchesDone > 0}
                  title={draw.matchesDone > 0 ? "Matches have been played — undo their results to change the pairings" : "Choose who fights whom"}
                  onClick={() => setEditing(valueFromDraw(draw))}
                >
                  Edit pairings
                </Button>
              )}
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

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit pairings — ${DRAW_FORMAT_LABEL[draw.format] ?? draw.format}`}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={busy} disabled={!!editing && !!manualProblem(editing)} onClick={savePairings}>Save pairings</Button>
          </>
        }
      >
        {editing && (
          <>
            <ManualDrawEditor format={draw.format} players={draw.entrants} value={editing} onChange={setEditing} />
            {manualProblem(editing) && <p className="mt-2 text-sm text-red-600">{manualProblem(editing)}</p>}
            <p className="mt-2 text-xs text-slate-500">The same players stay in the draw. To add or remove players, use Redraw.</p>
          </>
        )}
      </Modal>

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Redraw this category" wide>
        <GeneratePanel tournament={tournament} category={category} existing={draw} onDone={() => { setShowGenerate(false); onChange(); }} />
      </Modal>
    </Card>
  );
}

function GeneratePanel({ tournament, category, existing, onDone }: { tournament: TournamentDetail; category: CategorySummary; existing?: Draw; onDone: () => void }) {
  const toast = useToast();
  const { data: registrations } = useApi<Registration[]>(`/tournaments/${tournament.id}/registrations`);
  const [format, setFormat] = useState<"AUTO" | DrawFormat>(existing?.format ?? "AUTO");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  /** The manual draw, for the players and format it was made for */
  const [manual, setManual] = useState<{ key: string; value: ManualValue } | null>(null);
  const [seeds, setSeeds] = useState<string[]>(["", "", "", ""]);
  const [onlyPaid, setOnlyPaid] = useState(tournament.entryFee > 0);
  const [mat, setMat] = useState(existing?.matNumber ?? 1);
  const [saving, setSaving] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);

  const entrants = (registrations ?? []).filter((r) => keyOf(r) === keyOf(category) && r.weighInStatus !== "DISQUALIFIED" && (!onlyPaid || r.paymentStatus !== "PENDING"));
  // Weigh-in first: the draw is held while anyone who would be in it hasn't been weighed.
  const notWeighed = entrants.filter((r) => r.weighInStatus !== "CLEARED");
  const held = !!registrations && notWeighed.length > 0;

  const players: Entrant[] = entrants.map((r) => ({ id: r.id, name: r.student.fullName, club: r.student.club || r.student.district || "" }));
  const repechageOk = entrants.length >= REPECHAGE_MIN;
  /** The format a manual draw is made in (Auto resolves the same way as on the server) */
  const manualFormat: DrawFormat = format === "AUTO" ? (entrants.length <= 5 ? "ROUND_ROBIN" : "ELIMINATION") : format;
  const manualKey = `${manualFormat}|${players.map((p) => p.id).join(",")}`;
  // Start again whenever the players or the format change
  const manualValue = manual?.key === manualKey ? manual.value : initialValue(manualFormat, players.map((p) => p.id));
  const problem = mode === "manual" ? manualProblem(manualValue) : null;
  const tooSmall = (format === "REPECHAGE" || format === "DOUBLE_REPECHAGE") && !repechageOk;

  async function generate(force = false) {
    setSaving(true);
    try {
      await api<Draw>(`/tournaments/${tournament.id}/draws`, {
        body: {
          ageGroup: category.ageGroup, gender: category.gender, weightCategory: category.weightCategory, onlyPaid, matNumber: mat, force,
          ...(mode === "manual" ? { format: manualFormat, manual: manualValue } : { format, seedIds: seeds.filter(Boolean) }),
        },
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
        <Field label="Format" hint={format === "AUTO" ? "Round robin for 5 or fewer players, otherwise single elimination" : FORMAT_HINT[format]}>
          <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="AUTO">Auto</option>
            <option value="ELIMINATION">Single elimination (one bronze)</option>
            <option value="REPECHAGE" disabled={!repechageOk}>Repechage (one bronze){repechageOk ? "" : ` — needs ${REPECHAGE_MIN}+ players`}</option>
            <option value="DOUBLE_REPECHAGE" disabled={!repechageOk}>Double repechage (two bronzes, IJF){repechageOk ? "" : ` — needs ${REPECHAGE_MIN}+ players`}</option>
            <option value="ROUND_ROBIN">Round robin (everyone fights everyone)</option>
          </Select>
        </Field>
        <Field label="Mat">
          <Select value={mat} onChange={(e) => setMat(Number(e.target.value))}>
            {Array.from({ length: tournament.numberOfMats }, (_, i) => <option key={i} value={i + 1}>Mat {i + 1}</option>)}
          </Select>
        </Field>
      </div>

      {entrants.length > 1 && (
        <div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            {(["auto", "manual"] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cx("flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold", mode === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              >
                {id === "auto" ? <><Shuffle size={14} /> Automatic draw</> : <><Hand size={14} /> Manual draw</>}
              </button>
            ))}
          </div>
          {mode === "manual" && (
            <div className="mt-3">
              {format === "AUTO" && <p className="mb-2 text-xs text-slate-500">Manual draw as {DRAW_FORMAT_LABEL[manualFormat].toLowerCase()} — choose another format above to change it.</p>}
              <ManualDrawEditor format={manualFormat} players={players} value={manualValue} onChange={(value) => setManual({ key: manualKey, value })} />
              {problem && <p className="mt-2 text-sm text-red-600">{problem}</p>}
            </div>
          )}
        </div>
      )}

      {mode === "auto" && format !== "ROUND_ROBIN" && entrants.length > 2 && (
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
          <p className="mt-1.5 text-xs text-slate-400">Top seeds are kept apart, and so are team-mates where possible.</p>
        </div>
      )}

      {tournament.entryFee > 0 && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyPaid} onChange={(e) => setOnlyPaid(e.target.checked)} className="h-4 w-4 accent-[#ff7400]" />
          Leave out entries whose fee is still pending ({category.entrants - category.paid})
        </label>
      )}

      {held && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold"><Scale size={15} /> Weigh-in pending for {notWeighed.length} of {entrants.length} players</p>
          <p className="mt-1 text-xs">{notWeighed.map((r) => r.student.fullName).join(", ")}</p>
          <a href="#weigh-in" className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">Go to Weigh-In →</a>
        </div>
      )}

      <Button
        icon={held ? <Lock size={16} /> : <Shuffle size={16} />}
        loading={saving}
        disabled={held || !entrants.length || !!problem || tooSmall}
        title={held ? "Every player in this section must be weighed in first" : ""}
        onClick={() => generate()}
      >
        {held ? `Held — weigh-in pending (${entrants.length - notWeighed.length}/${entrants.length} weighed)` : tooSmall ? `Repechage needs ${REPECHAGE_MIN}+ players` : mode === "manual" ? (existing ? "Save manual redraw" : "Save manual draw") : existing ? "Redraw" : "Generate draw"}
      </Button>

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
        <p className="text-sm text-slate-600">This draw has results. Redrawing will erase them.</p>
      </Modal>
    </div>
  );
}
