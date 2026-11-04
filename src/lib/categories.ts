import type { Gender, Meta } from "./types";

/** Birth year from a date of birth ("2010-05-14" or an ISO date-time): the year as written, whatever the time zone. */
export const birthYear = (dob: string) => Number(dob.slice(0, 4));

/** The calendar year of a moment in India (the tournament's time zone). */
export const yearInIndia = (iso: string) => Number(new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" }));

/** Mirror of the backend rule: age = tournament year − birth year. The month and day of birth never count. */
export function competitionAge(dob: string, tournamentDate: string): number {
  return yearInIndia(tournamentDate) - birthYear(dob);
}

/** Age groups a player may enter: their own group plus the older groups they may play up into
 *  (Cadet 14–16 → Cadet, Junior, and Senior from 15 · Junior 17–19 → Junior, Senior · Senior 20+ → Senior). */
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
