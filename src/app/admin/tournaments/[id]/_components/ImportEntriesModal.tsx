"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { downloadFile, runImportJob, type ImportProgress } from "@/lib/api";
import { feeLabel } from "@/components/Payment";
import type { TournamentDetail } from "@/lib/types";
import { Button, Modal, cx } from "@/components/ui";
import { ImportProgressBar, ProblemList } from "@/components/ImportStudentsModal";
import { errorMessage, useToast } from "@/components/Toast";

interface RowResult { row: number; fullName: string; studentNo: string; entries: string[]; errors: string[] }
interface Preview {
  rows: RowResult[];
  valid: number;
  invalid: number;
  entries: number;
  entryFee: number;
  additionalEntryFee: number;
  missingColumns: string[];
  unknownColumns: string[];
}
interface Imported { students: number; entries: number; failed: RowResult[] }

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Enter many students in this tournament from the Excel template: pick a file → every row is checked
 * like "Register student" (nothing saved) → enter the rows without problems.
 */
export function ImportEntriesModal({ tournament, open, onClose, onImported }: { tournament: TournamentDetail; open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Imported | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "import" | "template">("");
  const [error, setError] = useState("");
  const [showReady, setShowReady] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const base = `/tournaments/${tournament.id}/registrations/import`;

  const close = () => {
    if (busy === "import") return;
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setShowReady(false);
    if (input.current) input.current.value = "";
    onClose();
  };

  async function check(f: File) {
    setFile(f);
    setPreview(null);
    setError("");
    if (f.size > MAX_BYTES) return setError("The file must be smaller than 5 MB.");
    if (!/\.(xlsx|csv)$/i.test(f.name)) return setError(/\.xls$/i.test(f.name) ? "Old .xls files can't be read — open it in Excel and save as .xlsx." : "Choose an .xlsx or .csv file.");
    setBusy("check");
    try {
      setPreview(await runImportJob<Preview>(`${base}?dryRun=1`, `${base}/jobs`, f, setProgress));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
      setProgress(null);
    }
  }

  async function runImport() {
    if (!file) return;
    setBusy("import");
    try {
      const r = await runImportJob<Imported>(base, `${base}/jobs`, file, setProgress);
      setResult(r);
      if (r.entries) onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
      setProgress(null);
    }
  }

  async function template() {
    setBusy("template");
    try {
      await downloadFile(`${base}/template`, `${tournament.slug}_entries_import_template.xlsx`);
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy("");
      setProgress(null);
    }
  }

  const problems = preview?.rows.filter((r) => r.errors.length) ?? [];
  const ready = preview?.rows.filter((r) => !r.errors.length) ?? [];

  const footer = result ? (
    <Button onClick={close}>Done</Button>
  ) : (
    <>
      <Button variant="secondary" onClick={close} disabled={busy === "import"}>Cancel</Button>
      {preview && (
        <Button icon={<Upload size={16} />} loading={busy === "import"} disabled={!preview.valid} onClick={runImport}>
          Enter {preview.valid} student{preview.valid === 1 ? "" : "s"} ({preview.entries} entr{preview.entries === 1 ? "y" : "ies"})
        </Button>
      )}
    </>
  );

  return (
    <Modal open={open} onClose={close} title="Import entries" wide footer={footer}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} />
            <div className="text-sm text-emerald-900">
              <p className="font-bold">{result.entries} entr{result.entries === 1 ? "y" : "ies"} added for {result.students} student{result.students === 1 ? "" : "s"}</p>
              <p className="mt-0.5">
                Each entry still needs its weigh-in before the draw.
              </p>
            </div>
          </div>
          {result.failed.length > 0 && <ProblemList title={`${result.failed.length} row${result.failed.length === 1 ? "" : "s"} not imported`} rows={result.failed} />}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800">1. Fill in the template</p>
              <p>
                One student per row: their <strong>Student ID</strong> (or Aadhaar number), <strong>weight</strong> and age groups.
                Students must already be on the Students page — add new ones with Students → Import.
              </p>
            </div>
            <Button variant="secondary" icon={<FileSpreadsheet size={16} />} loading={busy === "template"} onClick={template} className="shrink-0">
              Download template
            </Button>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">2. Upload it</p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void check(f);
              }}
              className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-center transition-colors hover:border-brand hover:bg-brand-soft/30"
            >
              <Upload size={22} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">{file ? file.name : "Choose or drop an Excel file"}</span>
              <span className="text-xs text-slate-400">.xlsx or .csv · up to 5 MB · 2000 students</span>
            </button>
            <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); }} />
          </div>

          {(busy === "check" || busy === "import") && <ImportProgressBar progress={progress} />}
          {error && <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><XCircle size={16} className="mt-0.5 shrink-0" /> {error}</p>}

          {preview && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">3. Check and import</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-2xl font-bold text-emerald-700">{preview.valid}</p>
                  <p className="text-xs font-medium text-emerald-800">students ready · {preview.entries} entr{preview.entries === 1 ? "y" : "ies"}</p>
                </div>
                <div className={cx("rounded-xl p-3", preview.invalid ? "bg-red-50" : "bg-slate-50")}>
                  <p className={cx("text-2xl font-bold", preview.invalid ? "text-red-600" : "text-slate-400")}>{preview.invalid}</p>
                  <p className={cx("text-xs font-medium", preview.invalid ? "text-red-700" : "text-slate-500")}>with problems — will be skipped</p>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 p-3 sm:col-span-1">
                  <p className="text-2xl font-bold text-slate-800">Free</p>
                  <p className="text-xs font-medium text-slate-500">{preview.entryFee > 0 ? `${feeLabel(preview)} (unpaid until paid)` : "Free entry"}</p>
                </div>
              </div>
              {preview.missingColumns.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>Required columns not found: <strong>{preview.missingColumns.join(", ")}</strong>. Use the template&apos;s header row.</span>
                </p>
              )}
              {preview.unknownColumns.length > 0 && <p className="text-xs text-slate-500">Ignored columns: {preview.unknownColumns.join(", ")}</p>}
              {problems.length > 0 && <ProblemList title="Rows with problems" rows={problems} hint="Fix these in the file and upload it again, or enter the rest now." />}
              {ready.length > 0 && (
                <div>
                  <button type="button" onClick={() => setShowReady((s) => !s)} className="text-xs font-semibold text-brand hover:underline">
                    {showReady ? "Hide" : "Show"} the {ready.length} student{ready.length === 1 ? "" : "s"} ready to enter
                  </button>
                  {showReady && (
                    <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                      {ready.map((r) => (
                        <li key={r.row} className="flex justify-between gap-3 px-3 py-1.5">
                          <span className="min-w-0 truncate"><span className="mr-2 text-xs text-slate-400">Row {r.row}</span>{r.fullName} <span className="font-mono text-xs text-slate-400">{r.studentNo}</span></span>
                          <span className="shrink-0 text-xs text-slate-600">{r.entries.join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
