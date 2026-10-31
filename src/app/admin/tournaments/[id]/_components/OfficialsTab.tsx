"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileStack, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { api, openPdf } from "@/lib/api";
import { useApi, useMeta } from "@/lib/hooks";
import { titleCase } from "@/lib/format";
import type { Official, Paged, Referee, TournamentDetail } from "@/lib/types";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, cx } from "@/components/ui";
import { RefereeFields, emptyReferee, validateReferee, type RefereeInput } from "@/components/RefereeFields";
import { useEmailOtp } from "@/components/EmailOtpField";
import { errorMessage, useToast } from "@/components/Toast";
import { IconButton } from "./RegistrationsTab";

export function OfficialsTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const meta = useMeta();
  const { data: officials, loading, error, reload } = useApi<Official[]>(`/tournaments/${tournament.id}/officials`);
  const [adding, setAdding] = useState(false);

  const refresh = () => {
    reload();
    onChange();
  };

  async function update(o: Official, patch: { role?: string; matNumber?: number | null }) {
    try {
      await api(`/tournaments/${tournament.id}/officials/${o.id}`, { method: "PUT", body: { role: patch.role ?? o.role, matNumber: patch.matNumber !== undefined ? patch.matNumber : o.matNumber } });
      reload();
    } catch (err) {
      toast(errorMessage(err), false);
    }
  }

  async function remove(o: Official) {
    if (!confirm(`Remove ${o.referee.fullName} from this tournament?`)) return;
    try {
      await api(`/tournaments/${tournament.id}/officials/${o.id}`, { method: "DELETE" });
      toast("Official removed.");
      refresh();
    } catch (err) {
      toast(errorMessage(err), false);
    }
  }

  const certificate = (o: Official, mode: "view" | "download") =>
    openPdf(`/tournaments/${tournament.id}/officials/${o.id}/certificate`, mode, `${o.referee.fullName}_certificate.pdf`).catch((err) => toast(errorMessage(err), false));

  return (
    <Card>
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Referees, judges and table officials working at this tournament.</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<FileStack size={16} />}
            disabled={!officials?.length}
            onClick={() => openPdf(`/tournaments/${tournament.id}/certificates?kind=officials`, "download", `${tournament.title}_official_certificates.pdf`).catch((err) => toast(errorMessage(err), false))}
          >
            All certificates
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>Assign referee</Button>
        </div>
      </div>

      {loading && !officials ? (
        <Spinner />
      ) : error ? (
        <EmptyState title="Could not load officials">{error}</EmptyState>
      ) : !officials?.length ? (
        <EmptyState icon={<ShieldCheck size={40} />} title="No referees assigned yet">
          Assign referees from your master list, or add a new one on the spot.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Mat</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {officials.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{o.referee.fullName}</p>
                    <p className="text-xs text-slate-500">{[o.referee.grade, o.referee.district].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={o.role} onChange={(e) => update(o, { role: e.target.value })} className="min-w-40 py-1.5">
                      {(meta?.refereeRoles ?? [o.role]).map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={o.matNumber ?? ""} onChange={(e) => update(o, { matNumber: e.target.value ? Number(e.target.value) : null })} className="w-28 py-1.5">
                      <option value="">Any</option>
                      {Array.from({ length: tournament.numberOfMats }, (_, i) => <option key={i} value={i + 1}>Mat {i + 1}</option>)}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <IconButton label="View certificate" onClick={() => certificate(o, "view")}><Eye size={15} /></IconButton>
                      <IconButton label="Download certificate" onClick={() => certificate(o, "download")}><Download size={15} /></IconButton>
                      <IconButton label="Remove" danger onClick={() => remove(o)}><Trash2 size={15} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <AssignModal
          tournament={tournament}
          assignedIds={new Set(officials?.map((o) => o.referee.id))}
          roles={meta?.refereeRoles ?? ["REFEREE"]}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); refresh(); }}
        />
      )}
    </Card>
  );
}

function AssignModal({ tournament, assignedIds, roles, onClose, onSaved }: { tournament: TournamentDetail; assignedIds: Set<string>; roles: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Referee[]>([]);
  const [picked, setPicked] = useState<Referee | null>(null);
  const [newReferee, setNewReferee] = useState<RefereeInput>(emptyReferee);
  const [role, setRole] = useState(roles[0] ?? "REFEREE");
  const [mat, setMat] = useState("");
  const [saving, setSaving] = useState(false);
  const emailOtp = useEmailOtp();

  useEffect(() => {
    if (mode !== "existing") return;
    const handle = setTimeout(() => {
      api<Paged<Referee>>(`/referees?pageSize=20&q=${encodeURIComponent(query)}`).then((r) => setResults(r.items)).catch(() => {});
    }, 250);
    return () => clearTimeout(handle);
  }, [query, mode]);

  async function save() {
    setSaving(true);
    try {
      let refereeId = picked?.id;
      if (mode === "new") {
        const problem = validateReferee(newReferee) ?? (!emailOtp.tokenFor(newReferee.email) ? "Please verify the email with the code we send." : null);
        if (problem) throw new Error(problem);
        refereeId = (await api<Referee>("/referees", { body: { ...newReferee, emailVerificationToken: emailOtp.tokenFor(newReferee.email) } })).id;
      }
      if (!refereeId) throw new Error("Pick a referee.");
      await api(`/tournaments/${tournament.id}/officials`, { body: { refereeId, role, matNumber: mat ? Number(mat) : null } });
      toast("Referee assigned.");
      onSaved();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Assign a referee"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Assign</Button>
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {(["existing", "new"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cx("rounded-md px-3 py-1.5 font-semibold", mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
            {m === "existing" ? "From master list" : "New referee"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <div className="mb-5">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input autoFocus placeholder="Search name, district or phone" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
          </div>
          <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {results.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-slate-400">
                No referees found. <button className="font-semibold text-brand" onClick={() => setMode("new")}>Add a new referee</button>
              </li>
            )}
            {results.map((r) => {
              const already = assignedIds.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    disabled={already}
                    onClick={() => setPicked(r)}
                    className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm", picked?.id === r.id ? "bg-brand-soft" : "hover:bg-slate-50", already && "opacity-50")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-800">{r.fullName}</span>
                      <span className="block truncate text-xs text-slate-500">{[r.grade, r.district].filter(Boolean).join(" · ") || "—"}</span>
                    </span>
                    {already && <Badge>Assigned</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mb-5">
          <RefereeFields value={newReferee} onChange={setNewReferee} emailOtp={emailOtp} />
        </div>
      )}

      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <Field label="Role">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
          </Select>
        </Field>
        <Field label="Mat">
          <Select value={mat} onChange={(e) => setMat(e.target.value)}>
            <option value="">Any mat</option>
            {Array.from({ length: tournament.numberOfMats }, (_, i) => <option key={i} value={i + 1}>Mat {i + 1}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
