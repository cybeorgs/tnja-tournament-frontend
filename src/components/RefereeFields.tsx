"use client";

import type { Referee } from "@/lib/types";
import { Field, Input, Select } from "./ui";

export type RefereeInput = Pick<Referee, "fullName" | "grade" | "district" | "phone" | "email">;

export const emptyReferee: RefereeInput = { fullName: "", grade: "", district: "", phone: "", email: "" };

const GRADES = ["", "International", "Continental", "National A", "National B", "State", "District"];

export function RefereeFields({ value, onChange }: { value: RefereeInput; onChange: (v: RefereeInput) => void }) {
  const set = <K extends keyof RefereeInput>(k: K, v: RefereeInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" className="sm:col-span-2">
        <Input value={value.fullName} onChange={(e) => set("fullName", e.target.value)} required autoFocus />
      </Field>
      <Field label="Grade / licence">
        <Select value={GRADES.includes(value.grade) ? value.grade : ""} onChange={(e) => set("grade", e.target.value)}>
          {GRADES.map((g) => <option key={g} value={g}>{g || "—"}</option>)}
        </Select>
      </Field>
      <Field label="District">
        <Input value={value.district} onChange={(e) => set("district", e.target.value)} />
      </Field>
      <Field label="Phone" hint="Used by the referee to find their certificate">
        <Input type="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} />
      </Field>
    </div>
  );
}
