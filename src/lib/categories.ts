import type { Gender, Meta } from "./types";

/** Mirror of the backend rule: age = tournament year − birth year. */
export function competitionAge(dob: string, tournamentDate: string): number {
  return new Date(tournamentDate).getFullYear() - new Date(dob).getFullYear();
}

/** Age groups a player may enter: their own group plus the older groups they may play up into
 *  (Cadet 15–17 → Cadet, Junior, Senior · Junior 18–20 → Junior, Senior · Senior 21+ → Senior). */
export function eligibleAgeGroups(meta: Meta, dob: string, tournamentDate: string, allowed: string[]): string[] {
  if (!dob) return [];
  const age = competitionAge(dob, tournamentDate);
  return meta.ageGroups
    .filter((g) => allowed.includes(g.name) && age >= (g.playUpFrom ?? g.minAge) && age <= g.maxAge)
    .map((g) => g.name);
}

/** The group whose own age band contains `age` (e.g. 16 → Cadet), regardless of what a tournament contests. */
export function ownAgeGroup(meta: Meta, age: number): string | undefined {
  return meta.ageGroups.find((g) => age >= g.minAge && age <= g.maxAge)?.name;
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
