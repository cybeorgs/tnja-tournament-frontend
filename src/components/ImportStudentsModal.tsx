"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { downloadFile, uploadFile } from "@/lib/api";
import { Button, Modal, cx } from "./ui";
import { errorMessage, useToast } from "./Toast";

interface RowResult { row: number; fullName: string; email: string; district: string; errors: string[] }
interface Preview { rows: RowResult[]; valid: number; invalid: number; missingColumns: string[]; unknownColumns: string[] }
interface Imported { created: number; students: { row: number; fullName: string; studentNo: string | null }[]; failed: RowResult[]; emailsQueued: number }

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Bulk import from the Excel template: pick a file → every row is checked (nothing saved) →
 * import the rows without problems. Each new student gets a student ID and, optionally, an email
 * with a link to set their password.
 */
export function ImportStudentsModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Imported | null>(null);
  const [sendEmails, setSendEmails] = useState(true);
  const [busy, setBusy] = useState<"" | "check" | "import" | "template">("");
  const [error, setError] = useState("");
  const [showReady, setShowReady] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setShowReady(false);
    if (input.current) input.current.value = "";
  };
  const close = () => {
    if (busy === "import") return;
    if (result?.created) onImported();
    reset();
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
      setPreview(await uploadFile<Preview>("/students/import?dryRun=1", f));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function runImport() {
    if (!file) return;
    setBusy("import");
    try {
      const r = await uploadFile<Imported>(`/students/import${sendEmails ? "?sendEmails=1" : ""}`, file);
      setResult(r);
      if (r.created) onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function template() {
    setBusy("template");
    try {
      await downloadFile("/students/import/template", "students_import_template.xlsx");
    } catch (err) {
      toast(errorMessage(err), false);
    } finally {
      setBusy("");
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
          Import {preview.valid} student{preview.valid === 1 ? "" : "s"}
        </Button>
      )}
    </>
  );

  return (
    <Modal open={open} onClose={close} title="Import students" wide footer={footer}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} />
            <div className="text-sm text-emerald-900">
              <p className="font-bold">{result.created} student{result.created === 1 ? "" : "s"} imported</p>
              <p className="mt-0.5">
                Each has a permanent student ID.
                {result.emailsQueued > 0 ? ` Login emails with a set-password link are being sent to ${result.emailsQueued} address${result.emailsQueued === 1 ? "" : "es"}.` : " No emails were sent — students can use “Forgot password” on the student login to get their link."}
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
              <p>Orange columns are required. One student per row; the “How to fill” sheet explains each column.</p>
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

          {busy === "check" && <p className="text-sm text-slate-500">Checking every row… (pincodes are looked up, so a large file takes a moment)</p>}
          {error && <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><XCircle size={16} className="mt-0.5 shrink-0" /> {error}</p>}

          {preview && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">3. Check and import</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-2xl font-bold text-emerald-700">{preview.valid}</p>
                  <p className="text-xs font-medium text-emerald-800">ready to import</p>
                </div>
                <div className={cx("rounded-xl p-3", preview.invalid ? "bg-red-50" : "bg-slate-50")}>
                  <p className={cx("text-2xl font-bold", preview.invalid ? "text-red-600" : "text-slate-400")}>{preview.invalid}</p>
                  <p className={cx("text-xs font-medium", preview.invalid ? "text-red-700" : "text-slate-500")}>with problems — will be skipped</p>
                </div>
              </div>
              {preview.missingColumns.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>Required columns not found: <strong>{preview.missingColumns.join(", ")}</strong>. Use the template&apos;s header row.</span>
                </p>
              )}
              {preview.unknownColumns.length > 0 && (
                <p className="text-xs text-slate-500">Ignored columns: {preview.unknownColumns.join(", ")}</p>
              )}
              {problems.length > 0 && <ProblemList title="Rows with problems" rows={problems} hint="Fix these in the file and upload it again, or import the rest now." />}
              {ready.length > 0 && (
                <div>
                  <button type="button" onClick={() => setShowReady((s) => !s)} className="text-xs font-semibold text-brand hover:underline">
                    {showReady ? "Hide" : "Show"} the {ready.length} student{ready.length === 1 ? "" : "s"} ready to import
                  </button>
                  {showReady && (
                    <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                      {ready.map((r) => (
                        <li key={r.row} className="flex justify-between gap-3 px-3 py-1.5">
                          <span className="truncate"><span className="mr-2 text-xs text-slate-400">Row {r.row}</span>{r.fullName}</span>
                          <span className="truncate text-xs text-slate-500">{r.district} · {r.email}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {preview.valid > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} className="h-4 w-4 accent-[#ff7400]" />
                  Email each student their student ID and a link to set their password
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function ProblemList({ title, rows, hint }: { title: string; rows: { row: number; fullName: string; errors: string[] }[]; hint?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-red-200">
      <div className="bg-red-50 px-3 py-2">
        <p className="text-sm font-semibold text-red-800">{title}</p>
        {hint && <p className="text-xs text-red-700">{hint}</p>}
      </div>
      <ul className="max-h-64 divide-y divide-red-100 overflow-y-auto text-sm">
        {rows.map((r) => (
          <li key={r.row} className="px-3 py-2">
            <p className="font-semibold text-slate-800"><span className="mr-2 text-xs font-normal text-slate-400">Row {r.row}</span>{r.fullName || "(no name)"}</p>
            <ul className="mt-0.5 list-disc pl-5 text-xs text-red-700">
              {r.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
