"use client";

import { useEffect, useState } from "react";
import { History, Lock, Search } from "lucide-react";
import { useApi } from "@/lib/hooks";
import type { Paged } from "@/lib/types";
import { Button, Card, EmptyState, Input, PageHeader, Spinner, cx } from "@/components/ui";
import { ACTION, AuditTimeline, type AuditAction, type AuditEntry } from "@/components/AuditLog";

const FILTERS: ("" | AuditAction)[] = ["", "UPDATED", "CREATED", "APPROVED", "REJECTED", "DELETED"];

/** Every change ever made to a student record, newest first. Read-only: entries can never be changed. */
export default function AuditLogPage() {
  const [action, setAction] = useState<"" | AuditAction>("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (action) params.set("action", action);
  if (debounced) params.set("q", debounced);
  const { data, loading, error } = useApi<Paged<AuditEntry>>(`/audit/students?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Audit log"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={13} className="text-slate-400" /> Every change to a student record, with the exact time. Permanent — entries can&apos;t be edited or deleted.
          </span>
        }
      />

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search student name, student ID or who made the change" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="bg-slate-50/60 pl-10 focus:bg-white" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((a) => (
              <button
                key={a || "all"}
                onClick={() => { setAction(a); setPage(1); }}
                className={cx(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  action === a ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {a ? ACTION[a].label : "All changes"}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {loading && !data ? (
            <Spinner />
          ) : error ? (
            <EmptyState title="Couldn't load the audit log">{error}</EmptyState>
          ) : !data?.items.length ? (
            <EmptyState icon={<History size={40} />} title="Nothing logged yet">
              {debounced || action ? "No changes match these filters." : "Changes to student records will appear here."}
            </EmptyState>
          ) : (
            <AuditTimeline entries={data.items} showStudent />
          )}
        </div>

        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>Page {page} of {pages} · {data.total} changes</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
