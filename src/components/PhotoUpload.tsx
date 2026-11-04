"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Info, Loader2, RefreshCw, X } from "lucide-react";
import { cx } from "./ui";
import { errorMessage } from "./Toast";

/** Passport photo: 35 × 45 mm. Saved at 420 × 540 px, which prints sharp on the Tournament Entry Pass and stays small. */
const OUT_W = 420;
const OUT_H = 540;

export const PHOTO_RULES = [
  "Passport-size photograph (35 × 45 mm), face and shoulders",
  "Plain blue or white background",
  "Recent (taken in the last 6 months) and clear — no blur, filters or sunglasses",
  "Face the camera, eyes open, face fully visible",
];

/** Centre-crop to the passport shape and re-encode as JPEG. */
async function toPassportPhoto(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Choose a JPG or PNG photo.");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That photo could not be read. Try a JPG or PNG."));
      el.src = url;
    });
    if (img.width < 200 || img.height < 250) throw new Error("This photo is too small. Use a clear photo at least 200 × 250 pixels.");
    const target = OUT_W / OUT_H;
    const sw = img.width / img.height > target ? img.height * target : img.width;
    const sh = img.width / img.height > target ? img.height : img.width / target;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    // Keep the top of the photo (the head) when trimming a tall picture.
    const sy = img.height > sh ? (img.height - sh) * 0.25 : 0;
    ctx.drawImage(img, (img.width - sw) / 2, sy, sw, sh, 0, 0, OUT_W, OUT_H);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upload with the photo requirements shown beside it, and a preview of exactly what will be printed. */
export function PhotoUpload({ value, onChange, invalid }: { value: string; onChange: (dataUrl: string) => void; invalid?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = (
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="sr-only"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setError("");
        setBusy(true);
        try {
          onChange(await toPassportPhoto(file));
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    />
  );

  return (
    <div className="grid gap-4 sm:grid-cols-[9.5rem_1fr]">
      {value ? (
        <div className="relative mx-auto w-[9.5rem] sm:mx-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL preview */}
          <img src={value} alt="Your photograph" className="aspect-[7/9] w-full rounded-lg object-cover shadow-sm ring-1 ring-slate-200" />
          <button type="button" onClick={() => onChange("")} aria-label="Remove photo" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-slate-200 hover:text-red-600">
            <X size={14} />
          </button>
          <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 text-xs font-semibold text-brand hover:underline">
            <RefreshCw size={12} /> Change photo
            {pick}
          </label>
        </div>
      ) : (
        <label
          className={cx(
            "mx-auto flex aspect-[7/9] w-[9.5rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-3 text-center transition-colors sm:mx-0",
            invalid ? "border-red-300 bg-red-50/40" : "border-slate-300 bg-slate-50/60 hover:border-brand/60 hover:bg-brand-soft/40",
          )}
        >
          {busy ? <Loader2 size={24} className="animate-spin text-brand" /> : <Camera size={24} className="text-brand" />}
          <span className="text-sm font-semibold text-slate-700">Upload photo</span>
          <span className="text-[11px] leading-tight text-slate-500">JPG or PNG</span>
          {pick}
        </label>
      )}

      <div className={cx("rounded-xl border px-4 py-3 text-sm", value ? "border-emerald-200 bg-emerald-50/60" : "border-sky-200 bg-sky-50/70")} role="note">
        <p className={cx("mb-1.5 flex items-center gap-1.5 font-semibold", value ? "text-emerald-800" : "text-sky-900")}>
          {value ? <CheckCircle2 size={15} /> : <Info size={15} />}
          {value ? "Check your photo meets these rules" : "Photograph requirements"}
        </p>
        <ul className="space-y-1 text-slate-700">
          {PHOTO_RULES.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">It is printed on your Tournament Entry Pass and checked at the venue. A photo that doesn&apos;t meet these rules may be rejected.</p>
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </div>
    </div>
  );
}
