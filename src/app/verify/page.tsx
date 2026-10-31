"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui";
import { PublicShell } from "@/components/PublicShell";

export default function VerifyPage() {
  const router = useRouter();
  const [number, setNumber] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = number.trim().toUpperCase();
    if (clean) router.push(`/verify/${encodeURIComponent(clean)}`);
  };

  return (
    <PublicShell>
      <Card className="mx-auto max-w-md p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand"><ShieldCheck size={24} /></div>
        <h1 className="text-lg font-bold text-slate-900">Verify a certificate</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">Enter the number printed at the bottom of the certificate.</p>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Certificate number">
            <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. TNJA-2026-7KQ2M9XP" className="font-mono uppercase" required />
          </Field>
          <Button type="submit" className="w-full">Verify</Button>
        </form>
      </Card>
    </PublicShell>
  );
}
