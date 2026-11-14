"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Briefcase, Camera, Check, ClipboardList, Flag, GraduationCap, Home, Loader2, Lock, Medal, UserRound, Wallet } from "lucide-react";
import type { Gender, ParticipantType, Representing, Student, StudentGender } from "@/lib/types";
import { useUnits } from "@/lib/hooks";
import { toDateInput } from "@/lib/format";
import { lookupPincode, pincodeProblem, useLocations } from "@/lib/locations";
import { emailProblem } from "@/lib/email";
import { DateInput, Field, Input, Select, cx } from "./ui";
import { DocumentUpload } from "./DocumentUpload";
import { PhotoUpload } from "./PhotoUpload";
import { BeltSelect } from "./BeltSelect";
import { EmailOtpField, type EmailOtp } from "./EmailOtpField";

/**
 * Full student registration form (same details as the main TNJA player registration).
 * Used by the public /register page, the admin Students page and a tournament's "new student" entry.
 */
export type StudentInput = {
  residingPincode: string; outsideTamilNadu: boolean; district: string; taluk: string;
  /** Who they play for in the overall championship: a district (any, not only where they live) or a unit */
  representing: Representing | ""; representingDistrict: string; representingUnit: string;
  fullName: string; fatherName: string; motherName: string; gender: StudentGender | ""; dob: string;
  bloodGroup: string; aadhaarNumber: string; phone: string; alternatePhone: string; parentPhone: string; emergencyPhone: string; email: string; nationality: string;
  address: string; city: string; state: string; pincode: string;
  annualIncome: string; isBPL: boolean;
  /** Student (education details) or working professional (occupation details) */
  participantType: ParticipantType;
  institutionType: string; institutionName: string; grade: string; degreeDepartment: string;
  employmentType: string; organisationName: string; occupation: string;
  club: string; coachName: string; belt: string;
  /** Additional details (printed on the Tournament Entry Pass); weight in kg as typed */
  weightKg: string; managerName: string; districtPresident: string; districtSecretary: string;
};

export const emptyStudent: StudentInput = {
  residingPincode: "", outsideTamilNadu: false, district: "", taluk: "",
  representing: "", representingDistrict: "", representingUnit: "",
  fullName: "", fatherName: "", motherName: "", gender: "", dob: "",
  bloodGroup: "", aadhaarNumber: "", phone: "", alternatePhone: "", parentPhone: "", emergencyPhone: "", email: "", nationality: "Indian",
  address: "", city: "", state: "Tamil Nadu", pincode: "",
  annualIncome: "", isBPL: false,
  participantType: "STUDENT",
  institutionType: "SCHOOL", institutionName: "", grade: "", degreeDepartment: "",
  employmentType: "PRIVATE", organisationName: "", occupation: "",
  club: "", coachName: "", belt: "",
  weightKg: "", managerName: "", districtPresident: "", districtSecretary: "",
};

export const fromStudent = (s: Student): StudentInput => ({
  residingPincode: s.residingPincode, outsideTamilNadu: s.outsideTamilNadu, district: s.district, taluk: s.taluk,
  representing: s.representing ?? "", representingDistrict: s.representingDistrict ?? "", representingUnit: s.representingUnit ?? "",
  fullName: s.fullName, fatherName: s.fatherName, motherName: s.motherName, gender: s.gender, dob: toDateInput(s.dob),
  bloodGroup: s.bloodGroup, aadhaarNumber: s.aadhaarNumber ?? "", phone: s.phone, alternatePhone: s.alternatePhone, parentPhone: s.parentPhone ?? "", emergencyPhone: s.emergencyPhone ?? "", email: s.email, nationality: s.nationality || "Indian",
  address: s.address, city: s.city, state: s.state || "Tamil Nadu", pincode: s.residingPincode || s.pincode,
  annualIncome: s.annualIncome === null ? "" : String(s.annualIncome), isBPL: s.isBPL,
  participantType: s.participantType ?? "STUDENT",
  institutionType: s.institutionType || "SCHOOL", institutionName: s.institutionName, grade: s.grade, degreeDepartment: s.degreeDepartment,
  employmentType: s.employmentType || "PRIVATE", organisationName: s.organisationName ?? "", occupation: s.occupation ?? "",
  club: s.club, coachName: s.coachName, belt: s.belt,
  weightKg: s.weightKg ? String(s.weightKg) : "", managerName: s.managerName ?? "", districtPresident: s.districtPresident ?? "", districtSecretary: s.districtSecretary ?? "",
});

