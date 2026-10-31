import type { Gender, Meta } from "./types";

/** Mirror of the backend rule: age = tournament year − birth year. */
export function eligibleAgeGroups(meta: Meta, dob: string, tournamentDate: string, allowed: string[]): string[] {
  if (!dob) return [];
  const age = new Date(tournamentDate).getFullYear() - new Date(dob).getFullYear();
  return meta.ageGroups.filter((g) => allowed.includes(g.name) && age >= g.minAge && age <= g.maxAge).map((g) => g.name);
}

export function weightClassesFor(meta: Meta, ageGroup: string, gender: Gender): string[] {
  return meta.ageGroups.find((g) => g.name === ageGroup)?.weightClasses[gender] ?? [];
}

export function weightClassFor(meta: Meta, ageGroup: string, gender: Gender, weightKg: number): string {
  const classes = weightClassesFor(meta, ageGroup, gender);
  if (!classes.length || !weightKg) return "";
  const match = classes.find((c) => c.startsWith("-") && weightKg <= parseFloat(c.slice(1)));
  return match ?? classes[classes.length - 1]!;
}
