"use client";

import { useState, type FormEvent } from "react";
import { useMeta } from "@/lib/hooks";
import { formatDateTime, fromLocalParts, rupees, titleCase, toDateInput, toLocalParts } from "@/lib/format";
import { lateEntryFee, type Tournament } from "@/lib/types";
import { Button, DateInput, Field, Input, Select, Textarea, cx } from "./ui";

/** Form state: dates and times are edited separately (local yyyy-mm-dd and HH:MM). */
export type TournamentInput = Pick<Tournament, "title" | "description" | "venue" | "city" | "level" | "gender" | "ageGroups" | "entryFee" | "lateEntryFee"> & {
  startDate: string;
  startTime: string;
  endDate: string | null;
  opensDate: string;
  opensTime: string;
  closesDate: string;
  closesTime: string;
  /** Deadline reminder email; an empty date means no reminder */
  remindDate: string;
  remindTime: string;
};

/** What the API takes: the start and the registration moments as ISO date-times. */
export type TournamentPayload = Pick<Tournament, "title" | "description" | "venue" | "city" | "level" | "gender" | "ageGroups" | "entryFee" | "lateEntryFee"> & {
  startDate: string;
  endDate: string | null;
  registrationOpensAt: string;
  registrationClosesAt: string;
  reminderAt: string | null;
};

const today = () => toLocalParts(new Date().toISOString()).date;

export const emptyTournament = (): TournamentInput => ({
  title: "", description: "", venue: "", city: "", startDate: "", startTime: "09:00", endDate: null,
  opensDate: today(), opensTime: "09:00", closesDate: "", closesTime: "23:59", remindDate: "", remindTime: "10:00",
  level: "STATE", gender: "BOTH", ageGroups: [], entryFee: 0, lateEntryFee: 0,
});

export function fromTournament(t: Tournament): TournamentInput {
  const start = toLocalParts(t.startDate);
  const opens = toLocalParts(t.registrationOpensAt);
  const closes = toLocalParts(t.registrationClosesAt);
  const remind = toLocalParts(t.reminderAt);
  return {
    title: t.title, description: t.description, venue: t.venue, city: t.city,
    startDate: start.date, startTime: start.time, endDate: t.endDate ? toDateInput(t.endDate) : null,
    opensDate: opens.date, opensTime: opens.time, closesDate: closes.date, closesTime: closes.time,
    remindDate: remind.date, remindTime: remind.time || "10:00",
    level: t.level, gender: t.gender, ageGroups: t.ageGroups, entryFee: t.entryFee, lateEntryFee: t.lateEntryFee,
  };
}

function toPayload(f: TournamentInput): TournamentPayload {
  const { startTime, opensDate, opensTime, closesDate, closesTime, remindDate, remindTime, ...rest } = f;
  return {
    ...rest,
    startDate: fromLocalParts(f.startDate, startTime),
    endDate: f.endDate || null,
    registrationOpensAt: fromLocalParts(opensDate, opensTime),
    registrationClosesAt: fromLocalParts(closesDate, closesTime),
    reminderAt: fromLocalParts(remindDate, remindTime) || null,
  };
}

/** What's wrong with the schedule, or null. The API checks the same. */
function scheduleProblem(p: TournamentPayload): string | null {
  if (!p.startDate) return "Enter the tournament start date and time.";
  if (!p.registrationOpensAt) return "Enter when registration opens.";
  if (!p.registrationClosesAt) return "Enter when regular registration closes.";
  if (p.registrationOpensAt >= p.registrationClosesAt) return "Regular registration must close after it opens.";
  if (p.registrationClosesAt > p.startDate) return "Regular registration must close before the tournament starts.";
  if (p.reminderAt && (p.reminderAt <= p.registrationOpensAt || p.reminderAt >= p.registrationClosesAt)) {
    return "The reminder email must be sent after registration opens and before regular registration closes.";
  }
  return null;
}

const fee = (n: number) => (n > 0 ? rupees(n) : "no fee");

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

export function TournamentForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: TournamentInput;
  submitLabel: string;
  onSubmit: (data: TournamentPayload) => Promise<void>;
  /** Shows a Cancel button (editing an existing tournament) */
  onCancel?: () => void;
}) {
  const meta = useMeta();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof TournamentInput>(key: K, value: TournamentInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const payload = toPayload(form);
  const days = daysBetween(form.startDate, form.endDate);
  const allSelected = !!meta?.ageGroups.length && meta.ageGroups.every((g) => form.ageGroups.includes(g.name));
  const toggleAgeGroup = (name: string) =>
    set("ageGroups", form.ageGroups.includes(name) ? form.ageGroups.filter((g) => g !== name) : [...form.ageGroups, name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem =
      scheduleProblem(payload) ??
      (form.lateEntryFee < form.entryFee ? "The late entry fee can't be lower than the regular entry fee." : null) ??
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
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-[1fr_8rem_8rem_1fr]">
          <Field label="Start date">
            <DateInput
              value={form.startDate}
              // Keep the length the same when the start moves.
              onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: v && days > 1 ? addDays(v, days - 1) : f.endDate }))}
              required
            />
          </Field>
          <Field label="Start time" hint="Registration closes then">
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
            label="Regular registration closes"
            date={form.closesDate}
            time={form.closesTime}
            min={form.opensDate}
            max={form.startDate}
            onDate={(v) => set("closesDate", v)}
            onTime={(v) => set("closesTime", v)}
          />
          <Field label="Regular entry fee (₹)" hint="Until regular registration closes. 0 for a free event.">
            <Input type="number" min={0} value={form.entryFee} onChange={(e) => set("entryFee", Number(e.target.value))} />
          </Field>
          <Field
            label="Late entry fee (₹)"
            hint="From the regular deadline until the tournament starts — also for registrations still unpaid at the deadline."
            error={form.lateEntryFee < form.entryFee ? "Can't be lower than the regular fee" : undefined}
          >
            <Input type="number" min={form.entryFee} value={form.lateEntryFee} onChange={(e) => set("lateEntryFee", Number(e.target.value))} />
          </Field>
          <Field label="Deadline reminder email" group hint="Sent to players who haven't paid yet. Leave the date empty for no reminder." className="sm:col-span-2">
            <div className="grid grid-cols-[1fr_8rem] gap-2 sm:max-w-md">
              <DateInput value={form.remindDate} min={form.opensDate} max={form.closesDate || undefined} onChange={(v) => set("remindDate", v)} />
              <Input type="time" value={form.remindTime} onChange={(e) => set("remindTime", e.target.value)} disabled={!form.remindDate} aria-label="Reminder time" />
            </div>
          </Field>
        </div>
        {!scheduleProblem(payload) && (
          <ol className="space-y-1 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <li><span className="font-semibold text-slate-800">{formatDateTime(payload.registrationOpensAt)}</span> — registration opens at {fee(form.entryFee)}</li>
            {payload.reminderAt && (
              <li><span className="font-semibold text-slate-800">{formatDateTime(payload.reminderAt)}</span> — reminder emailed to players who haven&apos;t paid</li>
            )}
            {payload.registrationClosesAt < payload.startDate && (
              <li><span className="font-semibold text-slate-800">{formatDateTime(payload.registrationClosesAt)}</span> — late registration at {fee(lateEntryFee(form))}</li>
            )}
            <li><span className="font-semibold text-slate-800">{formatDateTime(payload.startDate)}</span> — tournament starts, registration closes</li>
          </ol>
        )}
      </fieldset>

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

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>}
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
