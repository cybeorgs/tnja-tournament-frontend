"use client";

import { ArrowRight, CheckCircle2, History, IndianRupee, ListPlus, MinusCircle, Pencil, SquarePen, Trash2, UserPlus, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/format";
import { cx } from "./ui";

export type AuditAction = "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "DELETED" | "ENTRY_ADDED" | "ENTRY_UPDATED" | "ENTRY_REMOVED" | "PAYMENT";

/** The filters of the audit page; the server matches each to every action of its kind. */
export type AuditFilter = "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "DELETED" | "PAYMENT";
export const AUDIT_FILTERS: { id: "" | AuditFilter; label: string; hint: string }[] = [
  { id: "", label: "All changes", hint: "Everything" },
  { id: "CREATED", label: "Created", hint: "New students and new tournament entries" },
  { id: "UPDATED", label: "Edited", hint: "Student details, entry category / weight and weigh-ins" },
  { id: "PAYMENT", label: "Payment", hint: "Marked paid / unpaid by an admin, or paid online" },
  { id: "DELETED", label: "Deleted", hint: "Deleted students and removed tournament entries" },
  { id: "APPROVED", label: "Approved", hint: "Applications approved" },
  { id: "REJECTED", label: "Rejected", hint: "Applications rejected" },
];

/** One entry of the permanent student audit log (written by the server, never editable). */
export interface AuditEntry {
  id: string;
  studentId: string;
  studentNo: string | null;
  studentName: string;
  action: AuditAction;
  actorType: "ADMIN" | "STUDENT" | "IMPORT";
  actor: string;
  changes: { field: string; label: string; from: string; to: string }[];
  note: string;
  createdAt: string;
}

type ActionStyle = { label: string; icon: ReactNode; tone: string };

export const ACTION: Record<AuditAction, ActionStyle> = {
  CREATED: { label: "Student created", icon: <UserPlus size={14} />, tone: "bg-blue-50 text-blue-700 ring-blue-600/15" },
  UPDATED: { label: "Student edited", icon: <Pencil size={14} />, tone: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  APPROVED: { label: "Approved", icon: <CheckCircle2 size={14} />, tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  REJECTED: { label: "Rejected", icon: <XCircle size={14} />, tone: "bg-red-50 text-red-700 ring-red-600/15" },
  DELETED: { label: "Student deleted", icon: <Trash2 size={14} />, tone: "bg-slate-100 text-slate-700 ring-slate-500/15" },
  ENTRY_ADDED: { label: "Entry added", icon: <ListPlus size={14} />, tone: "bg-sky-50 text-sky-700 ring-sky-600/15" },
  ENTRY_UPDATED: { label: "Entry edited", icon: <SquarePen size={14} />, tone: "bg-orange-50 text-orange-700 ring-orange-600/15" },
  ENTRY_REMOVED: { label: "Entry removed", icon: <MinusCircle size={14} />, tone: "bg-rose-50 text-rose-700 ring-rose-600/15" },
  PAYMENT: { label: "Payment", icon: <IndianRupee size={14} />, tone: "bg-teal-50 text-teal-700 ring-teal-600/15" },
};

/** An action this page doesn't know yet (a newer server) still shows, instead of breaking the page. */
const actionStyle = (action: string): ActionStyle =>
  ACTION[action as AuditAction] ?? { label: action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " "), icon: <History size={14} />, tone: "bg-slate-100 text-slate-700 ring-slate-500/15" };

const ACTOR: Record<string, string> = { ADMIN: "Admin", STUDENT: "Student", IMPORT: "Excel import" };

/** "… — Remark: paid at the desk" → the main note and the remark / reason, shown on its own line. */
function splitNote(note: string): { main: string; remark: string } {
  const m = /^(.*?) — ((?:Remark|Reason): .*)$/s.exec(note);
  return m ? { main: m[1]!, remark: m[2]! } : { main: note, remark: "" };
}

/** Exact time, to the second, in India. */
export const auditTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });

/** A timeline of audit entries, newest first. `showStudent` adds who the record belongs to (for the full log). */
export function AuditTimeline({ entries, showStudent }: { entries: AuditEntry[]; showStudent?: boolean }) {
  return (
    <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
      {entries.map((e) => {
        const a = actionStyle(e.action);
        const { main, remark } = splitNote(e.note);
        return (
          <li key={e.id} className="relative">
            <span className={cx("absolute -left-[31px] top-0.5 flex h-6 w-6 items-center justify-center rounded-full ring-1 ring-inset", a.tone)}>{a.icon}</span>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-slate-800">
                  {a.label}
                  {showStudent && (
                    <>
                      {" · "}
                      <span className="text-slate-900">{e.studentName}</span>
                      {e.studentNo && <span className="ml-1.5 font-mono text-xs font-semibold text-brand">{e.studentNo}</span>}
                    </>
                  )}
                </p>
                <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)} className="font-mono text-[11px] text-slate-500">{auditTime(e.createdAt)} IST</time>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                by <span className="font-medium text-slate-700">{ACTOR[e.actorType] ?? e.actorType}{e.actor ? ` · ${e.actor}` : ""}</span>
                {main && <> · {main}</>}
              </p>
              {remark && <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 [overflow-wrap:anywhere]">{remark}</p>}
              {e.changes.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                  {e.changes.map((c) => (
                    <li key={c.field} className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[10rem_1fr]">
                      <span className="font-medium text-slate-500">{c.label}</span>
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {c.from ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300">{c.from}</span> : <span className="text-slate-400">—</span>}
                        <ArrowRight size={12} className="shrink-0 text-slate-400" />
                        {c.to ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">{c.to}</span> : <span className="text-slate-400">—</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
