"use client";

import type { ReactNode } from "react";
import { useApi } from "@/lib/hooks";
import { GENDER_LABEL, formatDate, rupees, titleCase } from "@/lib/format";
import type { StudentDetail as Detail } from "@/lib/types";
import { Badge, EmptyState, Modal, Spinner } from "./ui";

/** Read-only view of everything a student registered with, plus their tournament history. */
export function StudentDetailModal({ studentId, onClose }: { studentId: string | null; onClose: () => void }) {
  return (
    <Modal open={!!studentId} onClose={onClose} title="Student details" wide>
      {studentId && <Body id={studentId} />}
    </Modal>
  );
}

function Body({ id }: { id: string }) {
  const { data: s, loading, error } = useApi<Detail>(`/students/${id}`);

  if (loading) return <Spinner />;
  if (error || !s) return <EmptyState title="Couldn't load this student">{error}</EmptyState>;

  const self = s.source === "SELF";
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-soft to-white p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-white shadow-sm shadow-orange-500/30">
          {s.fullName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-900">{s.fullName}</p>
          <p className="text-sm text-slate-500">{GENDER_LABEL[s.gender]} · {formatDate(s.dob)}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-brand ring-1 ring-orange-200">{s.studentNo}</span>
            <Badge color={self ? "blue" : "slate"}>{self ? "Self-registered" : "Added by admin"}</Badge>
          </div>
        </div>
      </div>

      <Group title="Family">
        <Item label="Father's name" value={s.fatherName} />
        <Item label="Mother's name" value={s.motherName} />
      </Group>

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
          <p className="text-sm text-slate-400">No tournaments yet.</p>
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
