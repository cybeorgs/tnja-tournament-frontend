"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Download, LogIn, Ticket, Trophy } from "lucide-react";
import { API_BASE, api } from "@/lib/api";
import { useMeta, useNow } from "@/lib/hooks";
import { competitionAge, ownAgeGroup, weightClassFor } from "@/lib/categories";
import { rupees } from "@/lib/format";
import { registrationPhase, type Gender, type PaymentStatus, type StudentGender, type Tournament } from "@/lib/types";
import { FeeTotal, PaymentBadge } from "./Payment";
import { PayNow } from "./PayNow";
import { Button, Field, Input, Select, Spinner, cx } from "./ui";
import { errorMessage } from "./Toast";

export interface Entry { id: string; ageGroup: string; gender: Gender; weightCategory: string; weightKg: number; fee: number; paymentStatus: PaymentStatus }
interface CheckResult {
  student: { studentNo: string; fullName: string; gender: StudentGender };
  genderAllowed: boolean;
  ageGroups: string[];
  /** Fee for the player's first category; 0 = free */
  entryFee: number;
  /** Fee for each further category */
  additionalEntryFee: number;
  entries: Entry[];
  /** Pays this student's unpaid entries without logging in */
  payToken: string;
}

/** "A", "A and B", "A, B and C" */
const listJoin = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

// ─── Events picker (shared by the registration form and returning players) ───

/** What the player answers: the events (age groups) they're ready to play, their weight, and (gender Other) boys' or girls' events. */
export interface EventsValue { ageGroups: string[]; weight: string; competeAs: Gender | "" }
export const emptyEvents: EventsValue = { ageGroups: [], weight: "", competeAs: "" };

/** What's missing, or null when the events can be entered. */
export function eventsProblem(v: EventsValue, eligible: string[], needsCompeteAs: boolean): string | null {
  if (!eligible.length) return null; // nothing to choose (reported in the picker)
  if (needsCompeteAs && !v.competeAs) return "Events: choose boys' or girls' events.";
  const kg = parseFloat(v.weight);
  if (!kg) return "Events: enter your weight.";
  if (kg < 10 || kg > 250) return "Events: check your weight.";
  if (!v.ageGroups.some((g) => eligible.includes(g))) return "Events: tick at least one event you will play.";
  return null;
}

/**
 * "Which events will you play?" A cadet (15–17) can play Cadet, Junior and Senior; a junior (18–20)
 * Junior and Senior; a senior (21+) Senior only. Shows the weight class for each event as the weight is typed.
 */
