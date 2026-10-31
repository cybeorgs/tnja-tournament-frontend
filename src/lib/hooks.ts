"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { api } from "./api";
import type { Meta, Settings } from "./types";

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

let metaCache: Meta | null = null;

export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(metaCache);
  useEffect(() => {
    if (metaCache) return;
    api<Meta>("/public/meta")
      .then((m) => {
        metaCache = m;
        setMeta(m);
      })
      .catch(() => {});
  }, []);
  return meta;
}

export function useSettings() {
  return useApi<Settings>("/public/settings");
}
