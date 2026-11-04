"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { BELTS, RED, findBelt, type Belt } from "@/lib/belts";
import { cx } from "./ui";

/** A small picture of the belt: its colour, the red bar, or the red-and-white panels. */
export function BeltSwatch({ belt, className }: { belt: Belt; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("relative inline-block h-3.5 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-slate-900/20", className)}
      style={{
        background: belt.striped ? `repeating-linear-gradient(90deg, ${RED} 0 25%, #fff 25% 50%)` : belt.color,
      }}
    >
      {belt.redBar && <span className="absolute inset-y-0 left-0 w-[35%]" style={{ background: RED }} />}
    </span>
  );
}

/** Belt grade picker: every kyu and dan grade with its colours, kyu grades first. */
export function BeltSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = findBelt(value);

  // Close when clicking or tabbing outside.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent | FocusEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("focusin", away);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("focusin", away);
    };
  }, [open]);

  // Keep the highlighted grade in view.
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    const i = BELTS.findIndex((b) => b.value === selected?.value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };
  const choose = (b: Belt) => {
    onChange(b.value);
    setOpen(false);
  };

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(BELTS.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(BELTS.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(BELTS[active]!); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          "flex h-12 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left text-base shadow-sm shadow-slate-900/[0.02] transition-[border-color,box-shadow] sm:h-11 sm:text-sm",
          open ? "border-brand ring-4 ring-brand/10" : "border-slate-200 hover:border-slate-300",
        )}
      >
        {selected ? (
          <>
            <BeltSwatch belt={selected} />
            <span className="min-w-0 flex-1 truncate text-slate-900">{selected.label}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-slate-400">{value || "Select belt grade"}</span>
        )}
        <ChevronDown size={16} className={cx("shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {value && !open && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear belt" className="absolute inset-y-0 right-9 my-auto flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-600">
          <X size={14} />
        </button>
      )}

      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label="Belt grade"
          className="animate-fade-in absolute z-30 mt-1.5 max-h-80 w-full min-w-[16rem] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10"
        >
          {BELTS.map((b, i) => (
            <li key={b.value} role="presentation">
              {(i === 0 || BELTS[i - 1]!.group !== b.group) && (
                <p className={cx("px-3.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400", i > 0 ? "mt-1.5 border-t border-slate-100 pt-2.5" : "pt-1")}>{b.group}</p>
              )}
              <div
                role="option"
                data-index={i}
                aria-selected={selected?.value === b.value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(b)}
                className={cx("flex cursor-pointer items-center gap-3 px-3.5 py-2 text-sm", i === active ? "bg-brand-soft text-slate-900" : "text-slate-700")}
              >
                <BeltSwatch belt={b} />
                <span className="min-w-0 flex-1">{b.label}</span>
                {selected?.value === b.value && <Check size={15} className="shrink-0 text-brand" />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
