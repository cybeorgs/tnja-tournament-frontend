"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, EyeOff, Flag, Globe, Medal, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import type { TournamentDetail } from "@/lib/types";
import { Button, Card, cx } from "@/components/ui";
import { errorMessage, useToast } from "@/components/Toast";

type Action = "publish" | "unpublish" | "complete" | "reopen" | "publishResults" | "hideResults";

export function PublishTab({ tournament, onChange }: { tournament: TournamentDetail; onChange: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [copied, setCopied] = useState(false);
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/t/${tournament.slug}` : `/t/${tournament.slug}`;
  const s = tournament.stats;

  async function run(action: Action, message: string) {
    setBusy(action);
    try {
      await api(`/tournaments/${tournament.id}/status`, { body: { action } });
      toast(message);
      onChange();
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy(null);
    }
  }

  const steps = [
    {
      icon: Globe,
      title: "Tournament page",
      done: tournament.status !== "DRAFT",
      text: tournament.status === "DRAFT"
        ? "Only you can see this tournament. Publish it to show the details, categories, officials and live brackets on the public site."
        : "The public page is live with details, categories, officials and brackets.",
      action: tournament.status === "DRAFT"
        ? <Button icon={<Globe size={16} />} loading={busy === "publish"} onClick={() => run("publish", "Tournament published.")}>Publish tournament</Button>
        : <Button variant="secondary" icon={<EyeOff size={16} />} loading={busy === "unpublish"} onClick={() => run("unpublish", "Tournament is a draft again.")}>Unpublish</Button>,
    },
    {
      icon: Medal,
      title: "Results & certificates",
      done: tournament.resultsPublished,
      text: tournament.resultsPublished
        ? "Medal tables are public, and students and referees can download their certificates and verify them by number."
        : `Shows medal winners of concluded categories (${s.concludedDraws}/${s.draws}) and lets students download certificates using their name and date of birth.`,
      action: tournament.resultsPublished
        ? <Button variant="secondary" icon={<EyeOff size={16} />} loading={busy === "hideResults"} onClick={() => run("hideResults", "Results hidden.")}>Hide results</Button>
        : <Button icon={<Medal size={16} />} disabled={s.concludedDraws === 0} loading={busy === "publishResults"} onClick={() => run("publishResults", "Results published.")}>Publish results</Button>,
    },
    {
      icon: Flag,
      title: "Mark as completed",
      done: tournament.status === "COMPLETED",
      text: tournament.status === "COMPLETED"
        ? "The tournament is closed and the entry list is locked."
        : "When everything is over, mark the tournament completed. This also closes registration.",
      action: tournament.status === "COMPLETED"
        ? <Button variant="secondary" icon={<Undo2 size={16} />} loading={busy === "reopen"} onClick={() => run("reopen", "Tournament reopened.")}>Reopen</Button>
        : <Button variant="secondary" icon={<Flag size={16} />} loading={busy === "complete"} onClick={() => run("complete", "Tournament marked completed.")}>Mark completed</Button>,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {tournament.status !== "DRAFT" && (
        <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500">Public link</p>
            <p className="truncate font-mono text-sm text-slate-800">{publicUrl}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={() => navigator.clipboard.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
            <a href={`/t/${tournament.slug}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" icon={<ExternalLink size={16} />}>Open</Button>
            </a>
          </div>
        </Card>
      )}

      {steps.map(({ icon: Icon, title, done, text, action }) => (
        <Card key={title} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500")}>
            {done ? <Check size={20} /> : <Icon size={20} />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800">{title}</p>
            <p className="mt-0.5 text-sm text-slate-500">{text}</p>
          </div>
          <div className="shrink-0">{action}</div>
        </Card>
      ))}
    </div>
  );
}
