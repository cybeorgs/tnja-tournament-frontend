"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Mail, MailCheck, Search, Send, Users } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { api } from "@/lib/api";
import { errorMessage, useToast } from "@/components/Toast";
import { formatDate, formatDateTime, rupees } from "@/lib/format";
import type { TournamentListItem } from "@/lib/types";
import { Button, Card, DateInput, EmptyState, Field, Input, PageHeader, Select, Spinner, cx } from "@/components/ui";
import { PaymentsTabs } from "../_components/PaymentsTabs";

interface UnpaidPlayer {
  student: { id: string; studentNo: string | null; fullName: string; phone: string; email: string; district: string; participantType: string };
  events: { id: string; name: string; fee: number }[];
  due: number;
  enteredAt: string;
  lastNotice: { sentAt: string; payBy: string } | null;
}

interface SendResult { players: number; sent: number; alreadySent: number; notSent: number; noEmail: number; notSentDetails: string[] }

/** The admin's local date, n days from today, as YYYY-MM-DD. */
function isoDay(plusDays = 0, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + plusDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Tuesday, 17 November 2026" for a YYYY-MM-DD date. */
const longDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

/**
 * Payments → Unpaid notices: pick a tournament, pick the unpaid players, choose the pay-by date and send
 * "pay by <date>, or your registration will be deleted". Only warns: nothing is deleted automatically.
 */
export default function UnpaidNoticesPage() {
  const toast = useToast();
  const { data: tournaments } = useApi<TournamentListItem[]>("/tournaments");
  const [tournamentId, setTournamentId] = useState("");
  const { data, loading, error, reload } = useApi<{ items: UnpaidPlayer[] }>(tournamentId ? `/payments/unpaid-players?tournamentId=${tournamentId}` : null);
  const tournament = tournaments?.find((t) => t.id === tournamentId);

  const [q, setQ] = useState("");
  const [onlyNotEmailed, setOnlyNotEmailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payBy, setPayBy] = useState(() => isoDay(3));
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState("");

  const players = useMemo(() => data?.items ?? [], [data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) =>
      (!onlyNotEmailed || !p.lastNotice) &&
      (!needle || [p.student.fullName, p.student.studentNo ?? "", p.student.phone, p.student.email].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [players, q, onlyNotEmailed]);
  const chosen = players.filter((p) => selected.has(p.student.id));
  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.student.id));
  const totalDue = chosen.reduce((sum, p) => sum + p.due, 0);
  const emailed = players.filter((p) => p.lastNotice).length;

  function pickTournament(id: string) {
    setTournamentId(id);
    setSelected(new Set());
    setQ("");
    setSendError("");
  }
  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllShown() {
    setSelected((s) => {
      const next = new Set(s);
      for (const p of shown) {
        if (allShownSelected) next.delete(p.student.id);
        else next.add(p.student.id);
      }
      return next;
    });
  }

  const today = isoDay(0);
  const dayBefore = tournament ? isoDay(-1, new Date(tournament.startDate)) : "";
  const quickDates = [
    { label: "In 3 days", value: isoDay(3) },
    { label: "In 7 days", value: isoDay(7) },
    ...(dayBefore && dayBefore >= today ? [{ label: "Day before tournament", value: dayBefore }] : []),
  ];
  const dateProblem = !/^\d{4}-\d{2}-\d{2}$/.test(payBy) ? "Choose the date to pay by." : payBy < today ? "The pay-by date can't be in the past." : "";

  async function send() {
    if (!tournament || !chosen.length || dateProblem) return;
    setSendError("");
    setBusy(true);
    try {
      const r = await api<SendResult>("/payments/unpaid-notice", { body: { tournamentId: tournament.id, payBy, studentIds: chosen.map((p) => p.student.id) } });
      const parts = [
        `${r.sent} sent`,
        r.alreadySent ? `${r.alreadySent} already sent for this date` : "",
        r.notSent ? `${r.notSent} not sent` : "",
        r.noEmail ? `${r.noEmail} without email` : "",
      ].filter(Boolean);
      if (!r.players) toast("No unpaid players to email — they may have paid already.", false);
      else toast(`Unpaid notice: ${parts.join(", ")}.`, !r.notSent);
      if (r.notSentDetails.length) setSendError(`Not sent — ${r.notSentDetails.join("; ")}`);
      setSelected(new Set());
      reload();
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Payments" subtitle="Email players who haven't paid the entry fee." />
      <PaymentsTabs />

      <Card className="mb-4 p-4 sm:p-5">
        <Field label="Tournament" hint="Players with an unpaid entry in this tournament are listed below">
          <Select value={tournamentId} onChange={(e) => pickTournament(e.target.value)} className="sm:max-w-md">
            <option value="">Choose a tournament</option>
            {tournaments?.map((t) => <option key={t.id} value={t.id}>{t.title} · {formatDate(t.startDate)}</option>)}
          </Select>
        </Field>
      </Card>

      {!tournamentId ? (
        <Card><EmptyState icon={<Mail size={40} />} title="Choose a tournament">Then pick the unpaid players to email.</EmptyState></Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem]">
          {/* Players */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Search name, student ID, phone or email" value={q} onChange={(e) => setQ(e.target.value)} className="bg-slate-50/60 pl-10 focus:bg-white" />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={onlyNotEmailed} onChange={(e) => setOnlyNotEmailed(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                Not emailed yet
              </label>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">
              <span><Users size={12} className="mr-1 inline" />{players.length} unpaid {players.length === 1 ? "player" : "players"}</span>
              <span><MailCheck size={12} className="mr-1 inline" />{emailed} already emailed</span>
              <span>Total due {rupees(players.reduce((sum, p) => sum + p.due, 0))}</span>
            </div>

            {loading && !data ? (
              <Spinner />
            ) : error ? (
              <EmptyState title="Couldn't load unpaid players">{error}</EmptyState>
            ) : !players.length ? (
              <EmptyState icon={<MailCheck size={40} />} title="Everyone has paid">No unpaid entries in this tournament.</EmptyState>
            ) : !shown.length ? (
              <EmptyState title="No players match">Try another search.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                <li className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="h-4 w-4 cursor-pointer" aria-label="Select all shown" />
                  Select all shown ({shown.length})
                </li>
                {shown.map((p) => {
                  const on = selected.has(p.student.id);
                  return (
                    <li key={p.student.id}>
                      <label className={cx("flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors", on ? "bg-red-50/60" : "hover:bg-slate-50")}>
                        <input type="checkbox" checked={on} onChange={() => toggle(p.student.id)} className="mt-1 h-4 w-4 cursor-pointer" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="font-semibold text-slate-800">{p.student.fullName}</p>
                            <p className="font-bold text-amber-700">{rupees(p.due)}</p>
                          </div>
                          <p className="truncate text-xs text-slate-500">{[p.student.studentNo, p.student.phone, p.student.email].filter(Boolean).join(" · ")}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{p.events.map((e) => e.name).join(", ")}</p>
                          <p className={cx("mt-1 text-[11px] font-medium", p.lastNotice ? "text-emerald-700" : "text-slate-400")}>
                            {p.lastNotice
                              ? `Notice sent ${formatDateTime(p.lastNotice.sentAt)}${p.lastNotice.payBy ? ` · pay by ${formatDate(p.lastNotice.payBy)}` : ""}`
                              : `Not emailed yet · entered ${formatDate(p.enteredAt)}`}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Date, preview and send */}
          <Card className="p-4 sm:p-5 lg:sticky lg:top-4">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800"><CalendarClock size={17} className="text-brand" /> Pay-by date</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickDates.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setPayBy(d.value)}
                  className={cx("rounded-full border px-3 py-1 text-xs font-semibold transition-colors", payBy === d.value ? "border-brand bg-brand-soft text-brand" : "border-slate-200 text-slate-600 hover:border-slate-300")}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <Field label="Pay by" required className="mt-3" error={dateProblem || undefined}>
              <DateInput value={payBy} min={today} onChange={setPayBy} />
            </Field>
            {!dateProblem && <p className="mt-2 text-sm text-slate-700">Players must pay by <span className="font-semibold">{longDate(payBy)}</span>.</p>}

            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle size={15} /> The email says</p>
              <p className="mt-1 text-xs leading-relaxed">
                A gentle reminder that the registration for <b>{tournament?.title}</b> is still pending because the fee hasn&apos;t been paid. Please pay <b>{payBy === today ? "today" : "by"} {longDate(payBy) || "the date above"}</b>. The pending list is reset at midnight {payBy === today ? "today" : "that day"}; unpaid registrations are removed and must fill the form again. Already paid? Send the payment screenshot to the TNJA Support Team (8667679733, 9159790558). Ends with a <b>Log in</b> button.
              </p>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Selected players</span><span className="font-semibold text-slate-800">{chosen.length}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-slate-500">Their total due</span><span className="font-semibold text-slate-800">{rupees(totalDue)}</span></div>
            </div>

            {sendError && <p className="mt-3 text-xs font-medium text-red-600">{sendError}</p>}
            <Button variant="danger" icon={<Send size={15} />} loading={busy} disabled={!chosen.length || !!dateProblem} onClick={send} className="mt-4 h-11 w-full">
              {chosen.length ? `Send notice to ${chosen.length} ${chosen.length === 1 ? "player" : "players"}` : "Select players to email"}
            </Button>
            <p className="mt-2 text-[11px] leading-snug text-slate-500">Only sends the warning; nothing is deleted automatically. A player gets one email per pay-by date.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
