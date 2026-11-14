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
  /** Society registration number, e.g. 329-2017: shown next to the name on the site and on every PDF */
  regNo: string;
  signatory1Name: string;
  signatory1Title: string;
  signatory2Name: string;
  signatory2Title: string;
  hasLogo: boolean;
  /** false while the built-in TNJA logo is used */
  customLogo?: boolean;
  updatedAt: string;
  /** Public settings only: entry fees can be paid online (Razorpay) */
  onlinePayment?: boolean;
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
  /** Date and time the tournament starts */
  startDate: string;
  endDate: string | null;
  /** Registration opens */
  registrationOpensAt: string;
  /** Registration closes (there is no late registration) */
  registrationClosesAt: string;
  /** Fee for a player's first category (age group), in rupees; 0 = free */
  entryFee: number;
  /** Fee for each further category the same player enters (never more than entryFee) */
  additionalEntryFee: number;
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
    /** Entries paid / still unpaid, and the amounts */
    paidEntries: number;
    unpaidEntries: number;
    amountCollected: number;
    amountDue: number;
    /** Entries whose weigh-in is cleared */
    weighedIn: number;
  };
}

export type ParticipantType = "STUDENT" | "PROFESSIONAL";
export type Representing = "DISTRICT" | "UNIT";

export interface Unit {
  id: string;
  name: string;
  /** Admin list only: players representing it */
  players?: number;
}
export const PARTICIPANT_TYPE_LABEL: Record<ParticipantType, string> = { STUDENT: "Student", PROFESSIONAL: "Working professional" };
export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = { PRIVATE: "Private", GOVERNMENT: "Government", SELF_EMPLOYED: "Self-employed", OTHER: "Other" };

export interface Student {
  id: string;
  /** Permanent ID: TNJA-S-000123 (student) or TNJA-P-000123 (working professional); null until an application from outside Tamil Nadu is approved */
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
  /** Who they play for (overall championship): a district or a unit from Admin → Settings → Units. "" on older records. */
  representing: Representing | "";
  representingDistrict: string;
  representingUnit: string;
  bloodGroup: string;
  aadhaarNumber: string | null;
  alternatePhone: string;
  parentPhone: string;
  emergencyPhone: string;
  email: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  annualIncome: number | null;
  /** Student or working professional (same categories and fees; education vs occupation details) */
  participantType: ParticipantType;
  institutionType: string;
  institutionName: string;
  grade: string;
  degreeDepartment: string;
  /** Working professionals: PRIVATE | GOVERNMENT | SELF_EMPLOYED | OTHER */
  employmentType: string;
  organisationName: string;
  /** Designation / role */
  occupation: string;
  /** The coach who first trained the player (printed on the entry pass) */
  rootCoach: string;
  /** Additional details, printed on the Tournament Entry Pass */
  weightKg: number | null;
  managerName: string;
  districtPresident: string;
  districtSecretary: string;
  source: "SELF" | "ADMIN";
  createdAt: string;
  /** Set by the database on every change (read-only) */
  updatedAt: string;
  _count?: { registrations: number };
}

export interface StudentDetail extends Student {
  registrations: (Registration & { tournament: { id: string; title: string; startDate: string } })[];
  documents: { kind: DocumentKind; label: string; mime: string }[];
}

export type DocumentKind = "PHOTO" | "BPL_PROOF" | "NATIVITY_PROOF";

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
  /** Amount due (unpaid) or charged (paid), in rupees */
  fee: number;
  paymentStatus: PaymentStatus;
  /** RAZORPAY (online) | CASH | UPI | OTHER, once paid */
  paymentMode: string | null;
  amountPaid: number;
  paidAt: string | null;
  /** The event's Tournament Entry Pass was emailed */
  hallTicketSentAt: string | null;
  createdAt: string;
  student: Student;
}

/** PENDING = unpaid · PAID · WAIVED = free tournament */
export type PaymentStatus = "PENDING" | "PAID" | "WAIVED";

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
 * NOT_OPEN before it opens · OPEN until registrationClosesAt · CLOSED from then on. There is no late registration.
 */
export type RegistrationPhase = "NOT_OPEN" | "OPEN" | "CLOSED";

type ScheduleFields = Pick<Tournament, "registrationOpensAt" | "registrationClosesAt" | "startDate" | "status">;

export function registrationPhase(t: ScheduleFields, now = new Date()): RegistrationPhase {
  if (t.status === "COMPLETED" || now >= new Date(t.startDate) || now >= new Date(t.registrationClosesAt)) return "CLOSED";
  return now < new Date(t.registrationOpensAt) ? "NOT_OPEN" : "OPEN";
}

/** The next moment the phase changes (open, close, start), so pages can update right then. */
export function nextPhaseChange(t: ScheduleFields, now = new Date()): Date | null {
  return [t.registrationOpensAt, t.registrationClosesAt, t.startDate].map((d) => new Date(d)).find((d) => d > now) ?? null;
}

export type WeighInStatus = "PENDING" | "CLEARED" | "DISQUALIFIED";
