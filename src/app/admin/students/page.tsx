"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Student } from "@/lib/types";
import { Badge } from "@/components/ui";
import { PeopleList } from "@/components/PeopleList";
import { StudentDetailModal } from "@/components/StudentDetail";
import { StudentFields, emptyStudent, fromStudent, validateStudent, type StudentInput } from "@/components/StudentFields";
import { useEmailOtp } from "@/components/EmailOtpField";

/** The form plus the email on file when editing (keeping it needs no new code). */
type StudentForm = StudentInput & { savedEmail?: string };

const sameEmail = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function StudentsPage() {
  const [viewing, setViewing] = useState<string | null>(null);
  const emailOtp = useEmailOtp();
  return (
    <>
      <PeopleList<Student, StudentForm>
        title="Students"
        subtitle={<>Share <a href="/register" target="_blank" className="font-semibold text-brand hover:underline">/register</a> so students can sign up themselves.</>}
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
          { header: "Student ID", cell: (s) => <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-600">{s.studentNo}</span> },
          {
            header: "Name",
            cell: (s) => (
              <button onClick={() => setViewing(s.id)} className="flex items-center gap-2 text-left font-semibold text-slate-800 hover:text-brand">
                {s.fullName} {s.source === "SELF" && <Badge color="blue">Self</Badge>}
              </button>
            ),
          },
          { header: "Gender", cell: (s) => (s.gender === "MALE" ? "Male" : "Female") },
          { header: "Born", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.dob)}</span> },
          { header: "Club / District", cell: (s) => <span className="text-slate-600">{[s.club, s.district].filter(Boolean).join(", ") || "—"}</span> },
          { header: "Tournaments", cell: (s) => s._count?.registrations ?? 0, className: "text-center" },
        ]}
      />
      <StudentDetailModal studentId={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
