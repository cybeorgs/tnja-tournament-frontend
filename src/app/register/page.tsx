"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, FileText, ImagePlus, Trophy, X } from "lucide-react";
import { api } from "@/lib/api";
import { TN_DISTRICTS } from "@/lib/districts";
import { fileToDataUrl } from "@/lib/upload";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { errorMessage } from "@/components/Toast";

const BLOOD_GROUPS = ["O+ve", "O-ve", "A+ve", "A-ve", "B+ve", "B-ve", "AB+ve", "AB-ve"];
const STANDARDS = Array.from({ length: 12 }, (_, i) => `${i + 1}${["st", "nd", "rd"][i] ?? "th"} Standard`);
const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const BELTS = ["", "White", "Yellow", "Orange", "Green", "Blue", "Brown", "Black"];

const empty = {
  district: "", taluk: "", residingPincode: "",
  fullName: "", gender: "", dob: "", bloodGroup: "", aadhaarNumber: "", phone: "", alternatePhone: "", email: "", nationality: "Indian",
  address: "", city: "", state: "Tamil Nadu", pincode: "",
  annualIncome: "", isBPL: false,
  institutionType: "SCHOOL", institutionName: "", grade: "", degreeDepartment: "",
  club: "", coachName: "", belt: "",
  photo: "", bplProof: "", agreedToTerms: false,
};
type Form = typeof empty;

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const letters = (v: string) => v.replace(/[^A-Za-z\s.'-]/g, "");

function ageOn(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export default function RegisterPage() {
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ studentNo: string; fullName: string; email: string } | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const latestDob = new Date(new Date().setFullYear(new Date().getFullYear() - 3)).toISOString().slice(0, 10);
  const age = ageOn(form.dob);
  const school = form.institutionType === "SCHOOL";
  const institutionLabel = school ? "School name" : form.institutionType === "COLLEGE" ? "College name" : "Diploma institution name";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const problem =
      !form.photo ? "Please upload the student's photo." :
      !/^[6-9]\d{9}$/.test(form.phone) ? "Enter a valid 10-digit mobile number." :
      form.alternatePhone && !/^[6-9]\d{9}$/.test(form.alternatePhone) ? "Enter a valid alternate mobile number, or leave it empty." :
      form.aadhaarNumber.length !== 12 ? "Aadhaar number must be 12 digits." :
      form.residingPincode.length !== 6 || form.pincode.length !== 6 ? "Pincodes must be 6 digits." :
      form.isBPL && !form.bplProof ? "Please upload proof for BPL beneficiary." :
      !form.agreedToTerms ? "Please agree to the terms and privacy policy." : null;
    if (problem) return setError(problem);

    setSaving(true);
    try {
      const { bplProof, ...rest } = form;
      setDone(await api("/public/students/register", { body: { ...rest, ...(form.isBPL ? { bplProof } : {}) } }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (done) return <PublicShell><Success {...done} /></PublicShell>;

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Student registration</h1>
          <p className="mt-2 text-slate-500">
            Fill in the details below. You get your permanent student ID as soon as you submit — there is no fee to register.
            Use the ID later to enter tournaments.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-6">
          <Section title="Residing location">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Residing / studying district *">
                <Input list="districts" value={form.district} onChange={(e) => set("district", e.target.value)} required />
                <datalist id="districts">{TN_DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist>
              </Field>
              <Field label="Residing / studying taluk *">
                <Input value={form.taluk} onChange={(e) => set("taluk", e.target.value)} required />
              </Field>
              <Field label="Residing / studying pincode *">
                <Input inputMode="numeric" placeholder="6 digits" value={form.residingPincode} onChange={(e) => set("residingPincode", digits(e.target.value, 6))} required />
              </Field>
            </div>
          </Section>

          <Section title="Personal information">
            <div className="grid gap-6 md:grid-cols-[1fr_180px]">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name *" className="sm:col-span-2">
                  <Input value={form.fullName} onChange={(e) => set("fullName", letters(e.target.value))} required />
                </Field>
                <Field label="Gender *">
                  <Select value={form.gender} onChange={(e) => set("gender", e.target.value)} required>
                    <option value="">Select…</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </Select>
                </Field>
                <Field label="Date of birth *" hint={age !== null ? `Age ${age}` : undefined}>
                  <Input type="date" max={latestDob} value={form.dob} onChange={(e) => set("dob", e.target.value)} required />
                </Field>
              </div>
              <PhotoPicker value={form.photo} onChange={(v) => set("photo", v)} onError={setError} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Blood group *">
                <Select value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} required>
                  <option value="">Select…</option>
                  {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
              <Field label="Aadhaar number *">
                <Input inputMode="numeric" placeholder="12 digits" value={form.aadhaarNumber} onChange={(e) => set("aadhaarNumber", digits(e.target.value, 12))} required />
              </Field>
              <Field label="Mobile number *">
                <Input type="tel" inputMode="numeric" placeholder="10 digits" value={form.phone} onChange={(e) => set("phone", digits(e.target.value, 10))} required />
              </Field>
              <Field label="Alternate mobile">
                <Input type="tel" inputMode="numeric" placeholder="10 digits" value={form.alternatePhone} onChange={(e) => set("alternatePhone", digits(e.target.value, 10))} />
              </Field>
              <Field label="Email address *">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value.trim())} required />
              </Field>
              <Field label="Nationality *">
                <Input value={form.nationality} onChange={(e) => set("nationality", letters(e.target.value))} required />
              </Field>
            </div>
          </Section>

          <Section title="Permanent address">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Address *" className="sm:col-span-3">
                <Input placeholder="Door no, street name" value={form.address} onChange={(e) => set("address", e.target.value)} required />
              </Field>
              <Field label="City *">
                <Input value={form.city} onChange={(e) => set("city", letters(e.target.value))} required />
              </Field>
              <Field label="State *">
                <Input value={form.state} onChange={(e) => set("state", letters(e.target.value))} required />
              </Field>
              <Field label="Pincode *">
                <Input inputMode="numeric" placeholder="6 digits" value={form.pincode} onChange={(e) => set("pincode", digits(e.target.value, 6))} required />
              </Field>
            </div>
          </Section>

          <Section title="Financial information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Family annual income (₹) *">
                <Input inputMode="numeric" value={form.annualIncome} onChange={(e) => set("annualIncome", digits(e.target.value, 10))} required />
              </Field>
              <Field label="Are you a BPL beneficiary? *">
                <Select value={form.isBPL ? "yes" : "no"} onChange={(e) => set("isBPL", e.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
              </Field>
              {form.isBPL && (
                <div className="sm:col-span-2">
                  <ProofPicker value={form.bplProof} onChange={(v) => set("bplProof", v)} onError={setError} />
                </div>
              )}
            </div>
          </Section>

          <Section title="Educational information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution type *">
                <Select value={form.institutionType} onChange={(e) => setForm((f) => ({ ...f, institutionType: e.target.value, grade: "", degreeDepartment: "" }))}>
                  <option value="SCHOOL">School</option>
                  <option value="COLLEGE">College</option>
                  <option value="DIPLOMA">Diploma</option>
                </Select>
              </Field>
              <Field label={`${institutionLabel} *`}>
                <Input value={form.institutionName} onChange={(e) => set("institutionName", e.target.value)} required />
              </Field>
              <Field label={school ? "Standard *" : "Year *"}>
                <Select value={form.grade} onChange={(e) => set("grade", e.target.value)} required>
                  <option value="">Select…</option>
                  {(school ? STANDARDS : YEARS).map((g) => <option key={g}>{g}</option>)}
                </Select>
              </Field>
              {!school && (
                <Field label="Degree / department">
                  <Input placeholder="e.g. B.Sc Computer Science" value={form.degreeDepartment} onChange={(e) => set("degreeDepartment", e.target.value)} />
                </Field>
              )}
            </div>
          </Section>

          <Section title="Academy information" note="Optional">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Club / academy">
                <Input value={form.club} onChange={(e) => set("club", e.target.value)} />
              </Field>
              <Field label="Coach name">
                <Input value={form.coachName} onChange={(e) => set("coachName", letters(e.target.value))} />
              </Field>
              <Field label="Belt">
                <Select value={form.belt} onChange={(e) => set("belt", e.target.value)}>
                  {BELTS.map((b) => <option key={b} value={b}>{b || "—"}</option>)}
                </Select>
              </Field>
            </div>
          </Section>

          {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <div className="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" checked={form.agreedToTerms} onChange={(e) => set("agreedToTerms", e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
              I confirm these details are correct and agree to the terms and privacy policy.
            </label>
            <Button type="submit" loading={saving} className="h-11 px-8">Register</Button>
          </div>
        </form>
      </div>
    </PublicShell>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {note && <span className="text-xs text-slate-400">{note}</span>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function PhotoPicker({ value, onChange, onError }: { value: string; onChange: (v: string) => void; onError: (m: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-slate-600">Photo *</span>
      <label className="relative flex aspect-[3/4] w-full max-w-[180px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400 hover:border-brand/50 hover:bg-orange-50/40">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
          <img src={value} alt="Student photo" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <ImagePlus size={28} />
            <span>Passport-size photo<br />JPG, PNG or WEBP</span>
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try { onChange(await fileToDataUrl(file, { maxSide: 600 })); } catch (err) { onError(errorMessage(err)); }
          }}
        />
      </label>
      {value && <button type="button" onClick={() => onChange("")} className="mt-1.5 text-xs text-slate-500 hover:text-red-600">Remove photo</button>}
    </div>
  );
}

function ProofPicker({ value, onChange, onError }: { value: string; onChange: (v: string) => void; onError: (m: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-slate-600">Proof for BPL beneficiary *</span>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          <FileText size={16} /> <span className="flex-1">Proof attached</span>
          <button type="button" onClick={() => onChange("")} aria-label="Remove proof" className="text-emerald-700 hover:text-red-600"><X size={16} /></button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 hover:border-brand/50">
          <FileText size={18} /> Upload JPG, PNG, WEBP or PDF (max 1 MB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try { onChange(await fileToDataUrl(file, { maxSide: 1600 })); } catch (err) { onError(errorMessage(err)); }
            }}
          />
        </label>
      )}
    </div>
  );
}

function Success({ studentNo, fullName }: { studentNo: string; fullName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Registration complete</h1>
      <p className="mt-2 text-slate-500">{fullName} is registered. This is your permanent student ID — keep it safe.</p>

      <div className="mt-6 rounded-xl border border-orange-100 bg-brand-soft px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student ID</p>
        <p className="mt-1 font-mono text-3xl font-bold tracking-wide text-brand">{studentNo}</p>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(studentNo).then(() => setCopied(true))}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand"
        >
          <Copy size={13} /> {copied ? "Copied" : "Copy ID"}
        </button>
      </div>

      <p className="mt-6 text-sm text-slate-500">To play in a tournament, enter it with this ID and your date of birth, then pay the tournament&apos;s entry fee.</p>
      <Link href="/enter" className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-dark">
        <Trophy size={16} /> Enter a tournament
      </Link>
    </Card>
  );
}
