"use client";

import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Unit } from "@/lib/types";
import { Button, Card, Input } from "./ui";
import { errorMessage, useToast } from "./Toast";

/**
 * Admin → Settings → Units: the units a player can represent instead of a district
 * (counted for the overall championship). Renaming a unit renames it on every player;
 * a unit players represent can't be deleted.
 */
export function UnitsCard() {
  const toast = useToast();
  const { data: units, reload } = useApi<Unit[]>("/units");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await api("/units", { body: { name } });
      setName("");
      reload();
      toast("Unit added.");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setAdding(false);
    }
  }

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(editing.id);
    try {
      await api(`/units/${editing.id}`, { method: "PUT", body: { name: editing.name } });
      setEditing(null);
      reload();
      toast("Unit renamed.");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  async function remove(u: Unit) {
    if (!confirm(`Delete the unit "${u.name}"?`)) return;
    setBusy(u.id);
    try {
      await api(`/units/${u.id}`, { method: "DELETE" });
      reload();
      toast("Unit deleted.");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-bold text-slate-800">Units</h2>
      <p className="mt-1 text-xs text-slate-500">Players choose to represent a district or one of these units. Their medals count towards it in the overall championship.</p>

      <form onSubmit={add} className="mt-4 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New unit name, e.g. Police" maxLength={120} />
        <Button type="submit" icon={<Plus size={16} />} loading={adding} disabled={!name.trim()}>Add</Button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {!units ? (
          <li className="px-4 py-3 text-sm text-slate-400">Loading…</li>
        ) : units.length === 0 ? (
          <li className="px-4 py-3 text-sm text-slate-400">No units yet.</li>
        ) : (
          units.map((u) => (
            <li key={u.id} className="flex items-center gap-2 px-4 py-2.5">
              {editing?.id === u.id ? (
                <form onSubmit={rename} className="flex flex-1 items-center gap-2">
                  <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={120} />
                  <Button type="submit" size="sm" icon={<Check size={14} />} loading={busy === u.id} aria-label="Save" />
                  <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => setEditing(null)} aria-label="Cancel" />
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-slate-800">{u.name}</span>
                  <span className="text-xs text-slate-400">{u.players ?? 0} player{u.players === 1 ? "" : "s"}</span>
                  <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing({ id: u.id, name: u.name })} aria-label={`Rename ${u.name}`} />
                  <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} loading={busy === u.id} disabled={!!u.players} title={u.players ? "Players represent this unit" : undefined} onClick={() => remove(u)} aria-label={`Delete ${u.name}`} />
                </>
              )}
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
