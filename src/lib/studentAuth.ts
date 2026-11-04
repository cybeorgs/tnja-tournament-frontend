"use client";

import { API_BASE, ApiError } from "./api";
import type { PaymentStatus } from "./types";

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
