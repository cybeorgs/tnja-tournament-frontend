"use client";

import { ArrowRight, CheckCircle2, Pencil, Trash2, UserPlus, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime } from "@/lib/format";
import { cx } from "./ui";

export type AuditAction = "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "DELETED";

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

export const ACTION: Record<AuditAction, { label: string; icon: ReactNode; tone: string }> = {
  CREATED: { label: "Created", icon: <UserPlus size={14} />, tone: "bg-blue-50 text-blue-700 ring-blue-600/15" },
  UPDATED: { label: "Edited", icon: <Pencil size={14} />, tone: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  APPROVED: { label: "Approved", icon: <CheckCircle2 size={14} />, tone: "bg-emerald-50 text-emerald-700 ring-emerald-600/15" },
  REJECTED: { label: "Rejected", icon: <XCircle size={14} />, tone: "bg-red-50 text-red-700 ring-red-600/15" },
  DELETED: { label: "Deleted", icon: <Trash2 size={14} />, tone: "bg-slate-100 text-slate-700 ring-slate-500/15" },
};

const ACTOR: Record<AuditEntry["actorType"], string> = { ADMIN: "Admin", STUDENT: "Student", IMPORT: "Excel import" };

/** Exact time, to the second, in India. */
export const auditTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });

/** A timeline of audit entries, newest first. `showStudent` adds who the record belongs to (for the full log). */
export function AuditTimeline({ entries, showStudent }: { entries: AuditEntry[]; showStudent?: boolean }) {
  return (
    <ol className="relative space-y-3 border-l-2 border-slate-100 pl-5">
      {entries.map((e) => {
        const a = ACTION[e.action];
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
                by <span className="font-medium text-slate-700">{ACTOR[e.actorType]}{e.actor ? ` · ${e.actor}` : ""}</span>
                {e.note && <> · {e.note}</>}
              </p>
              {e.changes.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                  {e.changes.map((c) => (
                    <li key={c.field} className="grid grid-cols-[8.5rem_1fr] gap-2 sm:grid-cols-[10rem_1fr]">
                      <span className="font-medium text-slate-500">{c.label}</span>
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300">{c.from || "empty"}</span>
                        <ArrowRight size={12} className="shrink-0 text-slate-400" />
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800">{c.to || "empty"}</span>
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
