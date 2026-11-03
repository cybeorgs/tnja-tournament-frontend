"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useMeta } from "@/lib/hooks";
import { titleCase } from "@/lib/format";
import type { Tournament } from "@/lib/types";
import { BackLink, Button, Card, Field, Select } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { TournamentPicker, TournamentSummary, useOpenTournaments } from "@/components/OpenTournaments";
import { RefereeFields, emptyReferee, validateReferee, type RefereeInput } from "@/components/RefereeFields";
import { useEmailOtp } from "@/components/EmailOtpField";
import { errorMessage } from "@/components/Toast";

export default function RefereeRegistrationPage() {
  const { tournaments, loading, error } = useOpenTournaments(true);
  const [chosen, setChosen] = useState<Tournament | null>(null);

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl">
        {chosen ? (
          <OfficialForm key={chosen.id} tournament={chosen} onBack={() => setChosen(null)} />
        ) : (
          <TournamentPicker
            title="Referee registration"
            subtitle="Choose the tournament you'll officiate at."
            tournaments={tournaments}
            loading={loading}
            error={error}
            onPick={setChosen}
            showFee={false}
          />
        )}
      </div>
    </PublicShell>
  );
}

function OfficialForm({ tournament, onBack }: { tournament: Tournament; onBack: () => void }) {
  const meta = useMeta();
  const emailOtp = useEmailOtp();
  const [form, setForm] = useState<RefereeInput>(emptyReferee);
  const [role, setRole] = useState("REFEREE");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ fullName: string; role: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem =
      validateReferee(form) ??
      (!emailOtp.tokenFor(form.email) ? "Please verify your email with the code we send." : null) ??
      (!agreed ? "Please confirm the details are correct." : null);
    setError(problem ?? "");
    if (problem) return;

    setBusy(true);
    try {
      setDone(await api(`/public/tournaments/${tournament.slug}/officials`, { body: { ...form, role, emailVerificationToken: emailOtp.tokenFor(form.email) } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink onClick={onBack}>All tournaments</BackLink>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-soft/80 to-white p-5 sm:p-6">
          <TournamentSummary tournament={tournament} showFee={false} />
        </div>

        <div className="p-5 sm:p-8">
          {done ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 size={36} className="text-emerald-500" />
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">You&apos;re registered, {done.fullName}!</p>
              <p className="mt-1 text-sm text-slate-500">{titleCase(done.role)} · The organiser will assign your mat.</p>
              <Link href={`/t/${tournament.slug}`} className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">View tournament</Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-6">
              <Field label="Register as" required>
                <Select value={role} onChange={(e) => setRole(e.target.value)}>
                  {(meta?.refereeRoles ?? ["REFEREE"]).map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                </Select>
              </Field>

              <RefereeFields value={form} onChange={setForm} emailOtp={emailOtp} />

              {error && <p role="alert" className="animate-pop-in rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

              <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 cursor-pointer" />
                  The details above are correct
                </label>
                <Button type="submit" loading={busy} icon={<ShieldCheck size={17} />} className="h-12 px-10 text-base">Register</Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </>
  );
}
