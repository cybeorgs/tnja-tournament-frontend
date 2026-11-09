"use client";

import { useEffect, useState } from "react";
import { Ban, Mail, PauseCircle, Search, Send, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Paged } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner, cx } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";

type Category = "OTP" | "REGISTRATION" | "ENTRY_PASS" | "PASSWORD_RESET" | "ADMIN";
type Budget = { category: Category; label: string; limit: number | null; sent: number; remaining: number | null };
type Overview = { transport: "smtp" | "console"; productionDeployment: boolean; budgets: Budget[]; held: number };
type EmailRow = {
  id: string; kind: string; category: Category; trigger: string; actor: string; toEmail: string; subject: string;
  status: string; error: string; attempts: number; messageId: string; createdAt: string; sentAt: string | null;
};
type Suppression = { email: string; reason: string; source: string; detail: string; updatedAt: string };

const STATUS: Record<string, { label: string; color: "green" | "red" | "yellow" | "slate" | "blue" | "orange" }> = {
  SENT: { label: "Sent", color: "green" },
  LOGGED: { label: "Console (dev)", color: "slate" },
  SENDING: { label: "Sending", color: "blue" },
  FAILED: { label: "Failed", color: "red" },
  SUPPRESSED: { label: "Suppressed", color: "red" },
  HELD: { label: "Held (limit)", color: "yellow" },
  LIMITED: { label: "Refused (limit)", color: "orange" },
  UNCERTAIN: { label: "Maybe sent", color: "orange" },
  RELEASED: { label: "Sent later", color: "slate" },
};
const KIND: Record<string, string> = {
  OTP: "Verification code", REGISTRATION_SUCCESS: "Registration", APPLICATION_RECEIVED: "Application received",
  REGISTRATION_APPROVED: "Approval", PASSWORD_RESET: "Password reset", ENTRY_PASS: "Entry pass",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** What the app emails, today's sending limits, emails held by a limit, and addresses we no longer email. */
export default function EmailsPage() {
  const toast = useToast();
  const { data: overview, reload: reloadOverview } = useApi<Overview>("/email/overview");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (status) params.set("status", status);
  if (category) params.set("category", category);
  if (debounced) params.set("q", debounced);
  const { data: log, loading, reload: reloadLog } = useApi<Paged<EmailRow>>(`/email/messages?${params}`);
  const pages = log ? Math.max(1, Math.ceil(log.total / log.pageSize)) : 1;

  async function sendHeld() {
    if (!overview?.held || !confirm(`Send the ${overview.held} held email${overview.held === 1 ? "" : "s"} now? Each uses one email credit and must fit today's limit.`)) return;
    setBusy("held");
    try {
      const r = await api<{ sent: number; stillHeld: number; failed: number }>("/email/held/send", { body: {} });
      toast(`Sent ${r.sent}.${r.stillHeld ? ` ${r.stillHeld} still held — today's limit is reached; they can go tomorrow, or after the limit is raised in .env.` : ""}${r.failed ? ` ${r.failed} failed.` : ""}`, !r.failed);
      reloadOverview();
      reloadLog();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Emails"
        subtitle="Every email the system sends, today's sending limits, and addresses we no longer email."
        actions={overview && (
          <Badge color={overview.transport === "smtp" ? "green" : "slate"}>
            {overview.transport === "smtp" ? "Sending via SMTP (Brevo)" : "Console only — nothing is really sent"}
          </Badge>
        )}
      />

      {!!overview?.held && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <PauseCircle className="shrink-0 text-amber-600" />
          <p className="flex-1 text-sm text-amber-900">
            <span className="font-semibold">{overview.held} email{overview.held === 1 ? " is" : "s are"} held</span> because a daily limit was reached. Nothing was lost: send them once there&apos;s room (tomorrow, or after raising the limit in the server&apos;s .env).
          </p>
          <Button icon={<Send size={15} />} loading={busy === "held"} onClick={sendHeld}>Send held emails</Button>
        </div>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Today&apos;s limits</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(overview?.budgets ?? []).map((b) => {
            const cap = b.limit;
            const pct = cap ? Math.min(100, Math.round((b.sent / cap) * 100)) : 0;
            return (
              <Card key={b.category} className="flex flex-col gap-2 p-4">
                <p className="text-xs font-medium text-slate-500">{b.label}</p>
                <p className="text-2xl font-bold leading-none text-slate-900">
                  {b.sent}<span className="text-sm font-medium text-slate-400"> / {cap === null ? "no limit" : cap}</span>
                </p>
                {cap !== null && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={cx("h-full rounded-full", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {b.remaining !== null && <p className="text-[11px] text-slate-500">{b.remaining} left today</p>}
              </Card>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">Limits can only be changed on the server (EMAIL_DAILY_LIMIT_* in .env, then restart the backend). They reset at midnight, India time.</p>
      </section>

      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search recipient, subject or who sent it" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="bg-slate-50/60 pl-10 focus:bg-white" />
          </div>
          <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-44">
            <option value="">All statuses</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select aria-label="Type" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="sm:w-52">
            <option value="">All types</option>
            {(overview?.budgets ?? []).map((b) => <option key={b.category} value={b.category}>{b.label}</option>)}
          </Select>
        </div>
        {loading && !log ? (
          <Spinner />
        ) : !log?.items.length ? (
          <EmptyState icon={<Mail size={40} />} title="No emails yet">Emails appear here as the system sends them.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">To</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Sent by</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {log.items.map((m) => {
                  const s = STATUS[m.status] ?? { label: m.status, color: "slate" as const };
                  return (
                    <tr key={m.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{when(m.createdAt)}</td>
                      <td className="max-w-[14rem] truncate px-4 py-2.5 font-medium text-slate-800" title={m.toEmail}>{m.toEmail}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-800">{KIND[m.kind] ?? m.kind}</p>
                        <p className="max-w-[18rem] truncate text-xs text-slate-500" title={m.subject}>{m.subject}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        <p className="font-semibold">{m.trigger.toLowerCase()}</p>
                        <p className="max-w-[12rem] truncate" title={m.actor}>{m.actor}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={s.color}>{s.label}</Badge>
                        {m.attempts > 1 && <p className="mt-1 text-[11px] text-slate-500">{m.attempts} attempts</p>}
                        {m.error && <p className="mt-1 max-w-[16rem] truncate text-[11px] text-red-600" title={m.error}>{m.error}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {log && pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{log.total} emails</span>
            <div className="flex gap-2">
              <Button variant="secondary" className="h-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" className="h-8" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <Suppressions />
    </div>
  );
}

/** Addresses the system won't email (hard bounces, blocks, spam complaints…), with a way to allow one again. */
function Suppressions() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const { data, reload } = useApi<{ items: Suppression[] }>(`/email/suppressions${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`);

  async function remove(s: Suppression) {
    if (!confirm(`Allow emails to ${s.email} again?\nOnly do this if the address has been fixed — sending to a dead address hurts delivery for everyone.`)) return;
    try {
      await api(`/email/suppressions/${encodeURIComponent(s.email)}`, { method: "DELETE" });
      toast("Removed from the list.");
      reload();
    } catch (err) {
      toast(errorMessage(err), false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <h2 className="flex flex-1 items-center gap-2 font-semibold text-slate-900"><ShieldAlert size={17} className="text-red-500" /> Addresses we don&apos;t email</h2>
        <Input placeholder="Search email" value={q} onChange={(e) => setQ(e.target.value)} className="sm:w-64" />
      </div>
      {!data?.items.length ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">None. Hard bounces, blocked addresses and spam complaints appear here automatically.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {data.items.map((s) => (
            <li key={s.email} className="flex items-center gap-3 px-4 py-2.5">
              <Ban size={15} className="shrink-0 text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">{s.email}</p>
                <p className="truncate text-xs text-slate-500" title={s.detail}>{s.reason.replace("_", " ").toLowerCase()} · {s.source.replace("_", " ").toLowerCase()} · {when(s.updatedAt)}</p>
              </div>
              <Button variant="secondary" className="h-8 text-xs" onClick={() => remove(s)}>Allow again</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
