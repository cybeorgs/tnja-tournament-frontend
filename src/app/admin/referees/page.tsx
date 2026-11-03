"use client";

import { ShieldCheck } from "lucide-react";
import type { Referee } from "@/lib/types";
import { PeopleList } from "@/components/PeopleList";
import { RefereeFields, emptyReferee, validateReferee, type RefereeInput } from "@/components/RefereeFields";

/** The form plus the email on file when editing (keeping it needs no new code). */
type RefereeForm = RefereeInput & { savedEmail?: string };


export default function RefereesPage() {
  return (
    <PeopleList<Referee, RefereeForm>
      title="Referees"
      subtitle="Officials you can assign to any tournament."
      endpoint="/referees"
      noun="Referee"
      emptyHint="Add your first referee to get started."
      icon={<ShieldCheck size={40} />}
      searchPlaceholder="Search name, district or phone"
      empty={emptyReferee}
      toForm={(r) => ({ fullName: r.fullName, grade: r.grade, district: r.district, phone: r.phone, email: r.email, savedEmail: r.email })}
      toBody={(f) => ({ ...f, savedEmail: undefined })}
      validate={(f) =>
        validateReferee(f)
      }
      renderForm={(value, onChange) => (
        <RefereeFields value={value} onChange={(v) => onChange({ ...v, savedEmail: value.savedEmail })} />
      )}
      columns={[
        { header: "Name", cell: (r) => <span className="font-semibold text-slate-800">{r.fullName}</span> },
        { header: "Grade", cell: (r) => r.grade || "—" },
        { header: "District", cell: (r) => r.district || "—" },
        { header: "Phone", cell: (r) => r.phone || "—" },
        { header: "Tournaments", cell: (r) => r._count?.assignments ?? 0, className: "text-center" },
      ]}
    />
  );
}
