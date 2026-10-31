"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { TournamentDetail } from "@/lib/types";
import { Button, Card, Field, Input, Modal } from "@/components/ui";
import { TournamentForm, fromTournament } from "@/components/TournamentForm";
import { errorMessage, useToast } from "@/components/Toast";

type Tab = "overview" | "students" | "referees" | "draws" | "results" | "publish";

export function OverviewTab({ tournament, onChange, goTo }: { tournament: TournamentDetail; onChange: () => void; goTo: (tab: Tab) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const s = tournament.stats;

  const checklist: { done: boolean; label: string; tab: Tab }[] = [
    { done: s.registrations > 0, label: `Register students (${s.registrations})`, tab: "students" },
    { done: s.referees > 0, label: `Assign referees (${s.referees})`, tab: "referees" },
    { done: s.categories > 0 && s.draws >= s.categories, label: `Generate draws (${s.draws}/${s.categories} categories)`, tab: "draws" },
    { done: s.draws > 0 && s.concludedDraws >= s.draws, label: `Conclude categories (${s.concludedDraws}/${s.draws})`, tab: "results" },
    { done: tournament.status !== "DRAFT", label: "Publish the tournament page", tab: "publish" },
    { done: tournament.resultsPublished, label: "Publish results & certificates", tab: "publish" },
  ];

  async function remove() {
    setDeleting(true);
    try {
      await api(`/tournaments/${tournament.id}`, { method: "DELETE" });
      toast("Tournament deleted.");
      router.replace("/admin/tournaments");
    } catch (err) {
      toast(errorMessage(err), false);
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold text-slate-800">Tournament details</h2>
        <TournamentForm
          key={tournament.id + tournament.startDate}
          initial={fromTournament(tournament)}
          submitLabel="Save changes"
          onSubmit={async (data) => {
            await api(`/tournaments/${tournament.id}`, { method: "PUT", body: data });
            toast("Saved.");
            onChange();
          }}
        />
      </Card>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Students", value: s.registrations },
            { label: "Categories", value: s.categories },
            { label: "Paid entries", value: `${s.paid}/${s.registrations}` },
            { label: "Collected", value: rupees(s.collected) },
          ].map((x) => (
            <Card key={x.label} className="p-4">
              <p className="text-lg font-bold text-slate-900">{x.value}</p>
              <p className="text-xs text-slate-500">{x.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Progress</h2>
          <ul className="space-y-1">
            {checklist.map((c) => (
              <li key={c.label}>
                <button onClick={() => goTo(c.tab)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                  {c.done ? <CheckCircle2 size={18} className="shrink-0 text-emerald-500" /> : <Circle size={18} className="shrink-0 text-slate-300" />}
                  <span className={c.done ? "text-slate-500" : "text-slate-800"}>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-red-100 p-5">
          <h2 className="text-sm font-bold text-red-700">Delete tournament</h2>
          <p className="mb-3 mt-1 text-xs text-slate-500">Removes all entries, draws and results of this tournament. Students and referees stay in your master lists.</p>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>Delete…</Button>
        </Card>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete tournament"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={deleting} disabled={confirmText.trim() !== tournament.title.trim()} onClick={remove}>Delete for good</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">This cannot be undone. Type the tournament title to confirm:</p>
        <p className="mb-2 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{tournament.title}</p>
        <Field label="Title">
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
