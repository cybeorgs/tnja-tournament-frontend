"use client";

import { useState } from "react";
import { BellRing, Mail, RotateCw } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useNow } from "@/lib/hooks";
import { formatDateTime } from "@/lib/format";
import { registrationPhase, type EmailKind, type EmailLogEntry, type TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Spinner } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";
import { IconButton } from "./RegistrationsTab";

const KIND_LABEL: Record<EmailKind, string> = { CONFIRMATION: "Registration confirmation", REMINDER: "Deadline reminder", PAYMENT: "Payment success" };
const STATUS = {
  SENT: { label: "Delivered to mail server", color: "green" },
  FAILED: { label: "Failed", color: "red" },
  NOT_CONFIGURED: { label: "Not sent — SMTP not set up", color: "yellow" },
} as const;

/** The three tournament emails: what was sent, whether it went through, and sending one now. */
export function EmailsTab({ tournament: t }: { tournament: TournamentDetail }) {
  const toast = useToast();
  const { data: logs, loading, error, reload } = useApi<EmailLogEntry[]>(`/tournaments/${t.id}/emails`);
  const [busy, setBusy] = useState<string | null>(null);
  const phase = registrationPhase(t, useNow());
  const canRemind = phase === "OPEN";

  async function send(key: string, body: { kind: EmailKind; studentId?: string }) {
    setBusy(key);
    try {
      const res = await api<{ sent: number; status?: string | null; error?: string }>(`/tournaments/${t.id}/emails`, { body });
      if (res.status === "FAILED") toast(`Email failed: ${res.error}`, false);
      else toast(res.sent ? `${res.sent} email${res.sent === 1 ? "" : "s"} sent.` : "Nobody to send to — everyone has paid or already had this email.");
      reload();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  const counts = (logs ?? []).reduce((acc, l) => ({ ...acc, [l.status]: (acc[l.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><BellRing size={18} /></span>
          <div className="text-sm">
            <p className="font-semibold text-slate-900">Deadline reminder</p>
            <p className="mt-0.5 text-slate-500">
              {t.reminderAt ? `Scheduled for ${formatDateTime(t.reminderAt)}` : "No reminder scheduled (set one in Overview → Edit)"} · goes only to players with unpaid entries, before the regular deadline ({formatDateTime(t.registrationClosesAt)}).
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon={<Mail size={15} />}
          loading={busy === "remind-all"}
          disabled={!canRemind}
          title={canRemind ? "" : "Only while regular registration is open"}
          onClick={() => send("remind-all", { kind: "REMINDER" })}
          className="shrink-0"
        >
          Send reminder now
        </Button>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
          <p className="text-sm text-slate-500">
            Registration confirmations, deadline reminders and payment receipts. Each is sent automatically once; resend one here if needed.
          </p>
          <div className="flex gap-1.5">
            {counts.SENT ? <Badge color="green">{counts.SENT} delivered</Badge> : null}
            {counts.FAILED ? <Badge color="red">{counts.FAILED} failed</Badge> : null}
            {counts.NOT_CONFIGURED ? <Badge color="yellow">{counts.NOT_CONFIGURED} not sent</Badge> : null}
          </div>
        </div>

        {loading && !logs ? (
          <Spinner />
        ) : error ? (
          <EmptyState title="Could not load emails">{error}</EmptyState>
        ) : !logs?.length ? (
          <EmptyState icon={<Mail size={40} />} title="No emails yet">They appear here as players register and pay.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Sent</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">To</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Resend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {formatDateTime(l.createdAt)}
                      <p className="text-slate-400">{l.trigger === "MANUAL" ? "By admin" : "Automatic"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{KIND_LABEL[l.kind]}</p>
                      <p className="text-xs text-slate-400">{l.subject}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{l.studentName ?? "—"}</p>
                      <p className="text-xs text-slate-500">{l.toEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS[l.status].color}>{STATUS[l.status].label}</Badge>
                      {l.error && <p className="mt-1 max-w-xs text-xs text-red-600">{l.error}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {l.studentId && (l.kind !== "REMINDER" || canRemind) && (
                          <IconButton label={`Send ${KIND_LABEL[l.kind].toLowerCase()} again`} onClick={() => send(l.id, { kind: l.kind, studentId: l.studentId! })}>
                            <RotateCw size={15} className={busy === l.id ? "animate-spin" : undefined} />
                          </IconButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
