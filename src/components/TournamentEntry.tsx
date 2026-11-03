"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, CheckCircle2, IndianRupee } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta, useNow } from "@/lib/hooks";
import { competitionAge, ownAgeGroup, weightClassFor } from "@/lib/categories";
import { rupees } from "@/lib/format";
import { openCheckout, type PaymentOrder } from "@/lib/razorpay";
import { registrationPhase, type Gender, type StudentGender, type Tournament } from "@/lib/types";
import { Button, Field, Input, Select, Spinner, cx } from "./ui";
import { errorMessage } from "./Toast";

export interface Entry { id: string; ageGroup: string; gender: Gender; weightCategory: string; weightKg: number; paymentStatus: "PENDING" | "PAID" | "WAIVED"; fee: number; isLate: boolean }
interface CheckResult {
  student: { studentNo: string; fullName: string; gender: StudentGender };
  genderAllowed: boolean;
  ageGroups: string[];
  /** Fee for each new entry now (the late entry fee during late registration) */
  entryFee: number;
  lateRegistration: boolean;
  entries: Entry[];
}

const isIn = (e: Entry) => e.paymentStatus !== "PENDING";
/** "A", "A and B", "A, B and C" */
const listJoin = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * Choose the age groups to enter (e.g. a cadet can enter Cadet, Junior and Senior), then pay for
 * them in one go. New entries cost the current fee (the late entry fee during late registration);
 * an unpaid entry made earlier keeps its own fee. The student is identified by ID + date of birth.
 */
