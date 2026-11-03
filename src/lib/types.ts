/** Competition categories are boys' or girls' only. */
export type Gender = "MALE" | "FEMALE";
export type StudentGender = Gender | "OTHER";
export type StudentStatus = "APPROVED" | "PENDING" | "REJECTED";
export type Placement = "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION";
/** Published as soon as it is created; COMPLETED once it is over. */
export type TournamentStatus = "PUBLISHED" | "COMPLETED";

export interface Settings {
  orgName: string;
  orgShortName: string;
  tagline: string;
  signatory1Name: string;
  signatory1Title: string;
  signatory2Name: string;
  signatory2Title: string;
  hasLogo: boolean;
  /** false while the built-in TNJA logo is used */
  customLogo?: boolean;
  updatedAt: string;
  /** Public settings only: self-registration asks for Aadhaar verification through DigiLocker */
  aadhaarVerification?: boolean;
}

export interface Meta {
  /** minAge–maxAge is the group's own band; younger players may play up into it from playUpFrom */
  ageGroups: { name: string; minAge: number; maxAge: number; playUpFrom?: number; weightClasses: Record<Gender, string[]> }[];
  levels: string[];
  refereeRoles: string[];
  winMethods: string[];
}

export interface Tournament {
  id: string;
  slug: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  /** Date and time the tournament starts; registration closes at this moment */
  startDate: string;
  endDate: string | null;
  /** Registration opens */
  registrationOpensAt: string;
  /** Regular registration ends; late registration runs from here until the start */
  registrationClosesAt: string;
  level: string;
  gender: "MALE" | "FEMALE" | "BOTH";
  ageGroups: string[];
  numberOfMats: number;
  status: TournamentStatus;
  publishedAt: string | null;
  resultsPublished: boolean;
  createdAt: string;
}

export interface TournamentListItem extends Tournament {
  _count: { registrations: number; referees: number; draws: number };
  concludedDraws: number;
}

export interface TournamentDetail extends Tournament {
  stats: {
    /** Entries (a player may enter several age groups) */
    registrations: number;
    referees: number;
    categories: number;
    draws: number;
    concludedDraws: number;
    players: number;
    regularEntries: number;
    lateEntries: number;
    /** Entries whose weigh-in is cleared */
    weighedIn: number;
  };
}

export interface Student {
  id: string;
  /** Permanent student ID, e.g. TNJA-S-000123; null until an application from outside Tamil Nadu is approved */
  studentNo: string | null;
  status: StudentStatus;
  /** Lives outside Tamil Nadu (uploaded proof of nativity, needed approval) */
  outsideTamilNadu: boolean;
  isBPL: boolean;
  /** Why an application was rejected */
  reviewNote: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  /** OTHER students choose boys' or girls' categories when they enter a tournament */
  gender: StudentGender;
  club: string;
  district: string;
  belt: string;
  phone: string;
  taluk: string;
  residingPincode: string;
  bloodGroup: string;
  aadhaarNumber: string | null;
  alternatePhone: string;
  email: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  annualIncome: number | null;
  institutionType: string;
  institutionName: string;
  grade: string;
  degreeDepartment: string;
  coachName: string;
  source: "SELF" | "ADMIN";
  createdAt: string;
  _count?: { registrations: number };
}

export interface StudentDetail extends Student {
  registrations: (Registration & { tournament: { id: string; title: string; startDate: string } })[];
  documents: { kind: DocumentKind; label: string; mime: string }[];
}

export type DocumentKind = "BPL_PROOF" | "NATIVITY_PROOF";

export interface Registration {
  id: string;
  tournamentId: string;
  studentId: string;
  ageGroup: string;
  gender: Gender;
  weightKg: number;
  weightCategory: string;
  /** PENDING (not weighed) | CLEARED (scale weight within the class) | DISQUALIFIED (left out of the draw) */
  weighInStatus: WeighInStatus;
  weighInKg: number | null;
  weighedAt: string | null;
  placement: Placement | null;
  certificateNo: string | null;
  /** Entered during late registration */
  isLate: boolean;
  createdAt: string;
  student: Student;
}