const MOBILE = /^[6-9]\d{9}$/;

/** Documents a student uploads when registering themselves (data: URLs). */
export type StudentDocs = { photo: string; bplProof: string; nativityProof: string; nativityProofLabel: string };
export const emptyDocs: StudentDocs = { photo: "", bplProof: "", nativityProof: "", nativityProofLabel: "Nativity certificate" };

/** What still has to be uploaded (or filled in) when registering themselves, or null. */
export function validateDocs(f: StudentInput, d: StudentDocs): string | null {
  if (!d.photo) return "Please upload a passport-size photograph.";
  if (!f.parentPhone) return f.participantType === "PROFESSIONAL" ? "Please enter an emergency contact number." : "Please enter the parent / emergency contact number.";
  const kg = parseFloat(f.weightKg);
  if (!kg) return "Please enter the player's weight (Additional details).";
  if (kg < 10 || kg > 250) return "Check the player's weight (Additional details).";
  if (f.outsideTamilNadu && !d.nativityProof) return "Please upload a nativity certificate or other proof of where you live.";
  if (!f.outsideTamilNadu && f.isBPL && !d.bplProof) return "Please upload your BPL card or certificate.";
  return null;
}

const NATIVITY_DOCS = ["Nativity certificate", "Community certificate", "School / college bonafide", "Ration card", "Other"];

/** Client-side check before saving; the API validates the same rules. */
export function validateStudent(f: StudentInput): string | null {
  const missing: [keyof StudentInput, string][] = [
    ["district", "district"], ...(f.outsideTamilNadu ? [] : [["taluk", "taluk"] as [keyof StudentInput, string]]), ["fullName", "full name"], ["fatherName", "father's name"], ["motherName", "mother's name"],
    ["gender", "gender"], ["dob", "date of birth"], ["bloodGroup", "blood group"], ["email", "email"], ["nationality", "nationality"],
    ["address", "address"], ["city", "city"], ["state", "state"], ["annualIncome", "annual income"],
    ...(f.participantType === "PROFESSIONAL"
      ? ([["employmentType", "employment type"], ["organisationName", "organisation / employer name"], ["occupation", "designation / role"]] as [keyof StudentInput, string][])
      : ([["institutionName", "institution name"], ["grade", "standard / year"]] as [keyof StudentInput, string][])),
  ];
  const gap = missing.find(([k]) => !String(f[k]).trim());
  if (gap) return `Please fill in the ${gap[1]}.`;
  if (!f.representing) return "Choose whether you represent a district or a unit.";
  if (f.representing === "DISTRICT" && !f.representingDistrict) return "Choose the district you represent.";
  if (f.representing === "UNIT" && !f.representingUnit) return "Choose the unit you represent.";
  const pinProblem = pincodeProblem(f.residingPincode, "Pincode");
  if (pinProblem) return pinProblem;
  if (!/^\d{12}$/.test(f.aadhaarNumber)) return "Aadhaar number must be 12 digits.";
  if (!MOBILE.test(f.phone)) return "Enter a valid 10-digit mobile number.";
  if (f.parentPhone && !MOBILE.test(f.parentPhone)) return "Parent / emergency contact number isn't valid.";
  if (f.gender !== "MALE" && f.gender !== "FEMALE") return "Choose male or female.";
  const badEmail = emailProblem(f.email);
  if (badEmail) return badEmail;
  if (f.weightKg && !(parseFloat(f.weightKg) >= 10 && parseFloat(f.weightKg) <= 250)) return "Weight must be between 10 and 250 kg.";
  return null;
}

