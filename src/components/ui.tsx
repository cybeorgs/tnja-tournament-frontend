"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, X } from "lucide-react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm shadow-orange-500/25 hover:bg-brand-dark hover:shadow-md hover:shadow-orange-500/25",
  secondary: "bg-white text-slate-700 border border-slate-200 shadow-sm shadow-slate-900/[0.03] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
  danger: "bg-white text-red-600 border border-red-200 hover:border-red-300 hover:bg-red-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 hover:bg-emerald-700",
};

export function Button({
  variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 rounded-lg px-3 text-xs" : "h-10 rounded-xl px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" size={size === "sm" ? 14 : 16} /> : icon}
      {children}
    </button>
  );
}

/**
 * Label + control + hint/error. `required` adds a small marker instead of writing "*" into labels.
 * Use `group` when the control is a set of buttons: a <label> would click the first one.
 */
export function Field({ label, hint, error, required, group, children, className }: {
  label: string; hint?: ReactNode; error?: ReactNode; required?: boolean; group?: boolean; children: ReactNode; className?: string;
}) {
  const Wrapper = group ? "div" : "label";
  return (
    <Wrapper className={cx("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-brand" aria-hidden>*</span>}
      </span>
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-slate-500">{hint}</span> : null}
    </Wrapper>
  );
}

const inputClass = cx(
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm shadow-slate-900/[0.02] transition-[border-color,box-shadow,background-color] duration-150",
  "placeholder:text-slate-400 hover:border-slate-300",
  "focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10",
  "aria-[invalid=true]:border-red-300 aria-[invalid=true]:focus:ring-red-500/10",
  "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500",
);

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

const toDisplay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** "DD/MM/YYYY" → "YYYY-MM-DD", or "" if incomplete or not a real date. */
function toIso(text: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return "";
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return date.getUTCDate() === Number(d) && date.getUTCMonth() === Number(mo) - 1 ? `${y}-${mo}-${d}` : "";
}

/** Digits → "DD/MM/YYYY" as the user types. */
const maskDate = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
};

/**
 * Date field that always shows DD/MM/YYYY (the native date input follows the browser's locale).
 * `value` / `onChange` use YYYY-MM-DD like <input type="date">; "" while incomplete.
 */
export function DateInput({ value, onChange, min, max, required, autoFocus, className }: {
  value: string; onChange: (iso: string) => void; min?: string; max?: string; required?: boolean; autoFocus?: boolean; className?: string;
}) {
  const [text, setText] = useState(() => toDisplay(value));
  const [seen, setSeen] = useState(value);
  const picker = useRef<HTMLInputElement>(null);

  // Follow changes made from outside (e.g. the form being reset or filled in).
  if (value !== seen) {
    setSeen(value);
    if (toIso(text) !== value) setText(toDisplay(value));
  }

  const iso = toIso(text);
  const outOfRange = !!iso && ((!!min && iso < min) || (!!max && iso > max));
  const invalid = text.length === 10 && (!iso || outOfRange);

  return (
    <div className="relative">
      <input
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        value={text}
        required={required}
        autoFocus={autoFocus}
        pattern="\d{2}/\d{2}/\d{4}"
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const next = maskDate(e.target.value);
          setText(next);
          onChange(toIso(next));
        }}
        className={cx(inputClass, "pr-11 tabular-nums", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        onClick={() => picker.current?.showPicker?.()}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-brand"
      >
        <CalendarDays size={17} />
      </button>
      {/* Native picker, kept invisible: it only supplies the calendar pop-up. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        min={min}
        max={max}
        onChange={(e) => {
          setText(toDisplay(e.target.value));
          onChange(e.target.value);
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
    </div>
  );
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, "select-chevron cursor-pointer appearance-none pr-10", props.className)}>{children}</select>;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, "h-auto min-h-28 py-2.5 leading-relaxed", props.className)} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]", className)}>{children}</div>;
}

const BADGE: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/15",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  yellow: "bg-amber-50 text-amber-800 ring-amber-600/20",
};

export function Badge({ color = "slate", children }: { color?: keyof typeof BADGE; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", BADGE[color])}>{children}</span>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
      <Loader2 className="animate-spin text-brand" size={18} /> {label}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand [&_svg]:h-7 [&_svg]:w-7">{icon}</div>}
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("animate-pop-in flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl shadow-slate-900/20 sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="flex items-center justify-between gap-4 px-6 pb-3 pt-5">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-5 pt-1">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** "← Back" pill used at the top of inner pages. Pass `href` to link, or `onClick` for in-page steps. */
export function BackLink({ href, onClick, children = "Back", className }: { href?: string; onClick?: () => void; children?: ReactNode; className?: string }) {
  const classes = cx(
    "no-print group mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-2.5 pr-3.5 text-sm font-medium text-slate-600 shadow-sm shadow-slate-900/[0.03] transition-all",
    "hover:border-brand/30 hover:bg-brand-soft hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20",
    className,
  );
  const inner = (
    <>
      <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
      {children}
    </>
  );
  return href ? <Link href={href} className={classes}>{inner}</Link> : <button type="button" onClick={onClick} className={classes}>{inner}</button>;
}

export { cx };