export function TournamentEntry({ tournament, studentNo, dob, banner }: { tournament: Tournament; studentNo: string; dob: string; banner?: React.ReactNode }) {
  const meta = useMeta();
  const lockGender = tournament.gender === "BOTH" ? undefined : tournament.gender;
  const base = `/public/tournaments/${tournament.slug}/entry`;

  const [check, setCheck] = useState<CheckResult | null>(null);
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [weight, setWeight] = useState("");
  const [competeAs, setCompeteAs] = useState<Gender | "">(lockGender ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Entry[] | null>(null);
  const filledIn = useRef(false);
  // When regular registration ends (or registration closes) while the page is open, ask the server
  // again so the fee shown is the one that will be charged.
  const phase = registrationPhase(tournament, useNow(15_000));

  useEffect(() => {
    let cancelled = false;
    api<CheckResult>(`${base}/check`, { body: { studentNo, dob } })
      .then((r) => {
        if (cancelled) return;
        setCheck(r);
        setLoadError("");
        if (filledIn.current) return; // a refresh: keep what the student has chosen
        filledIn.current = true;
        const pending = r.entries.filter((e) => !isIn(e));
        setPicked(pending.length ? pending.map((e) => e.ageGroup) : r.ageGroups.length === 1 ? [r.ageGroups[0]!] : []);
        if (r.entries[0]) setWeight(String(r.entries[0].weightKg));
        if (r.entries.length && r.entries.every(isIn) && r.entries.length === r.ageGroups.length) setDone(r.entries);
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err)));
    return () => { cancelled = true; };
  }, [base, studentNo, dob, phase]);

  if (loadError) return <ErrorText>{loadError}</ErrorText>;
  if (!check) return <Spinner />;

  const isOther = check.student.gender === "OTHER";
  const catGender: Gender | null = isOther ? lockGender ?? (competeAs || null) : (check.student.gender as Gender);
  const weightKg = parseFloat(weight) || 0;
  const already = new Map(check.entries.filter(isIn).map((e) => [e.ageGroup, e]));
  const fresh = picked.filter((g) => !already.has(g));
  const pendingFee = new Map(check.entries.filter((e) => !isIn(e)).map((e) => [e.ageGroup, e.fee]));
  const feeFor = (g: string) => pendingFee.get(g) ?? check.entryFee;
  const total = fresh.reduce((sum, g) => sum + feeFor(g), 0);
  const sameFee = fresh.every((g) => feeFor(g) === feeFor(fresh[0]!));
  const toggle = (g: string) => setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  const selectable = check.ageGroups.filter((g) => !already.has(g));
  const allPicked = selectable.length > 0 && selectable.every((g) => picked.includes(g));
  const age = dob ? competitionAge(dob, tournament.startDate) : 0;
  const own = meta && age ? ownAgeGroup(meta, age) : undefined;
  const eligibilityNote =
    own && check.ageGroups.length > 1
      ? `Age ${age} (${own}): you can enter ${listJoin(check.ageGroups)}.`
      : own && check.ageGroups.length === 1 && check.ageGroups[0] !== own
        ? `Age ${age} (${own}): you can enter ${check.ageGroups[0]}.`
        : "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!fresh.length) return setError("Choose at least one category.");
    if (!weightKg) return setError("Enter your weight.");
    if (isOther && !catGender) return setError("Choose boys' or girls' categories.");
    setBusy(true);
    try {
      const { entries, payment } = await api<{ entries: Entry[]; payment: PaymentOrder | null }>(base, {
        body: { studentNo, dob, ageGroups: fresh, weightKg, competeAs: isOther ? catGender : undefined },
      });
      if (!payment) return setDone(entries);
      await openCheckout(payment, tournament.title, (resp) => api<{ entries: Entry[] }>(`${base}/verify`, { body: resp }));
      setDone((await api<CheckResult>(`${base}/check`, { body: { studentNo, dob } })).entries.filter(isIn));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 size={36} className="text-emerald-500" />
        </div>
        <p className="mt-4 text-lg font-bold text-slate-900">You&apos;re in, {check.student.fullName}!</p>
        <ul className="mx-auto mt-3 max-w-xs space-y-1 text-sm text-slate-600">
          {done.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
              <span>{e.ageGroup} · {e.weightCategory}</span>
              <span className="text-xs font-semibold text-emerald-600">{e.paymentStatus === "PAID" ? "Paid" : "Confirmed"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">Student ID <span className="font-mono font-semibold text-brand">{check.student.studentNo}</span></p>
        <Link href={`/t/${tournament.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">View tournament</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
      {banner}

      <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{check.student.fullName.charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-800">{check.student.fullName}</p>
          <p className="font-mono text-xs text-slate-500">{check.student.studentNo}</p>
        </div>
      </div>

      {check.lateRegistration && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Late registration.</span> {check.entryFee > 0 ? `The late entry fee of ${rupees(check.entryFee)} per category applies until the tournament starts.` : "Late entries are free."}
        </p>
      )}

      {!check.genderAllowed ? (
        <ErrorText>This tournament is for {tournament.gender === "MALE" ? "boys" : "girls"} only.</ErrorText>
      ) : !check.ageGroups.length ? (
        <ErrorText>Your age isn&apos;t in this tournament&apos;s groups ({tournament.ageGroups.join(", ")}).</ErrorText>
      ) : (
        <>
          {isOther && (
            <Field label="Compete in" required>
              <Select value={lockGender ?? competeAs} disabled={!!lockGender} onChange={(e) => setCompeteAs(e.target.value as Gender)}>
                <option value="">Select</option>
                <option value="MALE">Boys&apos; categories</option>
                <option value="FEMALE">Girls&apos; categories</option>
              </Select>
            </Field>
          )}

          <Field label="Weight" required className="sm:max-w-xs">
            <div className="relative">
              <Input type="number" inputMode="decimal" min={10} max={250} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} required className="pr-12" />
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-400">kg</span>
            </div>
          </Field>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-slate-700">
                Categories <span className="text-brand">*</span>
                {check.ageGroups.length > 1 && <span className="ml-1.5 font-normal text-slate-500">— pick one or more</span>}
              </p>
              {selectable.length > 1 && (
                <button type="button" onClick={() => setPicked(allPicked ? [] : selectable)} className="text-xs font-semibold text-brand hover:underline">
                  {allPicked ? "Clear" : "Select all"}
                </button>
              )}
            </div>
            {eligibilityNote && <p className="mb-2 text-xs text-slate-500">{eligibilityNote}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {check.ageGroups.map((g) => {
                const entered = already.get(g);
                const on = picked.includes(g) || !!entered;
                const cls = meta && catGender && weightKg ? weightClassFor(meta, g, catGender, weightKg) : "";
                return (
                  <button
                    key={g}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!!entered}
                    onClick={() => toggle(g)}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                      on ? "border-brand bg-brand-soft/60 ring-1 ring-brand/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      entered && "cursor-default opacity-80",
                    )}
                  >
                    <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-white" : "border-slate-300 bg-white")}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{g}</span>
                      <span className="block text-xs text-slate-500">{entered ? `Registered · ${entered.weightCategory}` : cls ? `Category ${cls}` : "Enter your weight"}</span>
                    </span>
                    {!entered && feeFor(g) > 0 && <span className="text-xs font-semibold text-slate-500">{rupees(feeFor(g))}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <ErrorText>{error}</ErrorText>}

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {total > 0 ? (
                <>
                  {sameFee && fresh.length > 1 && `${fresh.length} × ${rupees(feeFor(fresh[0]!))} = `}
                  {!sameFee && "Total "}
                  <span className="text-lg font-bold text-slate-900">{rupees(total)}</span>
                </>
              ) : check.entryFee > 0 ? (
                `${rupees(check.entryFee)} per category`
              ) : (
                "Free entry"
              )}
            </p>
            <Button type="submit" loading={busy} disabled={!fresh.length} icon={total > 0 ? <IndianRupee size={16} /> : <CheckCircle2 size={16} />} className="h-12 px-10 text-base">
              {total > 0 ? `Pay ${rupees(total)}` : "Confirm registration"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="animate-pop-in rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{children}</p>;
}
