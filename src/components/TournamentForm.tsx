"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMeta } from "@/lib/hooks";
import { formatDateTime, fromLocalParts, rupees, titleCase, toDateInput, toLocalParts } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { Button, DateInput, Field, Input, Select, Textarea, cx } from "./ui";

/** Form state: dates and times are edited separately (local yyyy-mm-dd and HH:MM). */
export type TournamentInput = Pick<Tournament, "title" | "description" | "venue" | "city" | "level" | "gender" | "ageGroups"> & {
  startDate: string;
  startTime: string;
  endDate: string | null;
  opensDate: string;
  opensTime: string;
  closesDate: string;
  closesTime: string;
  /** Rupees, as typed */
  entryFee: string;
  additionalEntryFee: string;
};

/** What the API takes: the start and the registration moments as ISO date-times. */
export type TournamentPayload = Pick<Tournament, "title" | "description" | "venue" | "city" | "level" | "gender" | "ageGroups"> & {
  startDate: string;
  endDate: string | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  entryFee: number;
  additionalEntryFee: number;
};

const today = () => toLocalParts(new Date().toISOString()).date;

export const emptyTournament = (): TournamentInput => ({
  title: "", description: "", venue: "", city: "", startDate: "", startTime: "09:00", endDate: null,
  opensDate: today(), opensTime: "09:00", closesDate: "", closesTime: "23:59",
  level: "STATE", gender: "BOTH", ageGroups: [], entryFee: "", additionalEntryFee: "",
});

export function fromTournament(t: Tournament): TournamentInput {
  const start = toLocalParts(t.startDate);
  const opens = toLocalParts(t.registrationOpensAt);
  const closes = toLocalParts(t.registrationClosesAt);
  return {
    title: t.title, description: t.description, venue: t.venue, city: t.city,
    startDate: start.date, startTime: start.time, endDate: t.endDate ? toDateInput(t.endDate) : null,
    opensDate: opens.date, opensTime: opens.time, closesDate: closes.date, closesTime: closes.time,
    level: t.level, gender: t.gender, ageGroups: t.ageGroups, entryFee: String(t.entryFee ?? 0), additionalEntryFee: String(t.additionalEntryFee ?? t.entryFee ?? 0),
  };
}

function toPayload(f: TournamentInput): TournamentPayload {
  const { startTime, opensDate, opensTime, closesDate, closesTime, ...rest } = f;
  return {
    ...rest,
    startDate: fromLocalParts(f.startDate, startTime),
    endDate: f.endDate || null,
    registrationOpensAt: fromLocalParts(opensDate, opensTime),
    registrationClosesAt: fromLocalParts(closesDate, closesTime),
    entryFee: Number(f.entryFee) || 0,
    additionalEntryFee: Number(f.additionalEntryFee) || 0,
  };
}

/** What's wrong with the schedule, or null. The API checks the same. */
function scheduleProblem(p: TournamentPayload): string | null {
  if (!p.startDate) return "Enter the tournament start date and time.";
  if (!p.registrationOpensAt) return "Enter when registration opens.";
  if (!p.registrationClosesAt) return "Enter when registration closes.";
  if (p.registrationOpensAt >= p.registrationClosesAt) return "Registration must close after it opens.";
  if (p.registrationClosesAt > p.startDate) return "Registration must close before the tournament starts.";
  if (!Number.isInteger(p.entryFee) || p.entryFee < 0) return "Enter the first category fee in whole rupees (0 for free).";
  if (!Number.isInteger(p.additionalEntryFee) || p.additionalEntryFee < 0) return "Enter the additional category fee in whole rupees (0 for free).";
  if (p.additionalEntryFee > p.entryFee) return "The additional category fee should be lower than (or equal to) the first category fee.";
  return null;
}