export function EventsPicker({ eligible, age, gender, lockGender, value, onChange, entered }: {
  /** Events this player may enter in this tournament, youngest first */
  eligible: string[];
  /** Competition age (tournament year − birth year); null until the date of birth is known */
  age: number | null;
  gender: StudentGender | "";
  /** Set when the tournament is for boys or girls only */
  lockGender?: Gender;
  value: EventsValue;
  onChange: (v: EventsValue) => void;
  /** Events already entered (age group → weight class); shown ticked and locked */
  entered?: Map<string, string>;
}) {
  const meta = useMeta();
  const set = (patch: Partial<EventsValue>) => onChange({ ...value, ...patch });
  const isOther = gender === "OTHER";
  const catGender: Gender | null = isOther ? lockGender ?? (value.competeAs || null) : gender ? (gender as Gender) : null;
  const weightKg = parseFloat(value.weight) || 0;
  const open = eligible.filter((g) => !entered?.has(g));
  const allPicked = open.length > 0 && open.every((g) => value.ageGroups.includes(g));
  const toggle = (g: string) => set({ ageGroups: value.ageGroups.includes(g) ? value.ageGroups.filter((x) => x !== g) : [...value.ageGroups, g] });
  const own = meta && age !== null ? ownAgeGroup(meta, age) : undefined;

  return (
    <section className="rounded-2xl border border-brand/20 bg-brand-soft/30 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white"><Trophy size={17} /></span>
        <div>
          <h3 className="text-base font-bold text-slate-900">Events you will play <span className="text-brand">*</span></h3>
          <p className="text-xs text-slate-500">
            Players can play more than one event: cadets (15–17) in Cadet, Junior and Senior; juniors (18–20) in Junior and Senior; seniors (21+) in Senior.
          </p>
        </div>
      </div>

      {age === null ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">Enter your date of birth above to see the events you can play.</p>
      ) : !eligible.length ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-red-700">
          At age {age} there is no event for you in this tournament. Check your date of birth.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="rounded-xl bg-white px-4 py-2.5 text-sm text-slate-700">
            Age <strong>{age}</strong>{own && <> ({own})</>}: you can play{" "}
            <strong>{eligible.length === 1 ? "1 event" : `up to ${eligible.length} events`}</strong> — {listJoin(eligible)}.
            {eligible.length > 1 && " Tick every event you are ready to play."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {isOther && (
              <Field label="Compete in" required>
                <Select value={lockGender ?? value.competeAs} disabled={!!lockGender} onChange={(e) => set({ competeAs: e.target.value as Gender })}>
                  <option value="">Select</option>
                  <option value="MALE">Boys&apos; events</option>
                  <option value="FEMALE">Girls&apos; events</option>
                </Select>
              </Field>
            )}
            <Field label="Your weight" required hint="The weight class of each event is worked out from it">
              <div className="relative">
                <Input type="number" inputMode="decimal" min={10} max={250} step={0.1} value={value.weight} onChange={(e) => set({ weight: e.target.value })} className="pr-12" />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-slate-400">kg</span>
              </div>
            </Field>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-slate-700">
                Which events will you play? {eligible.length > 1 && <span className="font-normal text-slate-500">— one or more</span>}
              </p>
              {open.length > 1 && (
                <button type="button" onClick={() => set({ ageGroups: allPicked ? [] : open })} className="text-xs font-semibold text-brand hover:underline">
                  {allPicked ? "Clear" : `Play all ${open.length}`}
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {eligible.map((g) => {
                const done = entered?.get(g);
                const on = value.ageGroups.includes(g) || !!done;
                const cls = meta && catGender && weightKg ? weightClassFor(meta, g, catGender, weightKg) : "";
                return (
                  <button
                    key={g}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!!done}
                    onClick={() => toggle(g)}
                    className={cx(
                      "flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-all",
                      on ? "border-brand bg-brand-soft/60 ring-1 ring-brand/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                      done && "cursor-default opacity-80",
                    )}
                  >
                    <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-brand bg-brand text-white" : "border-slate-300 bg-white")}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-800">{g}</span>
                      <span className="block text-xs text-slate-500">{done ? `Registered · ${done}` : cls ? `Weight class ${cls}` : "Enter your weight"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Save one event's Tournament Entry Pass using the pay token (the player isn't logged in on this screen). */
async function downloadEntryPass(payToken: string, entry: Entry, studentNo: string) {
  const res = await fetch(`${API_BASE}/public/payments/entry-pass`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payToken, registrationId: entry.id }) });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error || "Couldn't download the entry pass.");
  const url = URL.createObjectURL(new Blob([await res.blob()], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Entry_Pass_${studentNo}_${entry.ageGroup}_${entry.weightCategory}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * "You're in": the events entered, then paying the entry fee right here (or later from the student
 * login), then a Tournament Entry Pass for each event.
 */
export function EntryDone({ name, studentNo, entries: initial, tournament, note, payToken }: {
  name: string; studentNo: string; entries: Entry[]; tournament: Tournament; note?: React.ReactNode;
  /** From the registration reply: lets this screen take the payment without logging in */
  payToken?: string | null;
}) {
  const [entries, setEntries] = useState(initial);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const due = entries.filter((e) => e.paymentStatus === "PENDING").reduce((n, e) => n + e.fee, 0);
  const paidNow = !due && entries.some((e) => e.paymentStatus === "PAID");
  const total = entries.reduce((n, e) => n + (e.paymentStatus === "WAIVED" ? 0 : e.fee), 0);

  return (
    <div className="mx-auto max-w-md py-2">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 size={36} className="text-emerald-500" />
        </div>
        <p className="mt-4 text-lg font-bold text-slate-900">You&apos;re in, {name}!</p>
        <p className="mt-1 text-sm text-slate-500">
          Registered in {entries.length} event{entries.length === 1 ? "" : "s"} · Student ID <span className="font-mono font-semibold text-brand">{studentNo}</span>
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        <ul className="divide-y divide-slate-100 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-slate-700">{e.ageGroup} · {e.weightCategory}</span>
              <PaymentBadge status={e.paymentStatus} fee={e.fee} />
            </li>
          ))}
        </ul>
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
            <span className="font-medium text-slate-600">{due ? "Total to pay" : "Total paid"}</span>
            <span className="font-bold text-slate-900">{rupees(due || total)}</span>
          </div>
        )}
      </div>

      {due > 0 && (
        <div className="mt-5 rounded-2xl border border-orange-200 bg-brand-soft/60 p-4">
          <p className="text-sm font-bold text-slate-900">Pay the entry fee to get your Tournament Entry Passes</p>
          <p className="mb-3 mt-0.5 text-xs text-slate-600">Each event gets its own entry pass, emailed as a PDF as soon as the payment goes through.</p>
          {payToken ? (
            <PayNow
              amount={due}
              createOrder={() => api("/public/payments/order", { body: { payToken } })}
              verify={async (result) => setEntries((await api<{ entries: Entry[] }>("/public/payments/verify", { body: { payToken, ...result } })).entries)}
              onPaid={() => setEntries((list) => list.map((e) => (e.paymentStatus === "PENDING" ? { ...e, paymentStatus: "PAID" } : e)))}
            />
          ) : (
            <Link href="/student/login" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-dark">
              <LogIn size={16} /> Log in to pay
            </Link>
          )}
          <p className="mt-3 border-t border-orange-200/70 pt-3 text-xs text-slate-600">
            Prefer to pay later? <Link href="/student/login" className="font-semibold text-brand hover:underline">Log in</Link> with the username and password we emailed you and pay from your account before the tournament starts.
          </p>
        </div>
      )}

      {!due && (
        <div className="animate-pop-in mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="flex items-center justify-center gap-2 text-center text-sm font-bold text-emerald-800">
            <Ticket size={16} /> {paidNow ? "Payment received — " : "Free entry — "}your Tournament Entry Pass{entries.length > 1 ? "es are" : " is"} ready
          </p>
          <p className="mt-0.5 text-center text-xs text-emerald-700">
            We&apos;ve emailed {entries.length > 1 ? "one PDF for each event" : "it to you"}. Print {entries.length > 1 ? "each" : "it"} on A4 and bring {entries.length > 1 ? "them" : "it"} to the weigh-in.
          </p>
          {payToken && (
            <ul className="mt-3 space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-emerald-100">
                  <span className="min-w-0 truncate text-slate-700">{e.ageGroup} · {e.weightCategory}</span>
                  <Button
                    size="sm"
                    icon={<Download size={14} />}
                    loading={downloading === e.id}
                    onClick={async () => {
                      setDownloadError("");
                      setDownloading(e.id);
                      try {
                        await downloadEntryPass(payToken, e, studentNo);
                      } catch (err) {
                        setDownloadError(errorMessage(err));
                      } finally {
                        setDownloading(null);
                      }
                    }}
                  >
                    Entry pass
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {downloadError && <p className="mt-2 text-center text-xs font-medium text-red-600">{downloadError}</p>}
        </div>
      )}

      {note && <div className="mt-4 text-center text-xs text-slate-500">{note}</div>}
      <div className="mt-4 text-center">
        <Link href={`/t/${tournament.slug}`} className="text-sm font-semibold text-brand hover:underline">View tournament</Link>
      </div>
    </div>
  );
}

// ─── Returning player: enter more events ─────────────────────────────────────

/**
 * A registered student (identified by ID + date of birth) chooses the events to enter. With an
 * entry fee each event is unpaid until paid.
 */
export function TournamentEntry({ tournament, studentNo, dob, banner }: { tournament: Tournament; studentNo: string; dob: string; banner?: React.ReactNode }) {
  const lockGender = tournament.gender === "BOTH" ? undefined : tournament.gender;
  const base = `/public/tournaments/${tournament.slug}/entry`;

  const [check, setCheck] = useState<CheckResult | null>(null);
  const [loadError, setLoadError] = useState("");
  const [events, setEvents] = useState<EventsValue>({ ...emptyEvents, competeAs: lockGender ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Entry[] | null>(null);
  const [payToken, setPayToken] = useState<string | null>(null);
  // When registration closes while the page is open, ask again.
  const phase = registrationPhase(tournament, useNow(15_000));

  useEffect(() => {
    let cancelled = false;
    api<CheckResult>(`${base}/check`, { body: { studentNo, dob } })
      .then((r) => {
        if (cancelled) return;
        setCheck(r);
        setPayToken(r.payToken);
        setLoadError("");
        if (r.entries[0]) setEvents((v) => (v.weight ? v : { ...v, weight: String(r.entries[0]!.weightKg) }));
        if (r.entries.length && r.entries.length >= r.ageGroups.length) setDone(r.entries);
      })
      .catch((err) => !cancelled && setLoadError(errorMessage(err)));
    return () => { cancelled = true; };
  }, [base, studentNo, dob, phase]);

  if (loadError) return <ErrorText>{loadError}</ErrorText>;
  if (!check) return <Spinner />;
  if (done) return <EntryDone name={check.student.fullName} studentNo={check.student.studentNo} entries={done} tournament={tournament} payToken={payToken} />;

  const isOther = check.student.gender === "OTHER";
  const entered = new Map(check.entries.map((e) => [e.ageGroup, e.weightCategory]));
  const open = check.ageGroups.filter((g) => !entered.has(g));
  const fresh = events.ageGroups.filter((g) => open.includes(g));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = eventsProblem(events, open, isOther && !lockGender);
    setError(problem ?? "");
    if (problem) return;
    setBusy(true);
    try {
      const { entries, payToken: token } = await api<{ entries: Entry[]; payToken: string }>(base, {
        body: { studentNo, dob, ageGroups: fresh, weightKg: parseFloat(events.weight), competeAs: isOther ? lockGender ?? events.competeAs : undefined },
      });
      setPayToken(token);
      setDone(entries);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const age = competitionAge(dob, tournament.startDate);

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

      <FeeTotal fees={check} count={fresh.length} alreadyEntered={check.entries.length} />

      {!check.genderAllowed ? (
        <ErrorText>This tournament is for {tournament.gender === "MALE" ? "boys" : "girls"} only.</ErrorText>
      ) : !check.ageGroups.length ? (
        <ErrorText>Your age isn&apos;t in this tournament&apos;s groups ({tournament.ageGroups.join(", ")}).</ErrorText>
      ) : (
        <>
          <EventsPicker eligible={check.ageGroups} age={age} gender={check.student.gender} lockGender={lockGender} value={events} onChange={setEvents} entered={entered} />
          {error && <ErrorText>{error}</ErrorText>}
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button type="submit" loading={busy} disabled={!fresh.length} icon={<CheckCircle2 size={16} />} className="h-12 px-10 text-base">
              Confirm {fresh.length > 1 ? `${fresh.length} events` : "registration"}
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
