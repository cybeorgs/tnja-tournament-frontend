"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText, UserRound } from "lucide-react";
import { fetchObjectUrl } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { formatDate, rupees, titleCase } from "@/lib/format";
import type { StudentDetail as Detail } from "@/lib/types";
import { Badge, EmptyState, Modal, Spinner } from "./ui";
import { errorMessage, useToast } from "./Toast";

/** Read-only view of everything a student registered with, plus their tournament history. */
export function StudentDetailModal({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  return (
    <Modal open={!!studentId} onClose={onClose} title="Student details" wide>
      {studentId && <Body id={studentId} />}
    </Modal>
  );
}

function Body({ id }: { id: string }) {
  const toast = useToast();
  const { data: s, loading, error } = useApi<Detail>(`/students/${id}`);
  const [photo, setPhoto] = useState<string | null>(null);
  const hasPhoto = !!s?.documents.some((d) => d.kind === "PHOTO");

  useEffect(() => {
    if (!hasPhoto) return;
    let url: string | null = null;
    fetchObjectUrl(`/students/${id}/documents/PHOTO`).then((u) => setPhoto((url = u))).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [id, hasPhoto]);

  async function openProof() {
    try {
      window.open(await fetchObjectUrl(`/students/${id}/documents/BPL_PROOF`), "_blank");
    } catch (err) {
      toast(errorMessage(err), false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !s) return <EmptyState title="Could not load this student">{error}</EmptyState>;

  const self = s.source === "SELF";
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob URL from the API */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <UserRound size={36} />}
        </div>
        <div className="min-w-0">
          <p className="font-mono text-sm font-bold text-brand">{s.studentNo}</p>
          <p className="text-lg font-bold text-slate-900">{s.fullName}</p>
          <p className="text-sm text-slate-500">{s.gender === "MALE" ? "Male" : "Female"} · Born {formatDate(s.dob)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge color={self ? "blue" : "slate"}>{self ? "Self-registered" : "Added by admin"}</Badge>
            {s.isBPL && <Badge color="yellow">BPL</Badge>}
          </div>
        </div>
      </div>

      <Group title="Contact">
        <Item label="Mobile" value={s.phone} />
        <Item label="Alternate mobile" value={s.alternatePhone} />
        <Item label="Email" value={s.email} />
        <Item label="Aadhaar" value={s.aadhaarNumber ? `XXXX XXXX ${s.aadhaarNumber.slice(-4)}` : ""} />
        <Item label="Blood group" value={s.bloodGroup} />
        <Item label="Nationality" value={s.nationality} />
      </Group>

      <Group title="Location">
        <Item label="District" value={s.district} />
        <Item label="Taluk" value={s.taluk} />
        <Item label="Residing pincode" value={s.residingPincode} />
        <Item label="Permanent address" value={[s.address, s.city, s.state, s.pincode].filter(Boolean).join(", ")} wide />
      </Group>

      <Group title="Education & academy">
        <Item label="Institution" value={[s.institutionName, s.institutionType && titleCase(s.institutionType)].filter(Boolean).join(" · ")} />
        <Item label="Standard / year" value={[s.grade, s.degreeDepartment].filter(Boolean).join(" · ")} />
        <Item label="Club" value={s.club} />
        <Item label="Coach" value={s.coachName} />
        <Item label="Belt" value={s.belt} />
      </Group>

      <Group title="Financial">
        <Item label="Family annual income" value={s.annualIncome !== null ? rupees(s.annualIncome) : ""} />
        <Item
          label="BPL beneficiary"
          value={s.isBPL ? (
            s.documents.some((d) => d.kind === "BPL_PROOF")
              ? <button onClick={openProof} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Yes · <FileText size={13} /> View proof</button>
              : "Yes"
          ) : "No"}
        />
      </Group>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tournaments</h3>
        {s.registrations.length ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
            {s.registrations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="font-medium text-slate-700">{r.tournament.title}</span>
                <span className="flex items-center gap-2 text-slate-500">
                  {r.ageGroup} {r.weightCategory}
                  <Badge color={r.paymentStatus === "PENDING" ? "yellow" : "green"}>{r.paymentStatus === "PENDING" ? "Fee pending" : r.paymentStatus === "PAID" ? "Paid" : "Waived"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">Not entered in any tournament yet.</p>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

function Item({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}
