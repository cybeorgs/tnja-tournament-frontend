"use client";

import { useState, type FormEvent } from "react";
import { useMeta } from "@/lib/hooks";
import { titleCase, toDateInput } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { Button, DateInput, Field, Input, Select, Textarea, cx } from "./ui";

export type TournamentInput = Pick<
  Tournament,
  "title" | "description" | "venue" | "city" | "level" | "gender" | "ageGroups" | "entryFee" | "numberOfMats" | "registrationOpen"
> & { startDate: string; endDate: string | null };

export const emptyTournament: TournamentInput = {
  title: "", description: "", venue: "", city: "", startDate: "", endDate: null,
  level: "STATE", gender: "BOTH", ageGroups: [], entryFee: 0, numberOfMats: 1, registrationOpen: true,
};

export function fromTournament(t: Tournament): TournamentInput {
  return {
    title: t.title, description: t.description, venue: t.venue, city: t.city,
    startDate: toDateInput(t.startDate), endDate: t.endDate ? toDateInput(t.endDate) : null,
    level: t.level, gender: t.gender, ageGroups: t.ageGroups, entryFee: t.entryFee,
    numberOfMats: t.numberOfMats, registrationOpen: t.registrationOpen,
  };
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

export function TournamentForm({ initial, submitLabel, onSubmit }: { initial: TournamentInput; submitLabel: string; onSubmit: (data: TournamentInput) => Promise<void> }) {
  const meta = useMeta();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const days = daysBetween(form.startDate, form.endDate);
  const allSelected = !!meta?.ageGroups.length && meta.ageGroups.every((g) => form.ageGroups.includes(g.name));
  const toggleAgeGroup = (name: string) =>
    set("ageGroups", form.ageGroups.includes(name) ? form.ageGroups.filter((g) => g !== name) : [...form.ageGroups, name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.ageGroups.length) return setError("Pick at least one age group.");
    setSaving(true);
    try {
      await onSubmit({ ...form, endDate: form.endDate || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_9rem_1fr]">
          <Field label="Start date">
            <DateInput
              value={form.startDate}
              // Keep the length the same when the start moves.
              onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: v && days > 1 ? addDays(v, days - 1) : f.endDate }))}
              required
            />
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
        <Field label="Entry fee (₹)" hint="0 for a free event">
          <Input type="number" min={0} value={form.entryFee} onChange={(e) => set("entryFee", Number(e.target.value))} />
        </Field>
        <Field label="Number of mats">
          <Input type="number" min={1} max={20} value={form.numberOfMats} onChange={(e) => set("numberOfMats", Number(e.target.value))} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-slate-700">Age groups</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => meta && set("ageGroups", allSelected ? [] : meta.ageGroups.map((g) => g.name))}
            title={allSelected ? "Clear all" : "Select every age group"}
            aria-pressed={allSelected}
            className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", allSelected ? "border-brand bg-brand text-white" : "border-dashed border-brand/50 bg-brand-soft text-brand hover:border-brand")}
          >
            All
          </button>
          {meta?.ageGroups.map((g) => {
            const on = form.ageGroups.includes(g.name);
            return (
              <button
                type="button"
                key={g.name}
                onClick={() => toggleAgeGroup(g.name)}
                aria-pressed={on}
                className={cx("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", on ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}
              >
                {g.name} <span className={on ? "text-white/80" : "text-slate-400"}>({g.minAge}{g.maxAge < 100 ? `–${g.maxAge}` : "+"})</span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">Ages are counted as tournament year minus birth year.</p>
      </div>

      <Field label="Description" hint="Shown on the public page: rules, reporting time, contact details…">
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.registrationOpen} onChange={(e) => set("registrationOpen", e.target.checked)} className="h-4 w-4 accent-[#ff7400]" />
        Registration open (untick to lock the entry list)
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
