"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Input, Select, cx } from "./ui";
import { competitionAge } from "@/lib/categories";

/**
 * Filters for the tournament sections (students, draws, results, referees). Each section shows the
 * filters that make sense for it; the options are built from that section's own data, so only
 * values that actually occur are offered. Weight options follow the chosen gender and category.
 */
export type GenderFilter = "ALL" | "MALE" | "FEMALE";

export type Filters = {
  q: string;
  gender: GenderFilter;
  ageGroup: string;
  weight: string;
  age: string;
  state: string;
  district: string;
};

export type FilterField = "search" | "gender" | "ageGroup" | "weight" | "age" | "state" | "district";

export const ALL = "ALL";
export const emptyFilters: Filters = { q: "", gender: ALL, ageGroup: ALL, weight: ALL, age: ALL, state: ALL, district: ALL };

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const active = (Object.keys(emptyFilters) as (keyof Filters)[]).filter((k) => filters[k] !== emptyFilters[k]).length;
  return { filters, setFilters, active, reset: () => setFilters(emptyFilters) };
}

// ─── Helpers for building options and matching ───────────────────────────────

/** Distinct non-empty values, sorted. */
export const distinct = (values: (string | null | undefined)[]) => [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Weight classes in order: -20kg, -25kg … +90kg. */
export function sortWeights(weights: string[]) {
  const num = (w: string) => parseFloat(w.replace(/[^\d.]/g, "")) || 0;
  return [...new Set(weights)].sort((a, b) => (a.startsWith("+") ? 1 : 0) - (b.startsWith("+") ? 1 : 0) || num(a) - num(b));
}

/** Age as the tournament counts it: tournament year minus birth year. */
/** Age at the tournament by birth year only (same rule as the categories). */
export const tournamentAge = (dob: string, tournamentStart: string) => competitionAge(dob, tournamentStart);

export const matchesText = (q: string, ...fields: (string | null | undefined)[]) => {
  const needle = q.trim().toLowerCase();
  return !needle || fields.some((f) => (f ?? "").toLowerCase().includes(needle));
};

const is = (filter: string, value: string | number | null | undefined) => filter === ALL || String(value ?? "") === filter;

/** Does a category (age group / gender / weight) pass the gender, category and weight filters? */
export const matchesCategory = (f: Filters, c: { ageGroup: string; gender: string; weightCategory: string }) =>
  is(f.gender, c.gender) && is(f.ageGroup, c.ageGroup) && is(f.weight, c.weightCategory);

/** Does a player pass the age, state and district filters? */
export const matchesPlayer = (f: Filters, p: { age?: number | null; state?: string | null; district?: string | null }) =>
  is(f.age, p.age) && is(f.state, p.state?.trim()) && is(f.district, p.district?.trim());

/**
 * Category options from a list of categories: age groups for the chosen gender, and weights for the
 * chosen gender and age group, so the weight list never offers a class that can't match.
 */
export function categoryOptions(f: Filters, items: { ageGroup: string; gender: string; weightCategory: string }[]) {
  const forGender = items.filter((c) => is(f.gender, c.gender));
  return {
    ageGroups: distinct(forGender.map((c) => c.ageGroup)),
    weights: sortWeights(forGender.filter((c) => is(f.ageGroup, c.ageGroup)).map((c) => c.weightCategory)),
  };
}

// ─── The bar ─────────────────────────────────────────────────────────────────

export type FilterOptions = {
  ageGroups?: string[];
  weights?: string[];
  ages?: number[];
  states?: string[];
  /** Districts, optionally per state so the list follows the chosen state */
  districts?: string[] | Record<string, string[]>;
};

const GENDERS: { value: GenderFilter; label: string }[] = [
  { value: ALL, label: "All" },
  { value: "MALE", label: "Boys" },
  { value: "FEMALE", label: "Girls" },
];

export function TournamentFilters({ fields, filters, onChange, options, total, shown, searchPlaceholder = "Search", className }: {
  fields: FilterField[];
  filters: Filters;
  onChange: (f: Filters) => void;
  options: FilterOptions;
  /** For "Showing x of y" */
  total: number;
  shown: number;
  searchPlaceholder?: string;
  className?: string;
}) {
  const has = (f: FilterField) => fields.includes(f);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const active = (Object.keys(emptyFilters) as (keyof Filters)[]).filter((k) => filters[k] !== emptyFilters[k]).length;

  const districts = useMemo(() => {
    const d = options.districts;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return filters.state === ALL ? distinct(Object.values(d).flat()) : d[filters.state] ?? [];
  }, [options.districts, filters.state]);

  // A chosen value that's no longer on offer (e.g. weight after changing category) is shown but marked.
  const keep = (list: string[] | undefined, value: string) => (value !== ALL && list && !list.includes(value) ? [...list, value] : list ?? []);

  const selects: { field: FilterField; label: string; value: string; values: string[]; onPick: (v: string) => void; format?: (v: string) => string }[] = [
    { field: "weight", label: "Weight", value: filters.weight, values: keep(options.weights, filters.weight), onPick: (v) => set({ weight: v }) },
    { field: "age", label: "Age", value: filters.age, values: keep((options.ages ?? []).map(String), filters.age), onPick: (v) => set({ age: v }), format: (v) => `${v} years` },
    { field: "state", label: "State", value: filters.state, values: keep(options.states, filters.state), onPick: (v) => set({ state: v, district: ALL }) },
    { field: "district", label: "District", value: filters.district, values: keep(districts, filters.district), onPick: (v) => set({ district: v }) },
  ];
  const shownSelects = selects.filter((s) => has(s.field));

  return (
    <div className={cx("space-y-3 border-b border-slate-100 p-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {has("search") && (
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder={searchPlaceholder} value={filters.q} onChange={(e) => set({ q: e.target.value })} className="pl-10 pr-9" aria-label="Search" />
            {filters.q && (
              <button type="button" onClick={() => set({ q: "" })} className="absolute inset-y-0 right-2 my-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:text-slate-700" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {has("gender") && (
          <div role="radiogroup" aria-label="Gender" className="inline-flex shrink-0 self-start rounded-xl bg-slate-100 p-1 sm:self-auto">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                role="radio"
                aria-checked={filters.gender === g.value}
                onClick={() => set({ gender: g.value, ageGroup: ALL, weight: ALL })}
                className={cx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                  filters.gender === g.value
                    ? g.value === "MALE" ? "bg-blue-600 text-white shadow-sm" : g.value === "FEMALE" ? "bg-pink-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {g.value === ALL && <Users size={14} />}
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {has("ageGroup") && (options.ageGroups?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
          {[ALL, ...(options.ageGroups ?? [])].map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={filters.ageGroup === g}
              onClick={() => set({ ageGroup: g, weight: ALL })}
              className={cx(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                filters.ageGroup === g ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {g === ALL ? "All categories" : g}
            </button>
          ))}
        </div>
      )}

      {(shownSelects.length > 0 || active > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {shownSelects.length > 0 && <SlidersHorizontal size={15} className="text-slate-400" aria-hidden />}
          {shownSelects.map((s) => (
            <Select
              key={s.field}
              value={s.value}
              onChange={(e) => s.onPick(e.target.value)}
              aria-label={s.label}
              disabled={!s.values.length && s.value === ALL}
              className={cx("h-9 w-auto min-w-36 py-1 text-sm", s.value !== ALL && "border-brand/50 bg-brand-soft/40 font-semibold text-slate-900")}
            >
              <option value={ALL}>{s.field === "age" ? "Any age" : `All ${s.label.toLowerCase()}s`}</option>
              {s.values.map((v) => <option key={v} value={v}>{s.format ? s.format(v) : v}</option>)}
            </Select>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {shown === total ? `${total} shown` : `Showing ${shown} of ${total}`}
          </span>
          {active > 0 && (
            <button type="button" onClick={() => onChange(emptyFilters)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft">
              <X size={13} /> Clear filters ({active})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
