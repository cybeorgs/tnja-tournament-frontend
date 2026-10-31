"use client";

import Link from "next/link";
import { Award, Globe, ListChecks, Plus, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { useApi } from "@/lib/hooks";
import type { TournamentListItem } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { TournamentTable } from "@/components/TournamentTable";

const STEPS = [
  { icon: Trophy, title: "Create", text: "Set dates, venue, age groups and entry fee." },
  { icon: Users, title: "Register students", text: "Add entries; the weight class is worked out for you." },
  { icon: ShieldCheck, title: "Assign referees", text: "Add officials and their mats." },
  { icon: Swords, title: "Draw & score", text: "Generate brackets and record each match." },
  { icon: ListChecks, title: "Conclude", text: "Confirm medals for each category." },
  { icon: Award, title: "Certificates", text: "Print or download, one by one or all at once." },
  { icon: Globe, title: "Publish", text: "Put the tournament and results on the public site." },
];

export default function DashboardPage() {
  const { data: tournaments, loading, error } = useApi<TournamentListItem[]>("/tournaments");

  const active = tournaments?.filter((t) => t.status !== "COMPLETED") ?? [];
  const totals = {
    tournaments: tournaments?.length ?? 0,
    students: tournaments?.reduce((s, t) => s + t._count.registrations, 0) ?? 0,
    published: tournaments?.filter((t) => t.status !== "DRAFT").length ?? 0,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle="Everything from creation to certificates is in your hands — no approvals needed."
        actions={<Link href="/admin/tournaments/new"><Button icon={<Plus size={16} />}>New tournament</Button></Link>}
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Tournaments", value: totals.tournaments },
          { label: "Entries", value: totals.students },
          { label: "Published", value: totals.published },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-2xl font-bold text-slate-900">{loading ? "–" : s.value}</p>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-bold text-slate-800">How a tournament runs</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
                <Icon size={16} className="text-brand" />
              </div>
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-800">Active tournaments</h2>
          <Link href="/admin/tournaments" className="text-sm font-semibold text-brand hover:underline">View all</Link>
        </div>
        {loading ? (
          <Spinner />
        ) : error ? (
          <EmptyState title="Could not load tournaments">{error}</EmptyState>
        ) : active.length === 0 ? (
          <EmptyState icon={<Trophy size={40} />} title="No active tournaments">
            Create your first tournament to get started.
          </EmptyState>
        ) : (
          <TournamentTable tournaments={active} />
        )}
      </Card>
    </div>
  );
}
