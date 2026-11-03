import type { Placement } from "./types";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateRange(start: string, end: string | null): string {
  if (!end || start.slice(0, 10) === end.slice(0, 10)) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** e.g. "3 Nov 2026, 9:00 am" in the viewer's time zone */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Local yyyy-mm-dd and HH:MM of a moment, for date and time inputs */
export function toLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** A local date (yyyy-mm-dd) and time (HH:MM) as an ISO moment, or "" if either is missing */
export const fromLocalParts = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : "");

/** yyyy-mm-dd for <input type="date"> */
export const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const categoryLabel = (c: { ageGroup: string; gender: string; weightCategory: string }) =>
  `${c.ageGroup} · ${c.gender === "FEMALE" ? "Girls" : "Boys"} · ${c.weightCategory}`;

export const PLACEMENT_LABEL: Record<Placement, string> = {
  FIRST: "1st Place",
  SECOND: "2nd Place",
  THIRD: "3rd Place",
  PARTICIPATION: "Participant",
};

export const GENDER_LABEL: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const WIN_METHOD_LABEL: Record<string, string> = {
  IPPON: "Ippon",
  WAZA_ARI: "Waza-ari",
  HANSOKU_MAKE: "Hansoku-make",
  DECISION: "Decision (Golden score / Hantei)",
  FUSEN_GACHI: "Fusen-gachi (opponent absent)",
  KIKEN_GACHI: "Kiken-gachi (opponent withdrew)",
};
