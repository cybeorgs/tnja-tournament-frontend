"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { api } from "./api";
import type { Meta, Settings, Unit } from "./types";

/** Load JSON from the API; `reload` refetches. Data from the previous load stays visible while reloading. */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });
  const key = path ? `${path}#${version}` : null;

  useEffect(() => {
    if (!path || !key) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((e: Error) => !cancelled && setResult((r) => ({ key, data: r.data, error: e.message })));
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback((next: SetStateAction<T | null>) => {
    setResult((r) => ({ ...r, data: typeof next === "function" ? (next as (prev: T | null) => T | null)(r.data) : next }));
  }, []);

  return { data: result.data, setData, error: result.error, loading: !!key && result.key !== key, reload };
}

/** Units a player can represent (Admin → Settings → Units), for the registration form. */
export function useUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  useEffect(() => {
    let cancelled = false;
    api<Unit[]>("/public/units").then((u) => !cancelled && setUnits(u)).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return units;
}

let metaCache: Meta | null = null;

export function useMeta() {
  // Show the copy already loaded straight away, but always fetch the latest too: age groups and weight
  // classes can change on the server while a tab stays open (a remembered copy would stay out of date).
  const [meta, setMeta] = useState<Meta | null>(metaCache);
  useEffect(() => {
    let cancelled = false;
    api<Meta>("/public/meta")
      .then((m) => {
        metaCache = m;
        if (!cancelled) setMeta(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return meta;
}

export function useSettings() {
  return useApi<Settings>("/public/settings");
}

/**
 * The current time, refreshed every `everyMs`, so pages that depend on a schedule (e.g. registration
 * switching to late registration or closing) update on their own without a reload.
 */
export function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
