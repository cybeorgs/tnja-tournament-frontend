export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9100/api";

const TOKEN_KEY = "tournament_token";

export const auth = {
  getToken: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const message = (body && (body.error || body.message)) || `Request failed (${res.status})`;
  if (res.status === 401 && typeof window !== "undefined" && auth.getToken()) {
    auth.clear();
    if (window.location.pathname !== "/login") window.location.href = "/login";
  }
  return new ApiError(res.status, message);
}

function headers(json: boolean): HeadersInit {
  const h: Record<string, string> = {};
  const token = auth.getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method || (init.body !== undefined ? "POST" : "GET"),
    headers: headers(init.body !== undefined),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

/** Fetch an authenticated file (e.g. an uploaded document) as an object URL; revoke it when done. */
export async function fetchObjectUrl(path: string): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(false) });
  if (!res.ok) throw await errorFrom(res);
  return URL.createObjectURL(await res.blob());
}

/** Fetch a PDF and either open it in a new tab or save it. */
/** Upload a file as the raw request body (its name in X-Filename) and read the JSON reply. */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { ...headers(false), "Content-Type": "application/octet-stream", "X-Filename": encodeURIComponent(file.name) },
    body: file,
  });
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

/** Download a file from an authenticated endpoint (e.g. an Excel export). */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: headers(false) });
  if (!res.ok) throw await errorFrom(res);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function openPdf(path: string, mode: "view" | "download", filename = "certificate.pdf") {
  // Open the tab inside the click handler so the popup blocker allows it.
  const tab = mode === "view" ? window.open("", "_blank") : null;
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${API_BASE}${path}${sep}download=${mode === "download" ? 1 : 0}`, { headers: headers(false) });
    if (!res.ok) throw await errorFrom(res);
    const blob = new Blob([await res.blob()], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.replace(/[^A-Za-z0-9._-]+/g, "_");
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    // Revoking straight away can cancel the download before the browser reads the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
