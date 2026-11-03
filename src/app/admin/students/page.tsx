"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { GENDER_LABEL, formatDate } from "@/lib/format";
import type { Paged, Student } from "@/lib/types";
import { Badge, cx } from "@/components/ui";
import { PeopleList } from "@/components/PeopleList";
import { StatusBadge, StudentDetailModal } from "@/components/StudentDetail";
import { useApi } from "@/lib/hooks";
import { StudentFields, emptyStudent, fromStudent, validateStudent, type StudentInput } from "@/components/StudentFields";
import { useEmailOtp } from "@/components/EmailOtpField";

/** The form plus the email on file when editing (keeping it needs no new code). */
type StudentForm = StudentInput & { savedEmail?: string };

const sameEmail = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function StudentsPage() {
  const [viewing, setViewing] = useState<string | null>(null);
  const [tab, setTab] = useState<"ALL" | "PENDING">("ALL");
  // Bumped after approving/rejecting so the list and the count reload.
  const [version, setVersion] = useState(0);
  const { data: pending } = useApi<Paged<Student>>(`/students?pageSize=1&status=PENDING&v=${version}`);
  const emailOtp = useEmailOtp();
  return (
    <>
      <PeopleList<Student, StudentForm>
        key={`${tab}-${version}`}
        query={tab === "PENDING" ? "&status=PENDING" : ""}
        toolbar={
          <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-1 text-sm">
            {([["ALL", "All students"], ["PENDING", "Waiting for approval"]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx("flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all", tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                {label}
                {id === "PENDING" && !!pending?.total && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pending.total}</span>}
              </button>
            ))}
          </div>
        }
        title="Students"
        subtitle={<>Students register themselves from <a href="/enter" target="_blank" className="font-semibold text-brand hover:underline">tournament registration</a>.</>}
        endpoint="/students"
        noun="Student"
        emptyHint="Add one here, or share the registration link."
        icon={<Users size={40} />}
        searchPlaceholder="Search name, ID, club or phone"
        empty={emptyStudent}
        toForm={(s) => ({ ...fromStudent(s), savedEmail: s.email })}
        toBody={(f) => ({ ...f, savedEmail: undefined, emailVerificationToken: emailOtp.tokenFor(f.email) ?? undefined })}
        validate={(f) =>
          validateStudent(f) ??
          (!sameEmail(f.savedEmail, f.email) && !emailOtp.tokenFor(f.email) ? "Please verify the email with the code we send." : null)
        }
        wideForm
        renderForm={(value, onChange) => (
          <StudentFields value={value} onChange={(v) => onChange({ ...v, savedEmail: value.savedEmail })} emailOtp={emailOtp} savedEmail={value.savedEmail} />
        )}
        onView={(s) => setViewing(s.id)}
        columns={[
          {
            header: "Student ID",
            cell: (s) => (s.studentNo ? <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-600">{s.studentNo}</span> : <StatusBadge status={s.status} />),
          },
          {
            header: "Name",
            cell: (s) => (
              <button onClick={() => setViewing(s.id)} className="flex items-center gap-2 text-left font-semibold text-slate-800 hover:text-brand">
                {s.fullName} {s.source === "SELF" && <Badge color="blue">Self</Badge>}
              </button>
            ),
          },
          { header: "Gender", cell: (s) => GENDER_LABEL[s.gender] },
          { header: "Born", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.dob)}</span> },
          { header: "Club / District", cell: (s) => <span className="text-slate-600">{[s.club, s.district].filter(Boolean).join(", ") || "—"}</span> },
          { header: "Tournaments", cell: (s) => s._count?.registrations ?? 0, className: "text-center" },
        ]}
      />
      <StudentDetailModal studentId={viewing} onClose={() => setViewing(null)} onChanged={() => setVersion((v) => v + 1)} />
    </>
  );
}
