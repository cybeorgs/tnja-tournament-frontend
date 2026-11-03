"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

export type DistrictTaluks = { district: string; taluks: string[] };
/** A Tamil Nadu pincode gives the district and candidate taluks; elsewhere just the state and district. */
export type PincodeMatch = { pincode: string; inTamilNadu: boolean; state: string; district: string; taluks: string[]; postOffices: string[] };

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
