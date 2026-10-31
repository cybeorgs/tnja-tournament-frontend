"use client";

import { ShieldCheck } from "lucide-react";
import type { Referee } from "@/lib/types";
import { PeopleList } from "@/components/PeopleList";
import { RefereeFields, emptyReferee, type RefereeInput } from "@/components/RefereeFields";

export default function RefereesPage() {
  return (
    <PeopleList<Referee, RefereeInput>
      title="Referees"
      subtitle="Referees and technical officials you can assign to any tournament."
      endpoint="/referees"
      noun="Referee"
      emptyHint="Add referees here, or straight from a tournament's Referees tab."
      icon={<ShieldCheck size={40} />}
      empty={emptyReferee}
      toForm={(r) => ({ fullName: r.fullName, grade: r.grade, district: r.district, phone: r.phone, email: r.email })}
      toBody={(f) => f}
      validate={(f) => (f.fullName.trim().length < 2 ? "Enter the referee's name." : null)}
      renderForm={(value, onChange) => <RefereeFields value={value} onChange={onChange} />}
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
