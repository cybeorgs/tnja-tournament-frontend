"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BadgeCheck, Download, ShieldX } from "lucide-react";
import { openPdf } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { PLACEMENT_LABEL, formatDate, titleCase } from "@/lib/format";
import type { Placement } from "@/lib/types";
import { Button, Card, Spinner } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";
import { errorMessage, useToast } from "@/components/Toast";

type Verification =
  | { valid: false }
  | {
      valid: true;
      kind: "STUDENT" | "OFFICIAL";
      certificateNo: string;
      name: string;
      club?: string;
      placement?: Placement;
      category?: string;
      role?: string;
      tournament: { title: string; slug: string; startDate: string; venue: string };
    };

export default function VerifyResultPage() {
  const toast = useToast();
  const { certNo } = useParams<{ certNo: string }>();
  const number = decodeURIComponent(certNo).toUpperCase();
  const { data, loading, error } = useApi<Verification>(`/public/verify/${encodeURIComponent(number)}`);

  return (
    <PublicShell>
      <div className="mx-auto max-w-md">
        {loading ? (
          <Spinner label="Checking certificate…" />
        ) : error || !data?.valid ? (
          <Card className="p-6 text-center">
            <ShieldX size={44} className="mx-auto text-red-500" />
            <h1 className="mt-3 text-lg font-bold text-slate-900">Not a valid certificate</h1>
            <p className="mt-1 text-sm text-slate-500">
              No issued certificate has the number <span className="font-mono">{number}</span>. Check the number, or contact the organiser.
            </p>
            <Link href="/verify" className="mt-4 inline-block text-sm font-semibold text-brand">Try another number</Link>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="bg-emerald-600 px-6 py-5 text-white">
              <BadgeCheck size={36} />
              <h1 className="mt-2 text-lg font-bold">Valid certificate</h1>
              <p className="font-mono text-sm text-white/80">{data.certificateNo}</p>
            </div>
            <dl className="divide-y divide-slate-100 px-6 text-sm">
              <Row label="Name" value={data.name} />
              {data.kind === "STUDENT" ? (
                <>
                  {data.club && <Row label="Club" value={data.club} />}
                  {data.category && <Row label="Category" value={data.category} />}
                  {data.placement && <Row label="Result" value={PLACEMENT_LABEL[data.placement]} />}
                </>
              ) : (
                <Row label="Role" value={titleCase(data.role ?? "")} />
              )}
              <Row label="Tournament" value={<Link href={`/t/${data.tournament.slug}`} className="text-brand hover:underline">{data.tournament.title}</Link>} />
              <Row label="Date" value={formatDate(data.tournament.startDate)} />
              <Row label="Venue" value={data.tournament.venue} />
            </dl>
            <div className="border-t border-slate-100 p-4">
              <Button className="w-full" icon={<Download size={16} />} onClick={() => openPdf(`/public/certificates/${data.certificateNo}`, "download", `${data.name}_certificate.pdf`).catch((err) => toast(errorMessage(err), false))}>
                Download certificate
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
