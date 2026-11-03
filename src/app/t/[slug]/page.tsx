"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Award, CalendarDays, Download, Eye, IndianRupee, LayoutGrid, MapPin, Medal, Search, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { api, openPdf } from "@/lib/api";
import { useApi, useNow } from "@/lib/hooks";
import { categoryLabel, formatDateRange, formatDateTime, rupees, titleCase } from "@/lib/format";
import { currentEntryFee, lateEntryFee, registrationPhase, type Draw, type Tournament } from "@/lib/types";
import { Badge, Button, Card, DateInput, EmptyState, Field, Input, Select, Spinner, cx } from "@/components/ui";
import { Bracket } from "@/components/Bracket";
import { PublicShell } from "@/components/PublicShell";
import { errorMessage, useToast } from "@/components/Toast";

interface PublicDetail extends Tournament {
  entries: number;
  categories: { label: string; entrants: number }[];
  officials: { name: string; grade: string; district: string; role: string; matNumber: number | null }[];
  draws: Pick<Draw, "id" | "ageGroup" | "gender" | "weightCategory" | "format" | "matNumber" | "isConcluded" | "rounds" | "entrants" | "standings" | "matchesTotal" | "matchesDone">[];
  results: { category: string; first: Person[]; second: Person[]; third: Person[] }[];
}
type Person = { name: string; club: string };

const TABS = [
  { id: "info", label: "Info", icon: LayoutGrid },
  { id: "brackets", label: "Brackets", icon: Swords },
  { id: "results", label: "Results", icon: Trophy },
  { id: "certificates", label: "Certificates", icon: Award },
] as const;

