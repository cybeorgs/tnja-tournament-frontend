"use client";

import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, KeyRound, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/hooks";
import type { Settings } from "@/lib/types";
import { Button, Card, Field, Input, PageHeader, Spinner } from "@/components/ui";
import { logoUrl } from "@/components/Brand";
import { errorMessage, useToast } from "@/components/Toast";

type SettingsForm = Omit<Settings, "hasLogo" | "updatedAt">;

const toForm = (s: Settings): SettingsForm => ({
  orgName: s.orgName, orgShortName: s.orgShortName, tagline: s.tagline,
  signatory1Name: s.signatory1Name, signatory1Title: s.signatory1Title,
  signatory2Name: s.signatory2Name, signatory2Title: s.signatory2Title,
});

export default function SettingsPage() {
  const toast = useToast();
  const { data: settings, setData } = useSettings();
  // Null until the organiser edits something; until then the saved settings are shown.
  const [edits, setEdits] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!settings) return <Spinner />;
  const form = edits ?? toForm(settings);

  const set = (k: keyof SettingsForm, v: string) => setEdits({ ...form, [k]: v });

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      setData(await api<Settings>("/settings", { method: "PUT", body: form }));
      setEdits(null);
      toast("Settings saved. New certificates will use them.");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!/image\/(png|jpeg)/.test(file.type)) return toast("Use a PNG or JPEG image.", false);
    if (file.size > 1024 * 1024) return toast("Logo must be smaller than 1 MB.", false);
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      setData(await api<Settings>("/settings/logo", { method: "PUT", body: { dataUrl } }));
      toast("Logo updated.");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeLogo() {
    try {
      setData(await api<Settings>("/settings/logo", { method: "DELETE" }));
      toast("Logo removed.");
    } catch (err) {
      toast(errorMessage(err), false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Shown on the public site and certificates." />

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold text-slate-800">Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {settings.hasLogo
              // eslint-disable-next-line @next/next/no-img-element -- served by the API
              ? <img src={logoUrl(settings)} alt="Logo" className="h-full w-full object-contain" />
              : <span className="text-xs text-slate-400">No logo</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          <Button variant="secondary" icon={<ImagePlus size={16} />} loading={uploading} onClick={() => fileRef.current?.click()}>Upload PNG / JPEG</Button>
          {settings.hasLogo && <Button variant="ghost" icon={<Trash2 size={16} />} onClick={removeLogo}>Remove</Button>}
        </div>
        <p className="mt-2 text-xs text-slate-400">Square images work best. Max 1 MB.</p>
      </Card>

      <Card className="p-5 sm:p-6">
        <form onSubmit={save} className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Organisation</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <Field label="Organisation name"><Input value={form.orgName} onChange={(e) => set("orgName", e.target.value)} required /></Field>
            <Field label="Short name" hint="Also prefixes certificate numbers"><Input value={form.orgShortName} onChange={(e) => set("orgShortName", e.target.value)} required maxLength={20} /></Field>
          </div>
          <Field label="Tagline" hint="Shown under the name on certificates, e.g. affiliation">
            <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <h2 className="pt-2 text-sm font-bold text-slate-800">Certificate signatories</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Left — name"><Input value={form.signatory1Name} onChange={(e) => set("signatory1Name", e.target.value)} /></Field>
            <Field label="Left — title"><Input value={form.signatory1Title} onChange={(e) => set("signatory1Title", e.target.value)} /></Field>
            <Field label="Right — name"><Input value={form.signatory2Name} onChange={(e) => set("signatory2Name", e.target.value)} /></Field>
            <Field label="Right — title"><Input value={form.signatory2Title} onChange={(e) => set("signatory2Title", e.target.value)} /></Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save settings</Button>
          </div>
        </form>
      </Card>

      <PasswordCard />
    </div>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast("New password must be at least 8 characters.", false);
    if (next !== confirm) return toast("The new passwords don't match.", false);
    setSaving(true);
    try {
      await api("/auth/change-password", { body: { currentPassword: current, newPassword: next } });
      toast("Password changed.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><KeyRound size={16} /> Change password</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
          <Field label="Repeat new password"><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
        </div>
        <div className="flex justify-end"><Button type="submit" variant="secondary" loading={saving}>Change password</Button></div>
      </form>
    </Card>
  );
}
