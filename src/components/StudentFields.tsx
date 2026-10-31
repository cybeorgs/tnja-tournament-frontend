"use client";

import type { Gender, Student } from "@/lib/types";
import { toDateInput } from "@/lib/format";
import { Field, Input, Select } from "./ui";

export type StudentInput = Pick<Student, "fullName" | "club" | "district" | "belt" | "phone"> & { dob: string; gender: Gender | "" };

export const emptyStudent: StudentInput = { fullName: "", dob: "", gender: "", club: "", district: "", belt: "", phone: "" };

export const fromStudent = (s: Student): StudentInput => ({
  fullName: s.fullName, dob: toDateInput(s.dob), gender: s.gender, club: s.club, district: s.district, belt: s.belt, phone: s.phone,
});

const BELTS = ["", "White", "Yellow", "Orange", "Green", "Blue", "Brown", "Black"];

export function StudentFields({ value, onChange, lockGender }: { value: StudentInput; onChange: (v: StudentInput) => void; lockGender?: Gender }) {
  const set = <K extends keyof StudentInput>(k: K, v: StudentInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" className="sm:col-span-2">
        <Input value={value.fullName} onChange={(e) => set("fullName", e.target.value)} required autoFocus />
      </Field>
      <Field label="Date of birth">
        <Input type="date" value={value.dob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("dob", e.target.value)} required />
      </Field>
      <Field label="Gender">
        <Select value={lockGender ?? value.gender} disabled={!!lockGender} onChange={(e) => set("gender", e.target.value as Gender)} required>
          <option value="">Select…</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </Select>
      </Field>
      <Field label="Club">
        <Input value={value.club} onChange={(e) => set("club", e.target.value)} />
      </Field>
      <Field label="District">
        <Input value={value.district} onChange={(e) => set("district", e.target.value)} />
      </Field>
      <Field label="Belt">
        <Select value={value.belt} onChange={(e) => set("belt", e.target.value)}>
          {BELTS.map((b) => <option key={b} value={b}>{b || "—"}</option>)}
        </Select>
      </Field>
      <Field label="Phone">
        <Input type="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
    </div>
  );
}
