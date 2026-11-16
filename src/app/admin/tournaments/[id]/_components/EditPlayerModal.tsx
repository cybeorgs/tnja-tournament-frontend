"use client";

import { useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { api, openPdf } from "@/lib/api";
import { categoryLabel } from "@/lib/format";
import type { Registration, Student } from "@/lib/types";
import { Button, Modal, Spinner } from "@/components/ui";
import { StudentFields, fromStudent, validateStudent, type StudentInput } from "@/components/StudentFields";
import { errorMessage, useToast } from "@/components/Toast";

/**
 * Edit a player's own details (name, gender, date of birth, club…) from a tournament entry. Changing the
 * gender moves their entries to the boys' / girls' weight class of the same age group. Afterwards the
 * Tournament Entry Pass (built fresh every time) can be downloaded with the new details.
 */
export function EditPlayerModal({ tournamentId, entry, onClose, onSaved }: {
  tournamentId: string;
  entry: Registration;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<StudentInput | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  /** After saving: the entry pass can be downloaded with the new details */
  const [saved, setSaved] = useState<{ moved: string[] } | null>(null);

  useEffect(() => {
    api<Student>(`/students/${entry.studentId}`)
      .then((s) => setForm(fromStudent(s)))
      .catch((err) => setLoadError(errorMessage(err)));
  }, [entry.studentId]);

  async function save() {
    if (!form) return;
    const problem = validateStudent(form);
    if (problem) return setError(problem);
    setError("");
    setSaving(true);
    try {
      const r = await api<{ movedEntries?: string[] }>(`/students/${entry.studentId}`, { method: "PUT", body: form });
      toast(r.movedEntries?.length ? `Saved. Entry moved to ${r.movedEntries.join("; ")}.` : "Player details saved.");
      setSaved({ moved: r.movedEntries ?? [] });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const canPass = entry.paymentStatus !== "PENDING";
  const downloadPass = () =>
    openPdf(`/tournaments/${tournamentId}/registrations/${entry.id}/entry-pass`, "download", `Entry_Pass_${form?.fullName || entry.student.fullName}_${entry.ageGroup}.pdf`)
      .catch((err) => toast(errorMessage(err), false));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={saved ? "Player details saved" : "Edit player details"}
      footer={
        saved ? (
          <>
            {canPass && <Button variant="secondary" icon={<Ticket size={16} />} onClick={downloadPass}>Download entry pass</Button>}
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={saving} disabled={!form} onClick={save}>Save details</Button>
          </>
        )
      }
    >
      {saved ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p><b>{form?.fullName}</b>&apos;s details are updated everywhere: every tournament entry, the entry pass and certificates.</p>
          {saved.moved.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <p className="font-semibold">Because the gender changed, the entry moved to:</p>
              <ul className="mt-1 list-disc pl-5">{saved.moved.map((m) => <li key={m}>{m}</li>)}</ul>
              <p className="mt-1">The weight class is worked out from the weight they entered. Use <b>Edit category</b> if it needs adjusting. Any weigh-in was reset.</p>
            </div>
          )}
          {canPass
            ? <p className="text-xs text-slate-500">The Tournament Entry Pass is created fresh each time, so the download has the new details.</p>
            : <p className="text-xs text-slate-500">The entry pass is available once this entry is paid.</p>}
        </div>
      ) : loadError ? (
        <p className="text-sm text-red-700">{loadError}</p>
      ) : !form ? (
        <Spinner />
      ) : (
        <>
          <p className="mb-4 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            Entered in <b>{categoryLabel(entry)}</b>. Changing the gender moves their entries in unfinished tournaments to the boys&apos; / girls&apos; weight class of the same age group.
          </p>
          <StudentFields value={form} onChange={(v) => { setForm(v); if (error) setError(""); }} lockType />
          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </>
      )}
    </Modal>
  );
}
