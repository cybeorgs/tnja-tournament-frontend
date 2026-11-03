"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/hooks";
import { competitionAge, eligibleAgeGroups, ownAgeGroup, weightClassFor, weightClassesFor } from "@/lib/categories";
import { GENDER_LABEL, formatDate } from "@/lib/format";
import type { Gender, Paged, Registration, Student, TournamentDetail } from "@/lib/types";
import { Button, Field, Input, Modal, Select, cx } from "@/components/ui";
import { StudentFields, emptyStudent, validateStudent, type StudentInput } from "@/components/StudentFields";
import { errorMessage, useToast } from "@/components/Toast";

/** Add a new entry (existing or new student), or edit an entry's category. */
export function EntryModal({ tournament, editing, onClose, onSaved }: { tournament: TournamentDetail; editing: Registration | null; onClose: () => void; onSaved: () => void }) {
  const meta = useMeta();
  const toast = useToast();
  const lockGender = tournament.gender === "BOTH" ? undefined : tournament.gender;

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [picked, setPicked] = useState<Student | null>(editing?.student ?? null);
  const [newStudent, setNewStudent] = useState<StudentInput>({ ...emptyStudent, gender: lockGender ?? "" });
  const [chosenAgeGroup, setAgeGroup] = useState(editing?.ageGroup ?? "");
  /** Age groups for a new entry; null until the organiser chooses (then the first eligible one) */
  const [chosenGroups, setGroups] = useState<string[] | null>(null);
  const [weight, setWeight] = useState(editing ? String(editing.weightKg) : "");
  const [weightCategory, setWeightCategory] = useState(editing?.weightCategory ?? "");
  // When editing, keep the saved class (it may have been chosen by hand) until the organiser unticks this.
  const [manualClass, setManualClass] = useState(!!editing);
  const [overrideAge, setOverrideAge] = useState(false);
  /** Boys' or girls' categories, for students whose gender is Other */
  const [competeAs, setCompeteAs] = useState<Gender | "">(editing?.gender ?? lockGender ?? "");
  const [saving, setSaving] = useState(false);

  // Search the master student list as the organiser types.
  useEffect(() => {
    if (editing || mode !== "existing") return;
    const handle = setTimeout(() => {
      api<Paged<Student>>(`/students?pageSize=20&q=${encodeURIComponent(query)}`).then((r) => setResults(r.items)).catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query, mode, editing]);

  const person = useMemo(
    () => (mode === "existing" || editing ? picked : newStudent.dob && newStudent.gender ? { dob: newStudent.dob, gender: newStudent.gender } : null),
    [mode, editing, picked, newStudent.dob, newStudent.gender],
  );
  const eligible = useMemo(
    () => (meta && person ? eligibleAgeGroups(meta, person.dob, tournament.startDate, tournament.ageGroups) : []),
    [meta, person, tournament.startDate, tournament.ageGroups],
  );
  // New entries: one or more age groups (a cadet may enter Cadet, Junior and Senior). Until the organiser
  // picks, default to the first age group the student is eligible for.
  const groups = editing ? [] : chosenGroups ?? eligible.slice(0, 1);
  const toggleGroup = (g: string) => {
    setGroups(groups.includes(g) ? groups.filter((x) => x !== g) : tournament.ageGroups.filter((x) => x === g || groups.includes(x)));
    setWeightCategory("");
  };
  // Editing changes one entry, so it has exactly one age group.
  const ageGroup = editing ? chosenAgeGroup || eligible[0] || "" : groups.length === 1 ? groups[0]! : "";

  const isOther = person?.gender === "OTHER";
  /** The categories (boys' or girls') this entry goes in. */
  const catGender: Gender | null = !person ? null : isOther ? lockGender ?? (competeAs || null) : (person.gender as Gender);
  const classes = meta && catGender && ageGroup ? weightClassesFor(meta, ageGroup, catGender) : [];
  const autoClass = meta && catGender && ageGroup ? weightClassFor(meta, ageGroup, catGender, Number(weight)) : "";
  const effectiveClass = manualClass ? weightCategory : autoClass;
  const ageMismatch = !!person && (editing ? !!ageGroup && !eligible.includes(ageGroup) : tournament.ageGroups.some((g) => !eligible.includes(g)));
  const age = person?.dob ? competitionAge(person.dob, tournament.startDate) : 0;
  const own = meta && age ? ownAgeGroup(meta, age) : undefined;
  const ageHint = !person ? "" : eligible.length ? `Age ${age}${own ? ` (${own})` : ""} — eligible: ${eligible.join(", ")}` : `Age ${age} — not eligible for any age group here`;

  async function save() {
    if (!editing && mode === "new") {
      const problem = validateStudent({ ...newStudent, gender: lockGender ?? newStudent.gender });
      if (problem) return toast(problem, false);
    }
    if (!person) return toast("Pick or enter a student first.", false);
    if (!catGender) return toast("Choose boys' or girls' categories.", false);
    if (editing ? !ageGroup : !groups.length) return toast("Choose an age group.", false);
    if (!Number(weight)) return toast("Enter the weight in kg.", false);
    setSaving(true);
    const common = { weightKg: Number(weight), weightCategory: manualClass && ageGroup ? weightCategory : undefined, overrideAge, competeAs: isOther ? catGender : undefined };
    const body = editing ? { ...common, ageGroup } : { ...common, ageGroups: groups };
    try {
      if (editing) {
        await api(`/tournaments/${tournament.id}/registrations/${editing.id}`, { method: "PUT", body });
        toast("Entry updated.");
      } else {
        await api(`/tournaments/${tournament.id}/registrations`, {
          body: mode === "existing" ? { ...body, studentId: picked!.id } : { ...body, student: { ...newStudent, gender: lockGender ?? newStudent.gender } },
        });
        toast(groups.length > 1 ? `Student registered in ${groups.length} categories.` : "Student registered.");
      }
      onSaved();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={editing ? `Edit entry — ${editing.student.fullName}` : "Register a student"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? "Save" : "Register"}</Button>
        </>
      }
    >
      {!editing && (
        <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(["existing", "new"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cx("rounded-md px-3 py-1.5 font-semibold", mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
            >
              {m === "existing" ? "Existing student" : "New student"}
            </button>
          ))}
        </div>
      )}

      {!editing && mode === "existing" && (
        <div className="mb-5">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input autoFocus placeholder="Search name, ID, club or phone" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
          </div>
          <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {results.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-400">
                No students found.{" "}
                <button className="font-semibold text-brand" onClick={() => setMode("new")}>Add a new student</button>
              </li>
            )}
            {results.map((s) => {
              const pending = s.status !== "APPROVED";
              const blocked = pending || (!!lockGender && s.gender !== lockGender && s.gender !== "OTHER");
              return (
                <li key={s.id}>
                  <button
                    disabled={blocked}
                    onClick={() => { setPicked(s); setAgeGroup(""); setGroups(null); setOverrideAge(false); }}
                    className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm", picked?.id === s.id ? "bg-brand-soft" : "hover:bg-slate-50", blocked && "opacity-40")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{s.fullName}</span>
                      <span className="block truncate text-xs text-slate-500"><span className="font-mono">{pending ? (s.status === "PENDING" ? "Waiting for approval" : "Rejected") : s.studentNo}</span>{[s.club, s.district].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{GENDER_LABEL[s.gender]} · {formatDate(s.dob)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!editing && mode === "new" && (
        <div className="mb-5">
          <StudentFields value={newStudent} onChange={setNewStudent} lockGender={lockGender} />
        </div>
      )}

      {person ? (
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Category</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {isOther && (
              <Field label="Compete in" className="sm:col-span-3">
                <Select value={lockGender ?? competeAs} disabled={!!lockGender} onChange={(e) => { setCompeteAs(e.target.value as Gender); setWeightCategory(""); }}>
                  <option value="">Select</option>
                  <option value="MALE">Boys&apos; categories</option>
                  <option value="FEMALE">Girls&apos; categories</option>
                </Select>
              </Field>
            )}
            {editing ? (
              <Field label="Age group" hint={ageHint}>
                <Select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
                  <option value="">Select</option>
                  {tournament.ageGroups.map((g) => <option key={g} value={g}>{g}{eligible.includes(g) ? "" : " (outside age)"}</option>)}
                </Select>
              </Field>
            ) : (
              <div className="sm:col-span-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium text-slate-700">Age groups <span className="font-normal text-slate-500">— pick one or more</span></p>
                  {eligible.length > 1 && (
                    <button type="button" onClick={() => { setGroups(eligible.every((g) => groups.includes(g)) ? [] : eligible); setWeightCategory(""); }} className="text-xs font-semibold text-brand hover:underline">
                      {eligible.every((g) => groups.includes(g)) ? "Clear" : "Select all eligible"}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tournament.ageGroups.map((g) => {
                    const ok = eligible.includes(g);
                    const on = groups.includes(g);
                    const cls = meta && catGender && Number(weight) ? weightClassFor(meta, g, catGender, Number(weight)) : "";
                    return (
                      <button
                        key={g}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={!ok && !overrideAge}
                        onClick={() => toggleGroup(g)}
                        className={cx(
                          "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                          on ? "border-brand bg-brand-soft text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                          !ok && !overrideAge && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span className={cx("flex h-4 w-4 items-center justify-center rounded border", on ? "border-brand bg-brand text-white" : "border-slate-300")}>
                          {on && <Check size={11} strokeWidth={3} />}
                        </span>
                        {g}
                        {cls && on && <span className="font-normal text-slate-500">{cls}</span>}
                        {!ok && <span className="font-normal text-amber-600">outside age</span>}
                      </button>
                    );
                  })}
                </div>
                {ageHint && <p className="mt-1.5 text-xs text-slate-500">{ageHint}</p>}
              </div>
            )}
            <Field label="Weight (kg)">
              <Input type="number" step="0.1" min={10} max={250} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </Field>
            {(editing || groups.length <= 1) && <Field label="Weight class">
              {manualClass ? (
                <Select value={weightCategory} onChange={(e) => setWeightCategory(e.target.value)}>
                  <option value="">Select</option>
                  {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              ) : (
                <div className="flex h-[38px] items-center rounded-lg border border-dashed border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800">
                  {effectiveClass || <span className="font-normal text-slate-400">From weight</span>}
                </div>
              )}
            </Field>}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            {(editing || groups.length <= 1) && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={manualClass} onChange={(e) => { setManualClass(e.target.checked); if (e.target.checked && !weightCategory) setWeightCategory(autoClass); }} className="h-4 w-4 accent-[#ff7400]" />
                Choose weight class by hand
              </label>
            )}
            {ageMismatch && (
              <label className="flex items-center gap-2 text-amber-700">
                <input
                  type="checkbox"
                  checked={overrideAge}
                  onChange={(e) => {
                    setOverrideAge(e.target.checked);
                    // Turning the override off drops any age groups outside the student's age.
                    if (!e.target.checked && chosenGroups) setGroups(chosenGroups.filter((g) => eligible.includes(g)));
                  }}
                  className="h-4 w-4 accent-[#ff7400]"
                />
                Override age check
              </label>
            )}
          </div>
        </div>
      ) : (
        !editing && mode === "existing" && (
          <p className="flex items-center gap-2 text-sm text-slate-500"><UserPlus size={16} /> Pick a student above to choose their category.</p>
        )
      )}
    </Modal>
  );
}
