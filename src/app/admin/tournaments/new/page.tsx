"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Tournament } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { TournamentForm, emptyTournament } from "@/components/TournamentForm";
import { useToast } from "@/components/Toast";

export default function NewTournamentPage() {
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/tournaments" className="text-sm text-slate-500 hover:text-brand">← Tournaments</Link>
      <PageHeader title="New tournament" subtitle="It stays a private draft until you publish it." />
      <Card className="p-5 sm:p-6">
        <TournamentForm
          initial={emptyTournament}
          submitLabel="Create tournament"
          onSubmit={async (data) => {
            const created = await api<Tournament>("/tournaments", { body: data });
            toast("Tournament created. Now add students and referees.");
            router.push(`/admin/tournaments/${created.id}`);
          }}
        />
      </Card>
    </div>
  );
}
