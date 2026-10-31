"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Paged } from "@/lib/types";
import { Button, Card, EmptyState, Input, Modal, PageHeader, Spinner } from "./ui";
import { errorMessage, useToast } from "./Toast";

/**
 * Searchable, paged master list with add / edit / delete in a modal.
 * Shared by the Students and Referees pages.
 */
export function PeopleList<T extends { id: string; fullName: string }, F>({
  title, subtitle, endpoint, noun, emptyHint, icon, empty, toForm, toBody, columns, renderForm, validate, onView, searchPlaceholder = "Search",
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  noun: string;
  emptyHint: string;
  icon: ReactNode;
  empty: F;
  toForm: (item: T) => F;
  toBody: (form: F) => unknown;
  columns: { header: string; cell: (item: T) => ReactNode; className?: string }[];
  renderForm: (value: F, onChange: (v: F) => void) => ReactNode;
  validate?: (form: F) => string | null;
  /** Adds a "view" action to each row */
  onView?: (item: T) => void;
  searchPlaceholder?: string;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [form, setForm] = useState<F>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => { setDebounced(q); setPage(1); }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  const { data, loading, error, reload } = useApi<Paged<T>>(`${endpoint}?page=${page}&pageSize=50&q=${encodeURIComponent(debounced)}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const open = (item: T | "new") => {
    setForm(item === "new" ? empty : toForm(item));
    setEditing(item);
  };

  async function save() {
    const problem = validate?.(form);
    if (problem) return toast(problem, false);
    setSaving(true);
    try {
      if (editing === "new") await api(endpoint, { body: toBody(form) });
      else if (editing) await api(`${endpoint}/${editing.id}`, { method: "PUT", body: toBody(form) });
      toast(editing === "new" ? `${noun} added.` : "Saved.");
      setEditing(null);
      reload();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: T) {
    if (!confirm(`Delete ${item.fullName}?`)) return;
    try {
      await api(`${endpoint}/${item.id}`, { method: "DELETE" });
      toast(`${noun} deleted.`);
      reload();
    } catch (err) {
      const message = errorMessage(err);
      toast(/in use/.test(message) ? `${item.fullName} is entered in a tournament, so they can't be deleted.` : message, false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={title} subtitle={subtitle} actions={<Button icon={<Plus size={16} />} onClick={() => open("new")}>Add {noun.toLowerCase()}</Button>} />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <EmptyState title="Could not load the list">{error}</EmptyState>
        ) : !data?.items.length ? (
          <EmptyState icon={icon} title={debounced ? "Nobody matches that search" : `No ${title.toLowerCase()} yet`}>{debounced ? "Try another name." : emptyHint}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((c) => <th key={c.header} className={`px-4 py-2.5 ${c.className ?? ""}`}>{c.header}</th>)}
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    {columns.map((c) => <td key={c.header} className={`px-4 py-3 ${c.className ?? ""}`}>{c.cell(item)}</td>)}
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {onView && <button onClick={() => onView(item)} className="rounded-lg p-2 text-slate-400 hover:bg-orange-50 hover:text-brand" aria-label="View"><Eye size={15} /></button>}
                        <button onClick={() => open(item)} className="rounded-lg p-2 text-slate-400 hover:bg-orange-50 hover:text-brand" aria-label="Edit"><Pencil size={15} /></button>
                        <button onClick={() => remove(item)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>{data.total} total</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft size={14} />}>Prev</Button>
              <span>{page} / {pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight size={14} /></Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? `Add ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={saving} onClick={save}>Save</Button>
          </>
        }
      >
        {editing && renderForm(form, setForm)}
      </Modal>
    </div>
  );
}