export interface Referee {
  id: string;
  fullName: string;
  grade: string;
  district: string;
  phone: string;
  email: string;
  _count?: { assignments: number };
}

export interface Official {
  id: string;
  role: string;
  matNumber: number | null;
  certificateNo: string;
  referee: Referee;
}

export interface Slot {
  playerId: string | null;
  playerName: string;
  club: string;
  isBye: boolean;
  seedNumber?: number;
}

export interface Score {
  ippon: number;
  wazaAri: number;
  shido: number;
}

export interface Match {
  matchId: string;
  round: number;
  matchNumber: number;
  slotA: Slot;
  slotB: Slot;
  winnerId: string | null;
  status: "PENDING" | "COMPLETED";
  scoreA?: Score;
  scoreB?: Score;
  winMethod?: string;
  isBronze?: boolean;
  byeResolved?: boolean;
  /** Repechage formats: a repechage or bronze-round match, filled from the main bracket */
  repechage?: boolean;
  /** e.g. "Repechage 1", "Bronze 2" */
  label?: string;
}

export type DrawFormat = "ELIMINATION" | "REPECHAGE" | "DOUBLE_REPECHAGE" | "ROUND_ROBIN";
export const DRAW_FORMAT_LABEL: Record<DrawFormat, string> = {
  ELIMINATION: "Single elimination",
  REPECHAGE: "Repechage",
  DOUBLE_REPECHAGE: "Double repechage",
  ROUND_ROBIN: "Round robin",
};
/** Repechage formats need quarter-finals: at least this many players */
export const REPECHAGE_MIN = 5;

export interface Entrant {
  id: string;
  name: string;
  club: string;
}

export interface Standing {
  entrantId: string;
  wins: number;
  losses: number;
  points: number;
}

export interface Draw {
  id: string;
  tournamentId: string;
  ageGroup: string;
  gender: Gender;
  weightCategory: string;
  format: DrawFormat;
  matNumber: number;
  entrants: Entrant[];
  rounds: Match[][];
  isConcluded: boolean;
  placements: Record<string, Placement>;
  complete: boolean;
  standings: Standing[] | null;
  matchesTotal: number;
  matchesDone: number;
}

export interface CategorySummary {
  ageGroup: string;
  gender: Gender;
  weightCategory: string;
  entrants: number;
  /** Weigh-in progress of the players taking part (disqualified ones are counted separately) */
  weighIn: { cleared: number; pending: number; disqualified: number };
  draw: null | {
    id: string;
    format: Draw["format"];
    isConcluded: boolean;
    matNumber: number;
    matchesTotal: number;
    matchesDone: number;
    complete: boolean;
    notInDraw: number;
  };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Registration runs on the tournament's schedule (the backend enforces the same rules):
 * NOT_OPEN before it opens · OPEN (regular) · LATE (late registration) until the start · CLOSED from the start.
 * Registration is free.
 */
export type RegistrationPhase = "NOT_OPEN" | "OPEN" | "LATE" | "CLOSED";

type ScheduleFields = Pick<Tournament, "registrationOpensAt" | "registrationClosesAt" | "startDate" | "status">;

export function registrationPhase(t: ScheduleFields, now = new Date()): RegistrationPhase {
  if (t.status === "COMPLETED" || now >= new Date(t.startDate)) return "CLOSED";
  if (now < new Date(t.registrationOpensAt)) return "NOT_OPEN";
  return now < new Date(t.registrationClosesAt) ? "OPEN" : "LATE";
}

/** The next moment the phase changes (open, regular close, start), so pages can update right then. */
export function nextPhaseChange(t: ScheduleFields, now = new Date()): Date | null {
  return [t.registrationOpensAt, t.registrationClosesAt, t.startDate].map((d) => new Date(d)).find((d) => d > now) ?? null;
}

export type WeighInStatus = "PENDING" | "CLEARED" | "DISQUALIFIED";
