"use client";

import { useEffect, useState } from "react";
import { History, Loader2, Lock, Search } from "lucide-react";
import { useApi } from "@/lib/hooks";
import type { Paged } from "@/lib/types";
import { Button, Card, EmptyState, Input, PageHeader, Spinner, cx } from "@/components/ui";
import { AUDIT_FILTERS, AuditTimeline, type AuditEntry, type AuditFilter } from "@/components/AuditLog";

type AuditPage = Paged<AuditEntry> & { counts?: Partial<Record<"ALL" | AuditFilter, number>> };

/** Every change ever made to a student record and their entries, newest first. Read-only. */
export default function AuditLogPage() {
  const [action, setAction] = useState<"" | AuditFilter>("");
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
  const { data, loading, error, reload } = useApi<AuditPage>(`/audit/students?${params}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filterLabel = AUDIT_FILTERS.find((f) => f.id === action)?.label ?? "All changes";

  function pick(next: "" | AuditFilter) {
    setAction(next);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Audit log"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Lock size={13} className="text-slate-400" /> Every change to a student, their tournament entries and payments, with the exact time. Permanent — entries can&apos;t be edited or deleted.
          </span>
        }
      />

      <Card>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search student name, student ID, admin, tournament or remark"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              className="bg-slate-50/60 pl-10 focus:bg-white"
            />
          </div>
          <div role="tablist" aria-label="Filter changes" className="flex flex-wrap gap-1.5">
            {AUDIT_FILTERS.map((f) => {
              const count = data?.counts?.[f.id || "ALL"];
              const on = action === f.id;
              return (
                <button
                  key={f.id || "all"}
                  role="tab"
                  aria-selected={on}
                  title={f.hint}
                  onClick={() => pick(f.id)}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {f.label}
                  {count !== undefined && (
                    <span className={cx("rounded-full px-1.5 text-[10px] tabular-nums", on ? "bg-white/20" : "bg-white text-slate-500")}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500">{AUDIT_FILTERS.find((f) => f.id === action)?.hint}</p>
        </div>

        <div className="relative p-4 sm:p-5">
          {loading && data && (
            <div className="absolute right-4 top-3 flex items-center gap-1.5 text-xs text-slate-400" aria-live="polite">
              <Loader2 size={13} className="animate-spin" /> Loading…
            </div>
          )}
          {loading && !data ? (
            <Spinner />
          ) : error ? (
            <EmptyState title="Couldn't load the audit log">
              {error}
              <div className="mt-3"><Button size="sm" variant="secondary" onClick={reload}>Try again</Button></div>
            </EmptyState>
          ) : !data?.items.length ? (
            <EmptyState icon={<History size={40} />} title={action || debounced ? `No ${filterLabel.toLowerCase()} found` : "Nothing logged yet"}>
              {debounced || action ? "No changes match these filters." : "Changes to students, entries and payments will appear here."}
            </EmptyState>
          ) : (
            // Faded while the next filter / page loads, so a click always shows it was taken.
            <div className={cx("transition-opacity", loading && "pointer-events-none opacity-50")}>
              <AuditTimeline entries={data.items} showStudent />
            </div>
          )}
        </div>

        {data && !error && pages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>Page {page} of {pages} · {data.total} changes</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Newer</Button>
              <Button variant="secondary" size="sm" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Older</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
