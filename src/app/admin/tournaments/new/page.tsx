"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { Tournament } from "@/lib/types";
import { Button, Card } from "@/components/ui";
import { TournamentForm, emptyTournament } from "@/components/TournamentForm";
import { useToast } from "@/components/Toast";

const FORM_ID = "new-tournament";

export default function NewTournamentPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  return (
    <div>
      {/* Full-width bar that stays at the top while the long form scrolls under it */}
      <div className="no-print -mx-4 -mt-6 mb-6 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/admin/tournaments"
            aria-label="Back to tournaments"
            title="Back to tournaments"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-brand/30 hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-900">New tournament</h1>
            <p className="truncate text-xs text-slate-500">It goes live on the public site as soon as you create it.</p>
          </div>
          <Button type="submit" form={FORM_ID} loading={saving} className="shrink-0">
            Create tournament
          </Button>
        </div>
      </div>

      <Card className="mx-auto max-w-3xl p-5 sm:p-8">
        <TournamentForm
          formId={FORM_ID}
          onSavingChange={setSaving}
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
