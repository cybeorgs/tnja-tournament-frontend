"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, ShieldCheck, Trophy } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";

export default function StartPage() {
  return (
    <AuthLayout>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome</h1>

      {/* Primary: student tournament registration */}
      <Link
        href="/enter"
        className="group mt-8 flex items-center gap-4 rounded-2xl bg-brand p-5 text-white shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-orange-500/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 active:scale-[0.98]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Trophy size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Register for a tournament</span>
          <span className="block text-sm text-white/85">For students</span>
        </span>
        <ArrowRight size={22} className="shrink-0 transition-transform group-hover:translate-x-1" />
      </Link>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/student/login" className="font-semibold text-brand hover:underline">Student login</Link>
      </p>

      {/* Secondary: admin */}
      <div className="mt-10 border-t border-slate-200 pt-6">
        <Choice href="/login" icon={<ShieldCheck size={18} />} title="Admin login" />
      </div>
    </AuthLayout>
  );
}

function Choice({ href, icon, title }: { href: string; icon: ReactNode; title: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-brand-soft group-hover:text-brand">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">{title}</span>
      <ChevronRight size={16} className="shrink-0 text-slate-300 transition-colors group-hover:text-brand" />
    </Link>
  );
}
