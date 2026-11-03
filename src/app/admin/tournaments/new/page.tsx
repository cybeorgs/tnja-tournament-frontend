"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Tournament } from "@/lib/types";
import { BackLink, Card, PageHeader } from "@/components/ui";
import { TournamentForm, emptyTournament } from "@/components/TournamentForm";
import { useToast } from "@/components/Toast";

export default function NewTournamentPage() {
  const router = useRouter();
  const toast = useToast();

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/admin/tournaments">Tournaments</BackLink>
      <PageHeader title="New tournament" subtitle="It goes live on the public site as soon as you create it." />
      <Card className="p-5 sm:p-8">
        <TournamentForm
          initial={emptyTournament()}
          submitLabel="Create tournament"
          onSubmit={async (data) => {
            const created = await api<Tournament>("/tournaments", { body: data });
            toast("Tournament created.");
            router.push(`/admin/tournaments/${created.id}`);
          }}
        />
      </Card>
    </div>
  );
}
