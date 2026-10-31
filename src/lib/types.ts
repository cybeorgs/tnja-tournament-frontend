export type Gender = "MALE" | "FEMALE";
export type Placement = "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION";
export type TournamentStatus = "DRAFT" | "PUBLISHED" | "COMPLETED";

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
  startDate: string;
  endDate: string | null;
  level: string;
  gender: "MALE" | "FEMALE" | "BOTH";
  ageGroups: string[];
  entryFee: number;
  numberOfMats: number;
  registrationOpen: boolean;
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
  stats: { registrations: number; paid: number; collected: number; referees: number; categories: number; draws: number; concludedDraws: number };
}

export interface Student {
  id: string;
  /** Permanent student ID, e.g. TNJA-S-000123 */
  studentNo: string;
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: Gender;
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
}

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
  amountPaid: number;
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