function DateTimeField({ label, date, time, min, max, onDate, onTime }: {
  label: string; date: string; time: string; min?: string; max?: string; onDate: (v: string) => void; onTime: (v: string) => void;
}) {
  return (
    <Field label={label} group>
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <DateInput value={date} min={min} max={max} onChange={onDate} required />
        <Input type="time" value={time} onChange={(e) => onTime(e.target.value)} required aria-label={`${label} time`} />
      </div>
    </Field>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const utc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** YYYY-MM-DD plus `n` days. */
const addDays = (iso: string, n: number) => new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10);

/** Length of the event in days, counting both ends; 1 when there is no (valid) end date. */
function daysBetween(start: string, end: string | null) {
  if (!start || !end) return 1;
  const diff = Math.round((utc(end) - utc(start)) / DAY_MS);
  return diff >= 0 ? diff + 1 : 1;
}

export function TournamentForm({ initial, submitLabel, onSubmit, onCancel, formId, onSavingChange }: {
  initial: TournamentInput;
  submitLabel: string;
  onSubmit: (data: TournamentPayload) => Promise<void>;
  /** Shows a Cancel button (editing an existing tournament) */
  onCancel?: () => void;
  /** Lets a button outside the form submit it (<button type="submit" form={formId}>) */
  formId?: string;
  /** Tells that outside button when saving starts and ends */
  onSavingChange?: (saving: boolean) => void;
}) {
  const meta = useMeta();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  // The form is long and may be submitted from a bar at the top: bring a problem into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);
  useEffect(() => onSavingChange?.(saving), [saving, onSavingChange]);

  const set = <K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const payload = toPayload(form);
  const days = daysBetween(form.startDate, form.endDate);
  const allSelected = !!meta?.ageGroups.length && meta.ageGroups.every((g) => form.ageGroups.includes(g.name));
  const toggleAgeGroup = (name: string) =>
    set("ageGroups", form.ageGroups.includes(name) ? form.ageGroups.filter((g) => g !== name) : [...form.ageGroups, name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    const problem =
      // An empty fee box must not be saved as ₹0 (it would make those categories free).
      (form.entryFee.trim() === "" ? "Enter the first category fee (0 for free)." : null) ??
      (form.additionalEntryFee.trim() === "" ? "Enter the fee for each additional category (0 to make them free)." : null) ??
      scheduleProblem(payload) ??
      (!form.ageGroups.length ? "Pick at least one age group." : null);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-5">
      <Field label="Tournament title">
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. State Judo Championship 2026" required />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Venue">
          <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Stadium / hall name" required />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Chennai" />
        </Field>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_8rem_8rem_1fr]">
          <Field label="Start date">
            <DateInput
              value={form.startDate}
              // Keep the length the same when the start moves.
              onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: v && days > 1 ? addDays(v, days - 1) : f.endDate }))}
              required
            />
          </Field>
          <Field label="Start time">
            <Input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} required />
          </Field>
          <Field label="Number of days">
            <div className="relative">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={form.startDate ? days : ""}
                disabled={!form.startDate}
                placeholder="—"
                onChange={(e) => {
                  const n = Math.min(60, Math.max(1, Math.floor(Number(e.target.value)) || 1));
                  set("endDate", n > 1 ? addDays(form.startDate, n - 1) : null);
                }}
                className="pr-12"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-400">{days === 1 ? "day" : "days"}</span>
            </div>
          </Field>
          <Field label="End date" hint={form.startDate && days === 1 ? "Same day" : undefined}>
            <DateInput value={form.endDate ?? ""} min={form.startDate} onChange={(v) => set("endDate", v || null)} />
          </Field>
        </div>
        <Field label="Level">
          <Select value={form.level} onChange={(e) => set("level", e.target.value)}>
            {(meta?.levels ?? ["DISTRICT", "ZONAL", "STATE", "NATIONAL", "OPEN"]).map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}
          </Select>
        </Field>
        <Field label="Open to">
          <Select value={form.gender} onChange={(e) => set("gender", e.target.value as TournamentInput["gender"])}>
            <option value="BOTH">Boys and girls</option>
            <option value="MALE">Boys / men only</option>
            <option value="FEMALE">Girls / women only</option>
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-[13px] font-semibold text-slate-700">Registration</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField label="Registration opens" date={form.opensDate} time={form.opensTime} onDate={(v) => set("opensDate", v)} onTime={(v) => set("opensTime", v)} />
          <DateTimeField
            label="Registration closes"
            date={form.closesDate}
            time={form.closesTime}
            min={form.opensDate}
            max={form.startDate}
            onDate={(v) => set("closesDate", v)}
            onTime={(v) => set("closesTime", v)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First category fee" hint="A player's first category (age group). 0 = free.">
            <RupeeInput
              value={form.entryFee}
              onChange={(v) => setForm((f) => ({ ...f, entryFee: v, additionalEntryFee: f.additionalEntryFee === "" || f.additionalEntryFee === f.entryFee ? v : f.additionalEntryFee }))}
            />
          </Field>
          <Field
            label="Each additional category"
            hint="The same player entering more categories pays this for each one. Lower than (or equal to) the first category fee."
            error={payload.additionalEntryFee > payload.entryFee ? "Should not be more than the first category fee" : undefined}
          >
            <RupeeInput value={form.additionalEntryFee} onChange={(v) => set("additionalEntryFee", v)} invalid={payload.additionalEntryFee > payload.entryFee} />
          </Field>
        </div>
        {payload.entryFee > 0 && payload.additionalEntryFee <= payload.entryFee && (
          <p className="rounded-xl bg-brand-soft/60 px-4 py-2.5 text-xs text-slate-600">
            Example: a player entering 3 categories pays{" "}
            <span className="font-semibold text-slate-900">
              {rupees(payload.entryFee)} + 2 × {rupees(payload.additionalEntryFee)} = {rupees(payload.entryFee + 2 * payload.additionalEntryFee)}
            </span>
          </p>
        )}
        {!scheduleProblem(payload) && (
          <ol className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <li><span className="font-semibold text-slate-800">{formatDateTime(payload.registrationOpensAt)}</span> — registration opens ({payload.entryFee > 0 ? (payload.additionalEntryFee < payload.entryFee ? `${rupees(payload.entryFee)} first category, ${rupees(payload.additionalEntryFee)} each additional` : `${rupees(payload.entryFee)} per category`) : "free"})</li>
            <li><span className="font-semibold text-slate-800">{formatDateTime(payload.registrationClosesAt)}</span> — registration closes (no late entries)</li>
            <li><span className="font-semibold text-slate-800">{formatDateTime(payload.startDate)}</span> — tournament starts</li>
          </ol>
        )}
      </fieldset>

      <div>
        <p className="mb-2 text-[13px] font-medium text-slate-700">Age groups</p>
        {/* "All" on its own row, then the age groups in an even grid: name on the left, ages on the right */}
        <button
          type="button"
          onClick={() => meta && set("ageGroups", allSelected ? [] : meta.ageGroups.map((g) => g.name))}
          title={allSelected ? "Clear all" : "Select every age group"}
          aria-pressed={allSelected}
          className={cx(
            "mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors sm:w-auto sm:min-w-[12rem]",
            allSelected ? "border-brand bg-brand text-white" : "border-dashed border-brand/50 bg-brand-soft text-brand hover:border-brand",
          )}
        >
          <span>All age groups</span>
          <span className={cx("ml-4 text-xs", allSelected ? "text-white/80" : "text-brand/70")}>{form.ageGroups.length}/{meta?.ageGroups.length ?? 0}</span>
        </button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {meta?.ageGroups.map((g) => {
            const on = form.ageGroups.includes(g.name);
            return (
              <button
                type="button"
                key={g.name}
                onClick={() => toggleAgeGroup(g.name)}
                aria-pressed={on}
                className={cx(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors",
                  on ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <span className="min-w-0">{g.name}</span>
                <span className={cx("shrink-0 text-xs font-medium", on ? "text-white/80" : "text-slate-400")}>{g.minAge}{g.maxAge < 100 ? `–${g.maxAge}` : "+"}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">Ages are counted as tournament year minus birth year.</p>
      </div>

      <Field label="Description" hint="Shown on the public page: rules, reporting time, contact details…">
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
      </Field>

      {error && <p ref={errorRef} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>}
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function RupeeInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400">₹</span>
      <Input type="number" inputMode="numeric" min={0} step={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" required aria-invalid={invalid || undefined} className="pl-8" />
    </div>
  );
}
