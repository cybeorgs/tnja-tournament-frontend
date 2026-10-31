"use client";

import { Users } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Student } from "@/lib/types";
import { PeopleList } from "@/components/PeopleList";
import { StudentFields, emptyStudent, fromStudent, type StudentInput } from "@/components/StudentFields";

export default function StudentsPage() {
  return (
    <PeopleList<Student, StudentInput>
      title="Students"
      subtitle="Your athlete list. Students added while registering for a tournament appear here too."
      endpoint="/students"
      noun="Student"
      emptyHint="Add students here, or straight from a tournament's Students tab."
      icon={<Users size={40} />}
      empty={emptyStudent}
      toForm={fromStudent}
      toBody={(f) => f}
      validate={(f) => (!f.fullName.trim() ? "Enter the student's name." : !f.dob ? "Enter the date of birth." : !f.gender ? "Choose the gender." : null)}
      renderForm={(value, onChange) => <StudentFields value={value} onChange={onChange} />}
      columns={[
        { header: "Name", cell: (s) => <span className="font-semibold text-slate-800">{s.fullName}</span> },
        { header: "Gender", cell: (s) => (s.gender === "MALE" ? "Male" : "Female") },
        { header: "Born", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.dob)}</span> },
        { header: "Club / District", cell: (s) => <span className="text-slate-600">{[s.club, s.district].filter(Boolean).join(", ") || "—"}</span> },
        { header: "Tournaments", cell: (s) => s._count?.registrations ?? 0, className: "text-center" },
      ]}
    />
  );
}
