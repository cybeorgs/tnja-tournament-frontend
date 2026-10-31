"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, GraduationCap, Home, Loader2, MapPin, Medal, UserRound, Wallet } from "lucide-react";
import type { Gender, Student } from "@/lib/types";
import { toDateInput } from "@/lib/format";
import { lookupPincode, useLocations } from "@/lib/locations";
import { Field, Input, Select, cx } from "./ui";
import { EmailOtpField, type EmailOtp } from "./EmailOtpField";

/**
 * Full student registration form (same details as the main TNJA player registration).
 * Used by the public /register page, the admin Students page and a tournament's "new student" entry.
 */
export type StudentInput = {
  district: string; taluk: string; residingPincode: string;
  fullName: string; fatherName: string; motherName: string; gender: Gender | ""; dob: string;
  bloodGroup: string; aadhaarNumber: string; phone: string; alternatePhone: string; email: string; nationality: string;
  address: string; city: string; state: string; pincode: string;
  annualIncome: string;
  institutionType: string; institutionName: string; grade: string; degreeDepartment: string;
  club: string; coachName: string; belt: string;
};

export const emptyStudent: StudentInput = {
  district: "", taluk: "", residingPincode: "",
  fullName: "", fatherName: "", motherName: "", gender: "", dob: "",
  bloodGroup: "", aadhaarNumber: "", phone: "", alternatePhone: "", email: "", nationality: "Indian",
  address: "", city: "", state: "Tamil Nadu", pincode: "",
  annualIncome: "",
  institutionType: "SCHOOL", institutionName: "", grade: "", degreeDepartment: "",
  club: "", coachName: "", belt: "",
};

export const fromStudent = (s: Student): StudentInput => ({
  district: s.district, taluk: s.taluk, residingPincode: s.residingPincode,
  fullName: s.fullName, fatherName: s.fatherName, motherName: s.motherName, gender: s.gender, dob: toDateInput(s.dob),
  bloodGroup: s.bloodGroup, aadhaarNumber: s.aadhaarNumber ?? "", phone: s.phone, alternatePhone: s.alternatePhone, email: s.email, nationality: s.nationality || "Indian",
  address: s.address, city: s.city, state: s.state || "Tamil Nadu", pincode: s.pincode,
  annualIncome: s.annualIncome === null ? "" : String(s.annualIncome),
  institutionType: s.institutionType || "SCHOOL", institutionName: s.institutionName, grade: s.grade, degreeDepartment: s.degreeDepartment,
  club: s.club, coachName: s.coachName, belt: s.belt,
});

const MOBILE = /^[6-9]\d{9}$/;
const PINCODE = /^[1-9]\d{5}$/;

/** Client-side check before saving; the API validates the same rules. */
export function validateStudent(f: StudentInput): string | null {
  const missing: [keyof StudentInput, string][] = [
    ["district", "district"], ["taluk", "taluk"], ["fullName", "full name"], ["fatherName", "father's name"], ["motherName", "mother's name"],
    ["gender", "gender"], ["dob", "date of birth"], ["bloodGroup", "blood group"], ["email", "email"], ["nationality", "nationality"],
    ["address", "address"], ["city", "city"], ["state", "state"], ["annualIncome", "annual income"], ["institutionName", "institution name"], ["grade", "standard / year"],
  ];
  const gap = missing.find(([k]) => !String(f[k]).trim());
  if (gap) return `Please fill in the ${gap[1]}.`;
  if (!PINCODE.test(f.residingPincode)) return "Location pincode must be 6 digits.";
  if (!PINCODE.test(f.pincode)) return "Address pincode must be 6 digits.";
  if (!/^\d{12}$/.test(f.aadhaarNumber)) return "Aadhaar number must be 12 digits.";
  if (!MOBILE.test(f.phone)) return "Enter a valid 10-digit mobile number.";
  if (f.alternatePhone && !MOBILE.test(f.alternatePhone)) return "Alternate mobile number isn't valid.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "Enter a valid email address.";
  return null;
}

