"use client";

import { useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { Award, Globe, LayoutGrid, Mail, Scale, ShieldCheck, Swords, Users } from "lucide-react";
import { useApi } from "@/lib/hooks";
import { formatDateRange } from "@/lib/format";
import type { TournamentDetail } from "@/lib/types";
import { BackLink, EmptyState, Spinner, cx } from "@/components/ui";
import { TournamentStatusBadge } from "@/components/TournamentStatus";
import { OverviewTab } from "./_components/OverviewTab";
import { RegistrationsTab } from "./_components/RegistrationsTab";
import { OfficialsTab } from "./_components/OfficialsTab";
import { DrawsTab } from "./_components/DrawsTab";
import { ResultsTab } from "./_components/ResultsTab";
import { PublishTab } from "./_components/PublishTab";
import { EmailsTab } from "./_components/EmailsTab";
import { WeighInTab } from "./_components/WeighInTab";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "students", label: "Students", icon: Users },
  { id: "referees", label: "Referees", icon: ShieldCheck },
  { id: "weigh-in", label: "Weigh-In", icon: Scale },
  { id: "draws", label: "Draws & Matches", icon: Swords },
  { id: "results", label: "Results & Certificates", icon: Award },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "publish", label: "Public page", icon: Globe },
] as const;

type TabId = (typeof TABS)[number]["id"];

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, loading, error, reload } = useApi<TournamentDetail>(`/tournaments/${id}`);
  // The open tab lives in the URL hash so a refresh lands on the same tab.
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash.slice(1), () => "");
  const tab: TabId = TABS.find((t) => t.id === hash)?.id ?? "overview";
  const openTab = (next: TabId) => {
    history.replaceState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  if (loading && !tournament) return <Spinner />;
  if (error || !tournament) return <EmptyState title="Could not load this tournament">{error}</EmptyState>;

  return (
    <div className="mx-auto max-w-7xl">
      <BackLink href="/admin/tournaments">Tournaments</BackLink>
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{tournament.title}</h1>
            <TournamentStatusBadge tournament={tournament} />
          </div>
          <p className="text-sm text-slate-500">
            {formatDateRange(tournament.startDate, tournament.endDate)} · {[tournament.venue, tournament.city].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="no-print -mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1" role="tablist">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              role="tab"
              aria-selected={tab === tabId}
              onClick={() => openTab(tabId)}
              className={cx(
                "-mb-px flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition-colors",
                tab === tabId ? "border-brand text-brand" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
              )}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <OverviewTab tournament={tournament} onChange={reload} goTo={openTab} />}
      {tab === "students" && <RegistrationsTab tournament={tournament} onChange={reload} />}
      {tab === "referees" && <OfficialsTab tournament={tournament} onChange={reload} />}
      {tab === "weigh-in" && <WeighInTab tournament={tournament} onChange={reload} />}
      {tab === "draws" && <DrawsTab tournament={tournament} onChange={reload} />}
      {tab === "results" && <ResultsTab tournament={tournament} onChange={reload} />}
      {tab === "publish" && <PublishTab tournament={tournament} onChange={reload} />}
      {tab === "emails" && <EmailsTab tournament={tournament} />}
    </div>
  );
}
