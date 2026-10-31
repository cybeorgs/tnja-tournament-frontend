import type { Placement } from "./types";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateRange(start: string, end: string | null): string {
  if (!end || start.slice(0, 10) === end.slice(0, 10)) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

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

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const WIN_METHOD_LABEL: Record<string, string> = {
  IPPON: "Ippon",
  WAZA_ARI: "Waza-ari",
  HANSOKU_MAKE: "Hansoku-make",
  DECISION: "Decision (Golden score / Hantei)",
  FUSEN_GACHI: "Fusen-gachi (opponent absent)",
  KIKEN_GACHI: "Kiken-gachi (opponent withdrew)",
};
