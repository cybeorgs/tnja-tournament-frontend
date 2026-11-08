"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

export type DistrictTaluks = { district: string; taluks: string[] };
/**
 * A Tamil Nadu pincode gives the district and candidate taluks; elsewhere just the state and district.
 * `found` is false when the India Post directory has no record of it (the pincode is still accepted);
 * `district` is "" when it couldn't be worked out and the student picks it.
 */
export type PincodeMatch = { pincode: string; found?: boolean; inTamilNadu: boolean; state: string; district: string; taluks: string[]; postOffices: string[] };

/** An Indian PIN: exactly 6 digits, the first 1–9 (no Indian PIN starts with 0). Same rule as the backend. */
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;
export const isValidPincode = (value: string) => PINCODE_PATTERN.test(value);
/** Why a pincode isn't valid, or null if it is. */
export function pincodeProblem(value: string, label = "Pincode"): string | null {
  if (!value) return `Please enter the ${label.toLowerCase()}.`;
  if (/\D/.test(value)) return `${label} can only contain numbers.`;
  if (value.length !== 6) return `${label} must be exactly 6 digits.`;
  if (value.startsWith("0")) return `${label} can't start with 0.`;
  return null;
}

let cache: DistrictTaluks[] | null = null;

/** Districts and their taluks (loaded once per page). */
export function useLocations() {
  const [locations, setLocations] = useState<DistrictTaluks[]>(cache ?? []);
  useEffect(() => {
    if (cache) return;
    api<DistrictTaluks[]>("/public/locations")
      .then((l) => setLocations((cache = l)))
      .catch(() => {});
  }, []);
  return locations;
}

export const lookupPincode = (pincode: string) => api<PincodeMatch>(`/public/locations/pincode/${pincode}`);
