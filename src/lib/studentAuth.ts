"use client";

import { API_BASE, ApiError } from "./api";

const TOKEN_KEY = "student_token";

/** Student (or parent) session, kept apart from the admin session. */
export const studentAuth = {
  getToken: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

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
    if (res.status === 401 && token) {
      studentAuth.clear();
      window.location.href = "/student/login";
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
  email: string;
  nationality: string;
  residingPincode: string;
  district: string;
  taluk: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
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
  isLate: boolean;
  weighInStatus: "PENDING" | "CLEARED" | "DISQUALIFIED";
  tournament: { id: string; slug: string; title: string; startDate: string; endDate: string | null; venue: string; city: string; status: "PUBLISHED" | "COMPLETED" };
}
