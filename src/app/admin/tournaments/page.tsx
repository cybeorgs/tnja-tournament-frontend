"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Trophy } from "lucide-react";
import { useApi } from "@/lib/hooks";
import type { TournamentListItem } from "@/lib/types";
import { Button, Card, EmptyState, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { TournamentTable } from "@/components/TournamentTable";

export default function TournamentsPage() {
  const { data, loading, error } = useApi<TournamentListItem[]>("/tournaments");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = (data ?? []).filter(
    (t) => (status === "ALL" || t.status === status) && `${t.title} ${t.venue} ${t.city}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Tournaments"
        actions={<Link href="/admin/tournaments/new"><Button icon={<Plus size={16} />}>New tournament</Button></Link>}
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search by title, venue or city" value={q} onChange={(e) => setQ(e.target.value)} className="bg-slate-50/60 pl-10 focus:bg-white" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
            <option value="ALL">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        </div>
        {loading ? (
          <Spinner />
        ) : error ? (
          <EmptyState title="Could not load tournaments">{error}</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Trophy size={40} />} title={data?.length ? "No tournaments match" : "No tournaments yet"}>
            {data?.length ? "Try a different search or status." : "Create your first tournament to get started."}
          </EmptyState>
        ) : (
          <TournamentTable tournaments={filtered} />
        )}
      </Card>
    </div>
  );
}
