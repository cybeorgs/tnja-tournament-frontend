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
  updatedAt: string;
  /** Public settings only: self-registration asks for Aadhaar verification through DigiLocker */
  aadhaarVerification?: boolean;
}

export interface Meta {
  ageGroups: { name: string; minAge: number; maxAge: number; weightClasses: Record<Gender, string[]> }[];
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
  /** Registration opens (regular fee) */
  registrationOpensAt: string;
  /** Regular registration ends; late registration at 2 × the fee runs until the start */
  registrationClosesAt: string;
  /** When the deadline reminder is emailed to players with unpaid entries; null = none */
  reminderAt: string | null;
  level: string;
  gender: "MALE" | "FEMALE" | "BOTH";
  ageGroups: string[];
  /** Regular entry fee */
  entryFee: number;
  /** Late entry fee set by the admin (not lower than the regular fee) */
  lateEntryFee: number;
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
    paid: number;
    collected: number;
    referees: number;
    categories: number;
    draws: number;
    concludedDraws: number;
    players: number;
    /** Players with every entry settled */
    paidPlayers: number;
    playersOwing: number;
    pendingPayments: number;
    pendingAmount: number;
    regularEntries: number;
    lateEntries: number;
    regularRevenue: number;
    lateRevenue: number;
  };
}

export type EmailKind = "CONFIRMATION" | "REMINDER" | "PAYMENT";

export interface EmailLogEntry {
  id: string;
  studentId: string | null;
  studentName: string | null;
  kind: EmailKind;
  trigger: "AUTO" | "MANUAL";
  toEmail: string;
  subject: string;
  status: "SENT" | "FAILED" | "NOT_CONFIGURED";
  error: string;
  createdAt: string;
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
  placement: Placement | null;
  certificateNo: string | null;
  paymentStatus: "PENDING" | "PAID" | "WAIVED";
  paymentMode: string | null;
  /** Entered during late registration */
  isLate: boolean;
  /** What this entry costs (entry fee, or late entry fee for a late entry) */
  fee: number;
  amountPaid: number;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
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
}

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
  format: "ELIMINATION" | "ROUND_ROBIN";
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
  paid: number;
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
 * NOT_OPEN before it opens · OPEN at the entry fee · LATE at the admin's late entry fee until the start · CLOSED from the start.
 * Unpaid entries owe the fee of the period they are paid in.
 */
export type RegistrationPhase = "NOT_OPEN" | "OPEN" | "LATE" | "CLOSED";

type ScheduleFields = Pick<Tournament, "registrationOpensAt" | "registrationClosesAt" | "startDate" | "entryFee" | "lateEntryFee" | "status">;

export function registrationPhase(t: ScheduleFields, now = new Date()): RegistrationPhase {
  if (t.status === "COMPLETED" || now >= new Date(t.startDate)) return "CLOSED";
  if (now < new Date(t.registrationOpensAt)) return "NOT_OPEN";
  return now < new Date(t.registrationClosesAt) ? "OPEN" : "LATE";
}

export const lateEntryFee = (t: Pick<Tournament, "lateEntryFee">) => t.lateEntryFee;

/** Fee for an entry made now: the late entry fee during late registration. */
export const currentEntryFee = (t: ScheduleFields, now = new Date()) => (registrationPhase(t, now) === "LATE" ? lateEntryFee(t) : t.entryFee);

/** The next moment the phase changes (open, regular close, start), so pages can update right then. */
export function nextPhaseChange(t: ScheduleFields, now = new Date()): Date | null {
  return [t.registrationOpensAt, t.registrationClosesAt, t.startDate].map((d) => new Date(d)).find((d) => d > now) ?? null;
}
