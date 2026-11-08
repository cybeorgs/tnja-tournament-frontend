"use client";

import { useState } from "react";
import { Briefcase, Clock, FileSpreadsheet, GraduationCap, Upload, Users } from "lucide-react";
import { ImportStudentsModal } from "@/components/ImportStudentsModal";
import { downloadFile } from "@/lib/api";
import { errorMessage, useToast } from "@/components/Toast";
import { GENDER_LABEL, formatDate } from "@/lib/format";
import type { ParticipantType, Student } from "@/lib/types";
import { Badge, Button, Select, cx } from "@/components/ui";
import { PeopleList } from "@/components/PeopleList";
import { StatusBadge, StudentDetailModal } from "@/components/StudentDetail";
import { useApi } from "@/lib/hooks";
import { StudentFields, emptyStudent, fromStudent, validateStudent, type StudentInput } from "@/components/StudentFields";

/** The form plus the email on file when editing (keeping it needs no new code). */
type StudentForm = StudentInput & { savedEmail?: string };
/** GET /students/stats (rejected applications aren't counted) */
type StudentStats = { total: number; students: number; professionals: number; pending: number };


export default function StudentsPage() {
  const [viewing, setViewing] = useState<string | null>(null);
  const [tab, setTab] = useState<"ALL" | "PENDING">("ALL");
  const [type, setType] = useState<"" | ParticipantType>("");
  const filter = [tab === "PENDING" ? "status=PENDING" : "", type ? `type=${type}` : ""].filter(Boolean).join("&");
  // Bumped after approving/rejecting so the list and the counts reload.
  const [version, setVersion] = useState(0);
  // Bumped after adding / editing / deleting from the list: only the counts reload.
  const [statsVersion, setStatsVersion] = useState(0);
  const { data: stats, loading: statsLoading } = useApi<StudentStats>(`/students/stats?v=${version}-${statsVersion}`);
  const pending = stats ? { total: stats.pending } : null;
  const showOnly = (nextTab: "ALL" | "PENDING", nextType: "" | ParticipantType) => { setTab(nextTab); setType(nextType); };
  const tiles = [
    { label: "Total registered", value: stats?.total, icon: Users, tone: "bg-brand-soft text-brand", active: tab === "ALL" && !type, onClick: () => showOnly("ALL", "") },
    { label: "Students", value: stats?.students, icon: GraduationCap, tone: "bg-blue-50 text-blue-600", active: tab === "ALL" && type === "STUDENT", onClick: () => showOnly("ALL", "STUDENT") },
    { label: "Working professionals", value: stats?.professionals, icon: Briefcase, tone: "bg-emerald-50 text-emerald-600", active: tab === "ALL" && type === "PROFESSIONAL", onClick: () => showOnly("ALL", "PROFESSIONAL") },
    { label: "Waiting for approval", value: stats?.pending, icon: Clock, tone: "bg-amber-50 text-amber-600", active: tab === "PENDING" && !type, onClick: () => showOnly("PENDING", "") },
  ];
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile(`/students/export${filter ? `?${filter}` : ""}`, "students.xlsx");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <PeopleList<Student, StudentForm>
        key={`${tab}-${type}-${version}`}
        query={filter ? `&${filter}` : ""}
        onChanged={() => setStatsVersion((v) => v + 1)}
        toolbar={
          <>
          {/* Counts; clicking one shows just those people in the list below. */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map(({ label, value, icon: Icon, tone, active, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                aria-pressed={active}
                className={cx(
                  "flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:gap-4 sm:p-5",
                  active ? "border-brand ring-2 ring-brand/15" : "border-slate-200",
                )}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${tone}`}><Icon size={22} /></span>
                <span className="min-w-0">
                  <span className="block text-2xl font-bold leading-none text-slate-900">{statsLoading && value === undefined ? "–" : (value ?? 0).toLocaleString("en-IN")}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500 sm:text-sm">{label}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex w-full rounded-2xl bg-slate-100 p-1 text-sm sm:inline-flex sm:w-auto">
            {([["ALL", "All students", "All"], ["PENDING", "Waiting for approval", "Waiting"]] as const).map(([id, label, short]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cx("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 font-semibold transition-all sm:flex-none sm:px-4", tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}
              >
                <span className="sm:hidden">{short}</span><span className="hidden sm:inline">{label}</span>
                {id === "PENDING" && !!pending?.total && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pending.total}</span>}
              </button>
            ))}
          </div>
          <Select aria-label="Player type" value={type} onChange={(e) => setType(e.target.value as "" | ParticipantType)} className="sm:w-56">
            <option value="">Students &amp; professionals</option>
            <option value="STUDENT">Students only</option>
            <option value="PROFESSIONAL">Working professionals only</option>
          </Select>
          </div>
          </>
        }
        headerActions={
          <>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={() => setImporting(true)}>Import</Button>
            <Button variant="secondary" icon={<FileSpreadsheet size={16} />} loading={exporting} onClick={exportExcel}>
              {tab === "PENDING" ? "Download waiting list" : "Download Excel"}
            </Button>
          </>
        }
        title="Students"
        subtitle={<>Students and working professionals register themselves from <a href="/enter" target="_blank" className="font-semibold text-brand hover:underline">tournament registration</a>.</>}
        endpoint="/students"
        noun="Student"
        emptyHint="Add one here, or share the registration link."
        icon={<Users size={40} />}
        searchPlaceholder="Search name, ID, club or phone"
        empty={emptyStudent}
        toForm={(s) => ({ ...fromStudent(s), savedEmail: s.email })}
        toBody={(f) => ({ ...f, savedEmail: undefined })}
        validate={(f) =>
          validateStudent(f)
        }
        wideForm
        renderForm={(value, onChange) => (
          <StudentFields value={value} onChange={(v) => onChange({ ...v, savedEmail: value.savedEmail })} lockType={value.savedEmail !== undefined} />
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
                {s.fullName} {s.participantType === "PROFESSIONAL" && <Badge color="orange">Professional</Badge>} {s.source === "SELF" && <Badge color="blue">Self</Badge>}
              </button>
            ),
          },
          { header: "Gender", cell: (s) => GENDER_LABEL[s.gender] },
          { header: "Born", cell: (s) => <span className="whitespace-nowrap">{formatDate(s.dob)}</span> },
          { header: "Club / District", cell: (s) => <span className="text-slate-600">{[s.club, s.district].filter(Boolean).join(", ") || "—"}</span> },
          { header: "Tournaments", cell: (s) => s._count?.registrations ?? 0, className: "text-center" },
        ]}
      />
      <ImportStudentsModal open={importing} onClose={() => setImporting(false)} onImported={() => setVersion((v) => v + 1)} />
      <StudentDetailModal studentId={viewing} onClose={() => setViewing(null)} onChanged={() => setVersion((v) => v + 1)} />
    </>
  );
}