const GENDERS = [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }];
const BLOOD_GROUPS = ["O+ve", "O-ve", "A+ve", "A-ve", "A1+ve", "B+ve", "B-ve", "AB+ve", "AB-ve"];
const STANDARDS = Array.from({ length: 12 }, (_, i) => `${i + 1}${["st", "nd", "rd"][i] ?? "th"} Standard`);
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const EMPLOYMENT_TYPES = [{ value: "PRIVATE", label: "Private" }, { value: "GOVERNMENT", label: "Government" }, { value: "SELF_EMPLOYED", label: "Self-employed" }, { value: "OTHER", label: "Other" }];
const REPRESENTING = [{ value: "DISTRICT", label: "District" }, { value: "UNIT", label: "Unit" }];
const PARTICIPANT_TYPES = [{ value: "STUDENT", label: "Student" }, { value: "PROFESSIONAL", label: "Working professional" }];

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const letters = (v: string) => v.replace(/[^A-Za-z\s.'-]/g, "");

/** Age by birth year only (this year − birth year), the way categories are decided. */
function ageFrom(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const age = new Date().getFullYear() - Number(dob.slice(0, 4));
  return age >= 0 && age < 120 ? age : null;
}

export function StudentFields({ value, onChange, lockGender, lockType, emailOtp, docs, onDocsChange, publicForm }: {
  value: StudentInput;
  onChange: (v: StudentInput) => void;
  lockGender?: Gender;
  /** Student / working professional can't be changed (editing a saved player: the ID carries the type) */
  lockType?: boolean;
  /** Players registering themselves: coach, manager, district president and secretary are left to the admin */
  publicForm?: boolean;
  /** Shows a Verify button next to the email (public registration) */
  emailOtp?: EmailOtp;
  /** Ask for BPL proof / proof of nativity (public registration) */
  docs?: StudentDocs;
  onDocsChange?: (d: StudentDocs) => void;
}) {
  const setDoc = <K extends keyof StudentDocs>(k: K, v: StudentDocs[K]) => docs && onDocsChange?.({ ...docs, [k]: v });
  const locations = useLocations();
  const units = useUnits();
  const set = <K extends keyof StudentInput>(k: K, v: StudentInput[K]) => onChange({ ...value, [k]: v });
  const taluks = locations.find((d) => d.district === value.district)?.taluks ?? [];
  const pincode = usePincodeFill(value, onChange);

  const latestDob = new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().slice(0, 10);
  const age = ageFrom(value.dob);
  const professional = value.participantType === "PROFESSIONAL";
  const school = value.institutionType === "SCHOOL";
  const institutionLabel = school ? "School name" : value.institutionType === "COLLEGE" ? "College name" : "Institute name";

  return (
    <div className="space-y-8">
      <Section icon={professional ? <Briefcase /> : <GraduationCap />} title="Registering as">
        <Field
          label="I am a"
          required
          group
          className="sm:col-span-2 lg:col-span-3"
          hint={lockType ? "Fixed at registration (it is part of the player ID)." : "Students and working professionals play in the same age and weight categories."}
        >
          <Segmented value={value.participantType} options={PARTICIPANT_TYPES} disabled={lockType} onChange={(t) => set("participantType", t as ParticipantType)} />
        </Field>
      </Section>

      <Section icon={<Home />} title="Permanent address" subtitle="As on your Aadhaar">
        <Field label="Street address" required className="sm:col-span-2 lg:col-span-3">
          <Input placeholder="Door no, street, area" value={value.address} onChange={(e) => set("address", e.target.value.replace(/[^a-zA-Z0-9\s,.'/#-]/g, ""))} />
        </Field>
        <Field
          label="Pincode"
          required
          error={pincode?.error}
          hint={
            pincode?.loading ? (
              <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Finding your area…</span>
            ) : pincode?.text ? (
              <span className={cx("inline-flex items-center gap-1 font-medium", value.outsideTamilNadu ? "text-amber-700" : "text-emerald-600")}><Check size={13} /> {pincode.text}</span>
            ) : undefined
          }
        >
          <Input inputMode="numeric" placeholder="e.g. 641001" value={value.residingPincode} onChange={(e) => { const pin = digits(e.target.value, 6); onChange({ ...value, residingPincode: pin, pincode: pin }); }} aria-invalid={!!pincode?.error} />
        </Field>
        {value.outsideTamilNadu ? (
          <>
            <Field label="District" required>
              <Input value={value.district} onChange={(e) => set("district", e.target.value)} />
            </Field>
            <Field label="Area / taluk">
              <Input value={value.taluk} onChange={(e) => set("taluk", e.target.value)} />
            </Field>
          </>
        ) : (
          <>
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
          </>
        )}
        <Field label="City / town" required>
          <Input value={value.city} onChange={(e) => set("city", letters(e.target.value))} />
        </Field>
        <Field label="State" required>
          <Input value={value.state} onChange={(e) => set("state", letters(e.target.value))} />
        </Field>
        {value.outsideTamilNadu && docs && (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">You live outside Tamil Nadu.</span> Upload a nativity certificate or another proof. Our team will review it, and we&apos;ll email you once you&apos;re approved.
            </p>
            <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
              <Field label="Document" required>
                <Select value={docs.nativityProofLabel} onChange={(e) => setDoc("nativityProofLabel", e.target.value)}>
                  {NATIVITY_DOCS.map((d) => <option key={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Upload" required group>
                <DocumentUpload value={docs.nativityProof} onChange={(v) => setDoc("nativityProof", v)} label={`Upload ${docs.nativityProofLabel.toLowerCase()}`} />
              </Field>
            </div>
          </div>
        )}
      </Section>

      <Section icon={<Flag />} title="Representing">
        <Field label="I represent" required group hint="Your medals count for this district or unit in the overall championship.">
          <Segmented
            value={value.representing}
            options={REPRESENTING}
            onChange={(r) => onChange({
              ...value,
              representing: r as Representing,
              // Start from the district they live in; they can pick another.
              representingDistrict: r === "DISTRICT" ? value.representingDistrict || (value.outsideTamilNadu ? "" : value.district) : "",
              representingUnit: r === "UNIT" ? value.representingUnit : "",
            })}
          />
        </Field>
        {value.representing === "DISTRICT" && (
          <Field label="District" required>
            <Select value={value.representingDistrict} onChange={(e) => set("representingDistrict", e.target.value)}>
              <option value="">Select</option>
              {locations.map((d) => <option key={d.district}>{d.district}</option>)}
            </Select>
          </Field>
        )}
        {value.representing === "UNIT" && (
          <Field label="Unit" required hint={units.length ? undefined : "No units have been added yet."}>
            <Select value={value.representingUnit} onChange={(e) => set("representingUnit", e.target.value)} disabled={!units.length}>
              <option value="">Select</option>
              {/* A saved unit that has since been removed still shows, so the record isn't silently changed */}
              {value.representingUnit && !units.some((u) => u.name === value.representingUnit) && <option>{value.representingUnit}</option>}
              {units.map((u) => <option key={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        )}
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
            value={value.gender}
            options={GENDERS.filter((g) => !lockGender || g.value === lockGender)}
            onChange={(g) => set("gender", g as StudentGender)}
          />
        </Field>
        <Field label="Date of birth" required hint={age !== null ? `Born ${value.dob.slice(0, 4)} · counts as ${age} this year` : "Categories go by birth year only"}>
          <DateInput max={latestDob} value={value.dob} onChange={(v) => set("dob", v)} />
        </Field>
        <Field label="Blood group" required>
          <Select value={value.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
            <option value="">Select</option>
            {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
          </Select>
        </Field>
        <Field label="Nationality" required>
          <Input value={value.nationality} onChange={(e) => set("nationality", letters(e.target.value))} />
        </Field>
        <Field label="Aadhaar number" required>
          <Input inputMode="numeric" placeholder="12 digits" value={value.aadhaarNumber} onChange={(e) => set("aadhaarNumber", digits(e.target.value, 12))} className="tracking-wide" />
        </Field>
        <Field label="Mobile" required>
          <PhoneInput value={value.phone} onChange={(v) => set("phone", v)} />
        </Field>
        {/* One number: the parent's mobile is also the emergency contact. */}
        <Field
          label={professional ? "Emergency contact" : "Parent / emergency contact"}
          required={publicForm}
          hint={professional ? "A family member or friend — called in an emergency" : "Father, mother or guardian — called in an emergency"}
        >
          <PhoneInput value={value.parentPhone} onChange={(v) => onChange({ ...value, parentPhone: v, emergencyPhone: v })} />
        </Field>
        {emailOtp ? (
          <EmailOtpField value={value.email} onChange={(v) => set("email", v)} otp={emailOtp} className="sm:col-span-2 lg:col-span-3" />
        ) : (
          <Field label="Email" required hint="Becomes the username for logging in" className="sm:col-span-2">
            <Input type="email" placeholder="name@example.com" value={value.email} onChange={(e) => set("email", e.target.value.replace(/[^a-zA-Z0-9@._+-]/g, ""))} />
          </Field>
        )}
      </Section>

      {docs && (
        <Section icon={<Camera />} title="Photograph">
          <div className="sm:col-span-2 lg:col-span-3">
            <PhotoUpload value={docs.photo} onChange={(v) => setDoc("photo", v)} />
          </div>
        </Section>
      )}

      <Section icon={<Wallet />} title={professional ? "Income" : "Family income"}>
        <Field label="Annual income" required>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-400">₹</span>
            <Input inputMode="numeric" placeholder="0" value={value.annualIncome} onChange={(e) => set("annualIncome", digits(e.target.value, 10))} className="pl-8" />
          </div>
        </Field>
        {!value.outsideTamilNadu && (
          <Field label="BPL family?" required group hint="Below poverty line">
            <Segmented value={value.isBPL ? "YES" : "NO"} options={[{ value: "NO", label: "No" }, { value: "YES", label: "Yes" }]} onChange={(v) => set("isBPL", v === "YES")} />
          </Field>
        )}
        {!value.outsideTamilNadu && value.isBPL && docs && (
          <Field label="BPL card or certificate" required group className="sm:col-span-2 lg:col-span-1">
            <DocumentUpload value={docs.bplProof} onChange={(v) => setDoc("bplProof", v)} label="Upload BPL proof" />
          </Field>
        )}
      </Section>

      {professional ? (
      <Section icon={<Briefcase />} title="Occupation">
        <Field label="Employment type" required>
          <Select value={value.employmentType} onChange={(e) => set("employmentType", e.target.value)}>
            <option value="">Select</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label={value.employmentType === "SELF_EMPLOYED" ? "Business name" : "Organisation / employer"} required>
          <Input value={value.organisationName} onChange={(e) => set("organisationName", e.target.value)} />
        </Field>
        <Field label="Designation / role" required>
          <Input placeholder="e.g. Software Engineer" value={value.occupation} onChange={(e) => set("occupation", e.target.value)} />
        </Field>
      </Section>
      ) : (
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
      )}

      <Section icon={<ClipboardList />} title="Additional details">
        <Field label="Weight" required={!!docs} hint="Your current body weight">
          <div className="relative">
            <Input type="number" inputMode="decimal" min={10} max={250} step={0.1} value={value.weightKg} onChange={(e) => set("weightKg", e.target.value)} className="pr-12" />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-400">kg</span>
          </div>
        </Field>
        {publicForm ? (
          <p className="flex items-start gap-2 self-start rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-500 sm:col-span-1 lg:col-span-2">
            <Lock size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>Coach, manager, district president and district secretary are filled in by the {"association's"} office — you don&apos;t need to enter them.</span>
          </p>
        ) : (
          <>
            <Field label="Coach name">
              <Input value={value.coachName} onChange={(e) => set("coachName", letters(e.target.value))} />
            </Field>
            <Field label="Manager name">
              <Input value={value.managerName} onChange={(e) => set("managerName", letters(e.target.value))} />
            </Field>
            <Field label="District president">
              <Input value={value.districtPresident} onChange={(e) => set("districtPresident", letters(e.target.value))} />
            </Field>
            <Field label="District secretary">
              <Input value={value.districtSecretary} onChange={(e) => set("districtSecretary", letters(e.target.value))} />
            </Field>
          </>
        )}
      </Section>

      <Section icon={<Medal />} title="Club & belt" optional>
        <Field label="Club / academy">
          <Input value={value.club} onChange={(e) => set("club", e.target.value)} />
        </Field>
        <Field label="Belt grade" group className="sm:col-span-1 lg:col-span-2">
          <BeltSelect value={value.belt} onChange={(v) => set("belt", v)} />
        </Field>
      </Section>
    </div>
  );
}

function Section({ icon, title, subtitle, optional, children }: { icon: ReactNode; title: string; subtitle?: string; optional?: boolean; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
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
        if (!m.inTamilNadu) {
          latest.current.onChange({ ...latest.current.value, outsideTamilNadu: true, isBPL: false, district: m.district, taluk: "", state: m.state || "" });
          const place = [m.district, m.state].filter(Boolean).join(", ");
          setResult({ pincode, text: place ? `${place} — outside Tamil Nadu` : "Outside Tamil Nadu — enter your district" });
          return;
        }
        const onlyTaluk = m.taluks.length === 1 ? m.taluks[0]! : "";
        latest.current.onChange({ ...latest.current.value, outsideTamilNadu: false, district: m.district, taluk: onlyTaluk, state: "Tamil Nadu" });
        // No district: not in the India Post directory, or not placed in a district. The student picks it.
        setResult({ pincode, text: !m.district ? "Tamil Nadu — pick your district and taluk" : onlyTaluk ? `${m.district}, ${onlyTaluk}` : `${m.district} — pick your taluk` });
      })
      .catch((err: Error) => !cancelled && setResult({ pincode, error: err.message }));
    return () => { cancelled = true; };
  }, [pincode, initial]);

  if (pincode.length !== 6 || pincode === initial) return null;
  return result?.pincode === pincode ? result : { loading: true };
}
