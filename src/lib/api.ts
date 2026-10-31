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

/** Fetch a PDF and either open it in a new tab or save it. */
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
