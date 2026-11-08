"use client";

import { API_BASE, ApiError } from "./api";
import type { ParticipantType, PaymentStatus } from "./types";

const TOKEN_KEY = "student_token";

/** Whether a JWT's "exp" has passed (or it can't be read). Only a hint: the API still checks every token. */
function expired(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/** Student (or parent) session, kept apart from the admin session. An expired session counts as logged out. */
export const studentAuth = {
  getToken: () => {
    if (typeof window === "undefined") return null;
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && expired(token)) {
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return token;
    } catch {
      return null;
    }
  },
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Same rules as the API: 8–72 characters with at least one letter and one number. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Password must be at most 72 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  return null;
}
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number";

/** Call a /student endpoint with the student's token; an expired session goes back to the login page. */
export async function studentApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = studentAuth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method || (init.body !== undefined ? "POST" : "GET"),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // A session that is no longer valid (expired, or the password was changed elsewhere): log in again.
    // Not on the login page itself, where a 401 just means a wrong password.
    if (res.status === 401 && token && !path.startsWith("/student-auth/")) {
      studentAuth.clear();
      window.location.replace("/student/login");
    }
    throw new ApiError(res.status, (body && (body.error || body.message)) || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface MyStudent {
  id: string;
  studentNo: string | null;
  /** Shown while waiting for approval (can be used to log in) */
  tempId: string | null;
  fullName: string;
  gender: string;
  dob: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  reviewNote: string;
  outsideTamilNadu: boolean;
  // Registration details, shown on the dashboard
  fatherName: string;
  motherName: string;
  bloodGroup: string;
  /** Masked: only the last 4 digits */
  aadhaarNumber: string | null;
  phone: string;
  alternatePhone: string;
  parentPhone: string;
  emergencyPhone: string;
  email: string;
  nationality: string;
  residingPincode: string;
  district: string;
  taluk: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  participantType: ParticipantType;
  employmentType: string;
  organisationName: string;
  occupation: string;
  institutionType: string;
  institutionName: string;
  grade: string;
  degreeDepartment: string;
  club: string;
  coachName: string;
  belt: string;
  registrations: MyRegistration[];
}

export interface MyRegistration {
  id: string;
  ageGroup: string;
  weightCategory: string;
  weightKg: number;
  placement: string | null;
  fee: number;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  paidAt: string | null;
  weighInStatus: "PENDING" | "CLEARED" | "DISQUALIFIED";
  tournament: { id: string; slug: string; title: string; startDate: string; endDate: string | null; venue: string; city: string; status: "PUBLISHED" | "COMPLETED" };
}

/** Open (or save) a PDF from a /student endpoint with the student's token. */
export async function studentPdf(path: string, mode: "view" | "download", filename: string) {
  // Open the tab inside the click handler so the popup blocker allows it.
  const tab = mode === "view" ? window.open("", "_blank") : null;
  try {
    const token = studentAuth.getToken();
    const res = await fetch(`${API_BASE}${path}?download=${mode === "download" ? 1 : 0}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(res.status, (body && (body.error || body.message)) || `Request failed (${res.status})`);
    }
    const url = URL.createObjectURL(new Blob([await res.blob()], { type: "application/pdf" }));
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/[^A-Za-z0-9._-]+/g, "_");
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
