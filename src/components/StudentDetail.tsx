"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import { api, fetchObjectUrl } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { GENDER_LABEL, formatDate, rupees, titleCase } from "@/lib/format";
import type { StudentDetail as Detail } from "@/lib/types";
import { Badge, Button, EmptyState, Modal, Spinner, Textarea } from "./ui";
import { errorMessage, useToast } from "./Toast";

/** Read-only view of everything a student registered with, plus their tournament history. */
export function StudentDetailModal({ studentId, onClose, onChanged }: { studentId: string | null; onClose: () => void; onChanged?: () => void }) {
  return (
    <Modal open={!!studentId} onClose={onClose} title="Student details" wide>
      {studentId && <Body id={studentId} onChanged={onChanged} />}
    </Modal>
  );
}

function Body({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const { data: s, loading, error, reload } = useApi<Detail>(`/students/${id}`);

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
            {s.studentNo && <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-brand ring-1 ring-orange-200">{s.studentNo}</span>}
            <StatusBadge status={s.status} />
            <Badge color={self ? "blue" : "slate"}>{self ? "Self-registered" : "Added by admin"}</Badge>
            {s.outsideTamilNadu && <Badge color="orange">Outside Tamil Nadu</Badge>}
            {s.isBPL && <Badge color="yellow">BPL</Badge>}
          </div>
        </div>
      </div>

      {s.status !== "APPROVED" && <Review student={s} onDone={() => { reload(); onChanged?.(); }} />}

      {s.documents.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Documents</h3>
          <div className="flex flex-wrap gap-2">{s.documents.map((d) => <DocumentLink key={d.kind} studentId={s.id} kind={d.kind} label={d.label} />)}</div>
        </div>
      )}

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
        <Item label="BPL family" value={s.outsideTamilNadu ? "—" : s.isBPL ? "Yes" : "No"} />
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

export function StatusBadge({ status }: { status: Detail["status"] }) {
  if (status === "PENDING") return <Badge color="yellow"><Clock size={11} /> Waiting for approval</Badge>;
  if (status === "REJECTED") return <Badge color="red"><XCircle size={11} /> Rejected</Badge>;
  return <Badge color="green"><CheckCircle2 size={11} /> Approved</Badge>;
}

function DocumentLink({ studentId, kind, label }: { studentId: string; kind: string; label: string }) {
  const toast = useToast();
  return (
    <button
      onClick={() => fetchObjectUrl(`/students/${studentId}/documents/${kind}`).then((url) => window.open(url, "_blank"), (err) => toast(errorMessage(err), false))}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand/40 hover:text-brand"
    >
      <FileText size={15} /> {label || kind}
    </button>
  );
}

/** Approve (issues the student ID and emails it) or reject (with a reason the applicant is emailed). */
function Review({ student, onDone }: { student: Detail; onDone: () => void }) {
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  async function act(kind: "approve" | "reject") {
    if (kind === "reject" && reason.trim().length < 3) return toast("Tell the applicant why it was rejected.", false);
    setBusy(kind);
    try {
      await api(`/students/${student.id}/${kind}`, { body: kind === "reject" ? { reason } : {} });
      toast(kind === "approve" ? "Approved — the student ID has been emailed." : "Rejected — the applicant has been emailed.");
      onDone();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <p className="text-sm text-amber-900">
        {student.status === "PENDING"
          ? "This student lives outside Tamil Nadu. Check the uploaded document, then approve to issue their student ID."
          : `Rejected${student.reviewNote ? `: ${student.reviewNote}` : "."} You can still approve it.`}
      </p>
      {rejecting && (
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (emailed to the applicant)" className="mt-3 min-h-20 bg-white" autoFocus />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="success" icon={<CheckCircle2 size={16} />} loading={busy === "approve"} onClick={() => act("approve")}>Approve</Button>
        {student.status === "PENDING" &&
          (rejecting ? (
            <Button variant="danger" loading={busy === "reject"} onClick={() => act("reject")}>Send rejection</Button>
          ) : (
            <Button variant="secondary" icon={<XCircle size={16} />} onClick={() => setRejecting(true)}>Reject</Button>
          ))}
      </div>
    </div>
  );
}
