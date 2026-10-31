"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Flag, ShieldCheck, Trophy } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export default function StartPage() {
  return (
    <AuthLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome 👋</h1>
      <p className="mt-2 text-sm text-slate-500">How would you like to continue?</p>

      <div className="mt-8 space-y-3">
        <Choice href="/enter" icon={<Trophy size={22} />} title="Tournament registration" text="For students — pick a tournament" primary />
        <Choice href="/referee" icon={<Flag size={22} />} title="Referee registration" text="For officials — pick a tournament" />
        <Choice href="/login" icon={<ShieldCheck size={22} />} title="Admin login" text="Manage tournaments" />
      </div>
    </AuthLayout>
  );
}

function Choice({ href, icon, title, text, primary }: { href: string; icon: ReactNode; title: string; text: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-orange-500/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 active:scale-[0.98]"
    >
      <span
        className={
          primary
            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm shadow-orange-500/30"
            : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-brand-soft group-hover:text-brand"
        }
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-500">{text}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
    </Link>
  );
}
