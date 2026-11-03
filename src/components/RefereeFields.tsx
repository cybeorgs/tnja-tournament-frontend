"use client";

import type { Referee } from "@/lib/types";
import { useLocations } from "@/lib/locations";
import { Field, Input, Select } from "./ui";
import { PhoneInput } from "./StudentFields";

export type RefereeInput = Pick<Referee, "fullName" | "grade" | "district" | "phone" | "email">;

export const emptyReferee: RefereeInput = { fullName: "", grade: "", district: "", phone: "", email: "" };

const GRADES = ["", "International", "Continental", "National A", "National B", "State", "District"];

/** Client-side check before saving; the API validates the same rules. */
export function validateReferee(f: RefereeInput): string | null {
  if (f.fullName.trim().length < 2) return "Please fill in the referee's name.";
  if (f.phone && !/^[6-9]\d{9}$/.test(f.phone)) return "Mobile number isn't valid.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Please fill in a valid email.";
  return null;
}

export function RefereeFields({ value, onChange }: {
  value: RefereeInput;
  onChange: (v: RefereeInput) => void;
}) {
  const locations = useLocations();
  const set = <K extends keyof RefereeInput>(k: K, v: RefereeInput[K]) => onChange({ ...value, [k]: v });
  // Keep a district typed in before the list existed selectable.
  const districts = locations.map((d) => d.district);
  if (value.district && !districts.includes(value.district)) districts.unshift(value.district);

  return (
    <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
      <Field label="Full name" required className="sm:col-span-2">
        <Input value={value.fullName} onChange={(e) => set("fullName", e.target.value)} autoFocus />
      </Field>
      <Field label="Grade">
        <Select value={GRADES.includes(value.grade) ? value.grade : ""} onChange={(e) => set("grade", e.target.value)}>
          {GRADES.map((g) => <option key={g} value={g}>{g || "Select"}</option>)}
        </Select>
      </Field>
      <Field label="District">
        <Select value={value.district} onChange={(e) => set("district", e.target.value)}>
          <option value="">Select</option>
          {districts.map((d) => <option key={d}>{d}</option>)}
        </Select>
      </Field>
      <Field label="Mobile" hint="Used to find their certificate" className="sm:col-span-2">
        <PhoneInput value={value.phone} onChange={(v) => set("phone", v)} />
      </Field>
<Field label="Email" required hint="Becomes the username for logging in" className="sm:col-span-2">
        <Input type="email" placeholder="name@example.com" value={value.email} onChange={(e) => set("email", e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, ""))} />
      </Field>
    </div>
  );
}
