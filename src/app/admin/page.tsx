"use client";

import Link from "next/link";
import { CheckCircle2, Plus, Trophy, Users } from "lucide-react";
import { useApi } from "@/lib/hooks";
import type { TournamentListItem } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { TournamentTable } from "@/components/TournamentTable";

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
        actions={<Link href="/admin/tournaments/new"><Button icon={<Plus size={16} />}>New tournament</Button></Link>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Tournaments", value: totals.tournaments, icon: Trophy, tone: "bg-brand-soft text-brand" },
          { label: "Entries", value: totals.students, icon: Users, tone: "bg-blue-50 text-blue-600" },
          { label: "Published", value: totals.published, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="flex items-center gap-4 p-5">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}><Icon size={22} /></span>
            <div>
              <p className="text-2xl font-bold leading-none text-slate-900">{loading ? "–" : value}</p>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Active tournaments</h2>
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