const BLOOD_GROUPS = ["O+ve", "O-ve", "A+ve", "A-ve", "B+ve", "B-ve", "AB+ve", "AB-ve"];
const STANDARDS = Array.from({ length: 12 }, (_, i) => `${i + 1}${["st", "nd", "rd"][i] ?? "th"} Standard`);
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const BELTS = ["", "White", "Yellow", "Orange", "Green", "Blue", "Brown", "Black"];

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const letters = (v: string) => v.replace(/[^A-Za-z\s.'-]/g, "");

function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function StudentFields({ value, onChange, lockGender, emailOtp, savedEmail }: {
  value: StudentInput;
  onChange: (v: StudentInput) => void;
  lockGender?: Gender;
  /** Require the email to be verified with a code */
  emailOtp?: EmailOtp;
  /** Email already on file (editing); keeping it needs no new code */
  savedEmail?: string;
}) {
  const locations = useLocations();
  const set = <K extends keyof StudentInput>(k: K, v: StudentInput[K]) => onChange({ ...value, [k]: v });
  const taluks = locations.find((d) => d.district === value.district)?.taluks ?? [];
  const pincode = usePincodeFill(value, onChange);

  const latestDob = new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().slice(0, 10);
  const age = ageFrom(value.dob);
  const school = value.institutionType === "SCHOOL";
  const institutionLabel = school ? "School name" : value.institutionType === "COLLEGE" ? "College name" : "Institute name";

  return (
    <div className="space-y-8">
      <Section icon={<MapPin />} title="Location">
        <Field
          label="Pincode"
          required
          error={pincode?.error}
          hint={
            pincode?.loading ? (
              <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Finding your area…</span>
            ) : pincode?.text ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600"><Check size={13} /> {pincode.text}</span>
            ) : undefined
          }
        >
          <Input inputMode="numeric" placeholder="e.g. 641001" value={value.residingPincode} onChange={(e) => set("residingPincode", digits(e.target.value, 6))} aria-invalid={!!pincode?.error} />
        </Field>
        <Field label="District" required>
          <Select value={value.district} onChange={(e) => onChange({ ...value, district: e.target.value, taluk: "" })}>
            <option value="">Select</option>
            {locations.map((d) => <option key={d.district}>{d.district}</option>)}
          </Select>
        </Field>
        <Field label="Taluk" required>
          <Select value={value.taluk} onChange={(e) => set("taluk", e.target.value)} disabled={!value.district}>
            <option value="">{value.district ? "Select" : "Pick a district first"}</option>
            {taluks.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
      </Section>

      <Section icon={<UserRound />} title="Personal details">
        <Field label="Full name" required className="sm:col-span-2 lg:col-span-3">
          <Input value={value.fullName} onChange={(e) => set("fullName", letters(e.target.value))} placeholder="As on Aadhaar" />
        </Field>
        <Field label="Father's name" required>
          <Input value={value.fatherName} onChange={(e) => set("fatherName", letters(e.target.value))} />
        </Field>
        <Field label="Mother's name" required>
          <Input value={value.motherName} onChange={(e) => set("motherName", letters(e.target.value))} />
        </Field>
        <Field label="Gender" required group>
          <Segmented
            value={lockGender ?? value.gender}
            disabled={!!lockGender}
            options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }]}
            onChange={(g) => set("gender", g as Gender)}
          />
        </Field>
        <Field label="Date of birth" required hint={age !== null ? `${age} years old` : undefined}>
          <Input type="date" max={latestDob} value={value.dob} onChange={(e) => set("dob", e.target.value)} />
        </Field>
        <Field label="Blood group" required>
          <Select value={value.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
            <option value="">Select</option>
            {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Aadhaar number" required>
          <Input inputMode="numeric" placeholder="12 digits" value={value.aadhaarNumber} onChange={(e) => set("aadhaarNumber", digits(e.target.value, 12))} className="tracking-wide" />
        </Field>
        <Field label="Mobile" required>
          <PhoneInput value={value.phone} onChange={(v) => set("phone", v)} />
        </Field>
        <Field label="Alternate mobile">
          <PhoneInput value={value.alternatePhone} onChange={(v) => set("alternatePhone", v)} />
        </Field>
        <Field label="Nationality" required>
          <Input value={value.nationality} onChange={(e) => set("nationality", letters(e.target.value))} />
        </Field>
        {emailOtp ? (
          <EmailOtpField value={value.email} onChange={(v) => set("email", v)} otp={emailOtp} savedEmail={savedEmail} className="sm:col-span-2 lg:col-span-3" />
        ) : (
          <Field label="Email" required className="sm:col-span-2">
            <Input type="email" placeholder="name@example.com" value={value.email} onChange={(e) => set("email", e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, ""))} />
          </Field>
        )}
      </Section>

      <Section icon={<Home />} title="Permanent address">
        <Field label="Street address" required className="sm:col-span-2 lg:col-span-3">
          <Input placeholder="Door no, street, area" value={value.address} onChange={(e) => set("address", e.target.value.replace(/[^a-zA-Z0-9\s,.'/#-]/g, ""))} />
        </Field>
        <Field label="City" required>
          <Input value={value.city} onChange={(e) => set("city", letters(e.target.value))} />
        </Field>
        <Field label="State" required>
          <Input value={value.state} onChange={(e) => set("state", letters(e.target.value))} />
        </Field>
        <Field label="Pincode" required>
          <Input inputMode="numeric" placeholder="6 digits" value={value.pincode} onChange={(e) => set("pincode", digits(e.target.value, 6))} />
        </Field>
      </Section>

      <Section icon={<Wallet />} title="Family income">
        <Field label="Annual income" required>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">₹</span>
            <Input inputMode="numeric" placeholder="0" value={value.annualIncome} onChange={(e) => set("annualIncome", digits(e.target.value, 10))} className="pl-8" />
          </div>
        </Field>
      </Section>

      <Section icon={<GraduationCap />} title="Education">
        <Field label="Studying at" required group>
          <Segmented
            value={value.institutionType}
            options={[{ value: "SCHOOL", label: "School" }, { value: "COLLEGE", label: "College" }, { value: "DIPLOMA", label: "Diploma" }]}
            onChange={(t) => onChange({ ...value, institutionType: t, grade: "", degreeDepartment: "" })}
          />
        </Field>
        <Field label={institutionLabel} required>
          <Input value={value.institutionName} onChange={(e) => set("institutionName", e.target.value)} />
        </Field>
        <Field label={school ? "Standard" : "Year"} required>
          <Select value={value.grade} onChange={(e) => set("grade", e.target.value)}>
            <option value="">Select</option>
            {(school ? STANDARDS : YEARS).map((g) => <option key={g}>{g}</option>)}
          </Select>
        </Field>
        {!school && (
          <Field label="Department">
            <Input placeholder="e.g. B.Sc Computer Science" value={value.degreeDepartment} onChange={(e) => set("degreeDepartment", e.target.value)} />
          </Field>
        )}
      </Section>

      <Section icon={<Medal />} title="Club & coach" optional>
        <Field label="Club / academy">
          <Input value={value.club} onChange={(e) => set("club", e.target.value)} />
        </Field>
        <Field label="Coach">
          <Input value={value.coachName} onChange={(e) => set("coachName", letters(e.target.value))} />
        </Field>
        <Field label="Belt">
          <Select value={value.belt} onChange={(e) => set("belt", e.target.value)}>
            {BELTS.map((b) => <option key={b} value={b}>{b || "Select"}</option>)}
          </Select>
        </Field>
      </Section>
    </div>
  );
}

function Section({ icon, title, optional, children }: { icon: ReactNode; title: string; optional?: boolean; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Optional</span>}
      </div>
      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** Pill toggle for 2–3 short choices (friendlier than a dropdown). */
function Segmented({ value, options, onChange, disabled }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" className={cx("flex h-11 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1", disabled && "opacity-60")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-lg text-sm font-medium transition-all",
            value === o.value ? "bg-white text-brand shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">+91</span>
      <Input type="tel" inputMode="numeric" placeholder="10 digits" value={value} onChange={(e) => onChange(digits(e.target.value, 10))} className="pl-12" />
    </div>
  );
}

/**
 * When all 6 digits of the location pincode are in, look up the district and taluk and
 * fill them in. A taluk is only filled when the pincode maps to exactly one.
 */
function usePincodeFill(value: StudentInput, onChange: (v: StudentInput) => void): { loading?: boolean; text?: string; error?: string } | null {
  const pincode = value.residingPincode;
  // A pincode the form opened with (editing a saved student) is not looked up, so it can't overwrite their saved taluk.
  const [initial] = useState(pincode);
  const [result, setResult] = useState<{ pincode: string; text?: string; error?: string } | null>(null);
  const latest = useRef({ value, onChange });
  useEffect(() => { latest.current = { value, onChange }; });

  useEffect(() => {
    if (pincode.length !== 6 || pincode === initial) return;
    let cancelled = false;
    lookupPincode(pincode)
      .then((m) => {
        if (cancelled) return;
        const onlyTaluk = m.taluks.length === 1 ? m.taluks[0]! : "";
        latest.current.onChange({ ...latest.current.value, district: m.district, taluk: onlyTaluk });
        setResult({ pincode, text: onlyTaluk ? `${m.district}, ${onlyTaluk}` : `${m.district} — pick your taluk` });
      })
      .catch((err: Error) => !cancelled && setResult({ pincode, error: err.message }));
    return () => { cancelled = true; };
  }, [pincode, initial]);

  if (pincode.length !== 6 || pincode === initial) return null;
  return result?.pincode === pincode ? result : { loading: true };
}