export default function PublicTournamentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: t, loading, error } = useApi<PublicDetail>(`/public/tournaments/${slug}`);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("info");

  return (
    <PublicShell>
      {loading ? (
        <Spinner />
      ) : error || !t ? (
        <EmptyState title="Tournament not found">This tournament may not be published yet.</EmptyState>
      ) : (
        <>
          <section className="mb-6">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge color="orange">{titleCase(t.level)}</Badge>
              {t.status === "COMPLETED" && <Badge color="green">Completed</Badge>}
              {t.resultsPublished && <Badge color="yellow">Results out</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{t.title}</h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <span className="flex items-center gap-2"><CalendarDays size={16} className="text-brand" /> {formatDateRange(t.startDate, t.endDate)}</span>
              <span className="flex items-center gap-2"><MapPin size={16} className="text-brand" /> {[t.venue, t.city].filter(Boolean).join(", ")}</span>
              <span className="flex items-center gap-2"><Users size={16} className="text-brand" /> {t.entries} entries</span>
            </div>
            <RegistrationStatus tournament={t} />
          </section>

          <div className="no-print -mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-max gap-1" role="tablist">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cx("flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold", tab === id ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800")}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "info" && <InfoTab t={t} />}
          {tab === "brackets" && <BracketsTab t={t} />}
          {tab === "results" && <ResultsTab t={t} />}
          {tab === "certificates" && <CertificatesTab t={t} />}
        </>
      )}
    </PublicShell>
  );
}

function InfoTab({ t }: { t: PublicDetail }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {t.description && (
          <Card className="p-5">
            <h2 className="mb-2 font-bold text-slate-800">About</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{t.description}</p>
          </Card>
        )}
        <Card className="p-5">
          <h2 className="mb-3 font-bold text-slate-800">Age groups</h2>
          <div className="flex flex-wrap gap-2">{t.ageGroups.map((g) => <Badge key={g} color="orange">{g}</Badge>)}</div>
          <p className="mt-3 text-sm text-slate-500">Open to {t.gender === "BOTH" ? "boys and girls" : t.gender === "MALE" ? "boys / men" : "girls / women"} · {t.numberOfMats} mat{t.numberOfMats > 1 ? "s" : ""}</p>
        </Card>
        {t.categories.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-3 font-bold text-slate-800">Categories</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {t.categories.map((c) => (
                <li key={c.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-700">{c.label}</span>
                  <span className="font-semibold text-slate-500">{c.entrants}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card className="h-fit p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-800"><ShieldCheck size={18} className="text-brand" /> Officials</h2>
        {t.officials.length === 0 ? (
          <p className="text-sm text-slate-500">To be announced.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {t.officials.map((o, i) => (
              <li key={i} className="py-2">
                <p className="text-sm font-semibold text-slate-800">{o.name}</p>
                <p className="text-xs text-slate-500">{[titleCase(o.role), o.grade, o.matNumber ? `Mat ${o.matNumber}` : ""].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function BracketsTab({ t }: { t: PublicDetail }) {
  const [selected, setSelected] = useState(t.draws[0]?.id ?? "");
  const draw = t.draws.find((d) => d.id === selected);
  if (!t.draws.length) return <Card><EmptyState icon={<Swords size={40} />} title="Draws not out yet">Brackets appear here once the organiser makes the draw.</EmptyState></Card>;
  return (
    <Card className="p-5">
      <Field label="Category" className="mb-5 max-w-md">
        <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {t.draws.map((d) => <option key={d.id} value={d.id}>{categoryLabel(d)} — Mat {d.matNumber}</option>)}
        </Select>
      </Field>
      {draw && (
        <>
          <p className="mb-4 text-sm text-slate-500">{draw.format === "ROUND_ROBIN" ? "Round robin" : "Elimination"} · {draw.matchesDone}/{draw.matchesTotal} matches played{draw.isConcluded && " · Final"}</p>
          <Bracket draw={draw} />
        </>
      )}
    </Card>
  );
}

function ResultsTab({ t }: { t: PublicDetail }) {
  if (!t.resultsPublished) return <Card><EmptyState icon={<Trophy size={40} />} title="Results not published yet">Results appear here once the organiser publishes them.</EmptyState></Card>;
  if (!t.results.length) return <Card><EmptyState icon={<Trophy size={40} />} title="No categories concluded yet" /></Card>;
  const row = (icon: React.ReactNode, people: Person[]) =>
    people.map((p, i) => (
      <li key={i} className="flex items-center gap-3 py-1.5">
        {icon}
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800">{p.name}</span><span className="block truncate text-xs text-slate-500">{p.club}</span></span>
      </li>
    ));
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {t.results.map((r) => (
        <Card key={r.category} className="p-4">
          <p className="mb-2 text-sm font-bold text-slate-800">{r.category}</p>
          <ul>
            {row(<Trophy size={16} className="shrink-0 text-amber-500" />, r.first)}
            {row(<Medal size={16} className="shrink-0 text-slate-400" />, r.second)}
            {row(<Medal size={16} className="shrink-0 text-orange-600" />, r.third)}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function CertificatesTab({ t }: { t: PublicDetail }) {
  const toast = useToast();
  const [kind, setKind] = useState<"student" | "official">("student");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [found, setFound] = useState<{ certificateNo: string; name: string } | null>(null);
  const [searching, setSearching] = useState(false);

  if (!t.resultsPublished) return <Card><EmptyState icon={<Award size={40} />} title="Certificates not released yet">Certificates appear here once results are out.</EmptyState></Card>;

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setFound(null);
    setSearching(true);
    try {
      setFound(await api(`/public/tournaments/${t.slug}/certificate-lookup`, { body: kind === "student" ? { kind, name, dob } : { kind, name, phone } }));
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSearching(false);
    }
  }

  const pdf = (mode: "view" | "download") => found && openPdf(`/public/certificates/${found.certificateNo}`, mode, `${found.name}_certificate.pdf`).catch((err) => toast(errorMessage(err), false));

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h2 className="font-bold text-slate-800">Get your certificate</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">Enter your name exactly as registered.</p>
      <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {(["student", "official"] as const).map((k) => (
          <button key={k} onClick={() => { setKind(k); setFound(null); }} className={cx("rounded-md px-3 py-1.5 font-semibold", kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            {k === "student" ? "Athlete" : "Referee / official"}
          </button>
        ))}
      </div>
      <form onSubmit={lookup} className="space-y-3">
        <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        {kind === "student"
          ? <Field label="Date of birth"><DateInput value={dob} onChange={setDob} required /></Field>
          : <Field label="Phone number" hint="The last 4 digits are enough"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>}
        <Button type="submit" loading={searching} icon={<Search size={16} />} className="w-full">Find certificate</Button>
      </form>
      {found && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Certificate found for {found.name}</p>
          <p className="font-mono text-xs text-emerald-700">{found.certificateNo}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" icon={<Eye size={14} />} onClick={() => pdf("view")}>View</Button>
            <Button size="sm" icon={<Download size={14} />} onClick={() => pdf("download")}>Download PDF</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Where registration stands right now (it follows the schedule and updates on its own), with the fee and a Register button. */
function RegistrationStatus({ tournament: t }: { tournament: Tournament }) {
  const now = useNow();
  const phase = registrationPhase(t, now);
  const fee = (n: number) => (n > 0 ? rupees(n) : "free");
  if (phase === "CLOSED") return null;

  return (
    <div className="no-print mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        {phase === "NOT_OPEN" && (
          <>
            <p className="font-semibold text-slate-900">Registration opens on {formatDateTime(t.registrationOpensAt)}</p>
            <p className="mt-0.5 text-slate-500">Entry fee {fee(t.entryFee)} until {formatDateTime(t.registrationClosesAt)}, then {fee(lateEntryFee(t))}.</p>
          </>
        )}
        {phase === "OPEN" && (
          <>
            <p className="flex items-center gap-1.5 font-semibold text-slate-900"><IndianRupee size={15} className="text-brand" /> Entry fee {fee(t.entryFee)}</p>
            <p className="mt-0.5 text-slate-500">
              Until {formatDateTime(t.registrationClosesAt)}.{t.entryFee > 0 && ` After that, late registration costs ${fee(lateEntryFee(t))}.`}
            </p>
          </>
        )}
        {phase === "LATE" && (
          <>
            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Badge color="red">Late registration</Badge> Entry fee {fee(currentEntryFee(t, now))}
            </p>
            <p className="mt-0.5 text-slate-500">Open until the tournament starts on {formatDateTime(t.startDate)}.</p>
          </>
        )}
      </div>
      {(phase === "OPEN" || phase === "LATE") && (
        <Link href={`/enter?t=${t.slug}`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
          <Trophy size={16} /> Register
        </Link>
      )}
    </div>
  );
}
