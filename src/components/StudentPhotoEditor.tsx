"use client";

import { useEffect, useState } from "react";
import { Camera, Loader2, RefreshCw } from "lucide-react";
import { api, fetchObjectUrl } from "@/lib/api";
import { toPassportPhoto } from "./PhotoUpload";
import { errorMessage, useToast } from "./Toast";

/**
 * Admin: the student's passport photo with a "Change photo" button. The new photo is cropped to the
 * passport shape and saved straight away (separately from the form's Save); the Tournament Entry Pass
 * uses it from then on.
 */
export function StudentPhotoEditor({ studentId, onChanged }: { studentId: string; onChanged?: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current: string | null = null;
    let cancelled = false;
    fetchObjectUrl(`/students/${studentId}/documents/PHOTO`).then(
      (u) => {
        if (cancelled) return URL.revokeObjectURL(u);
        current = u;
        setUrl(u);
        setLoaded(true);
      },
      () => !cancelled && setLoaded(true),
    );
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [studentId]);

  async function pick(file: File) {
    setError("");
    setBusy(true);
    try {
      const photo = await toPassportPhoto(file);
      await api(`/students/${studentId}/photo`, { method: "PUT", body: { photo } });
      setUrl(photo);
      toast("Photo saved. The entry pass now shows the new photo.");
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob: / data: URL
        <img src={url} alt="Passport photo" className="aspect-[7/9] w-20 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-slate-200" />
      ) : (
        <span className="flex aspect-[7/9] w-20 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-400">
          {loaded ? <Camera size={22} /> : <Loader2 size={18} className="animate-spin" />}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">Passport photo</p>
        <p className="text-xs text-slate-500">{loaded && !url ? "No photo uploaded." : "Printed on the Tournament Entry Pass."} JPG or PNG; cropped to passport size.</p>
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand shadow-sm ring-1 ring-slate-200 hover:bg-brand-soft/40">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {busy ? "Saving…" : url ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pick(file);
            }}
          />
        </label>
        <p className="mt-1 text-[11px] text-slate-400">Saved straight away; no need to press Save.</p>
        {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
}
