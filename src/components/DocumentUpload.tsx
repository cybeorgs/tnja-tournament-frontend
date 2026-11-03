"use client";

import { useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/upload";
import { cx } from "./ui";
import { errorMessage } from "./Toast";

/** Pick a JPG/PNG/WEBP/PDF and hand it back as a data: URL (images are shrunk first). */
export function DocumentUpload({ value, onChange, label, hint, invalid }: { value: string; onChange: (dataUrl: string) => void; label: string; hint?: string; invalid?: boolean }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <FileText size={18} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{name || label}</span>
        <button type="button" onClick={() => { onChange(""); setName(""); }} aria-label="Remove file" className="rounded-lg p-1 text-emerald-700 transition-colors hover:bg-white hover:text-red-600">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          invalid ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-slate-50/60 hover:border-brand/50 hover:bg-brand-soft/40",
        )}
      >
        {busy ? <Loader2 size={22} className="animate-spin text-brand" /> : <UploadCloud size={22} className="text-brand" />}
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">{hint ?? "JPG, PNG or PDF · up to 1 MB"}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            setBusy(true);
            try {
              onChange(await fileToDataUrl(file));
              setName(file.name);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
