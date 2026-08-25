// Default to a relative URL so Next.js rewrites (next.config.ts) proxy
// /api/* to the Railway backend same-origin. Only use an absolute API_URL
// when explicitly provided (e.g. local dev against a running backend).
const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || "").trim();
// Known-good Railway backend (public URL, CORS-approved for archbusins.web.id).
const FALLBACK_API_URL = "https://project-a2z-agentz-production-dc3d.up.railway.app";
// Robustly resolve the backend base URL. Vercel can inject garbage / the literal
// string "undefined" / "null" / a malformed value for NEXT_PUBLIC_API_URL, any
// of which makes fetch() throw "Failed to execute 'fetch' on 'Window': Invalid
// value". We ALWAYS validate before trusting it and fall back otherwise — never
// build an invalid URL.
function resolveApiUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return FALLBACK_API_URL;
  }
  try {
    new URL(trimmed); // throws on malformed URLs (e.g. "https://", typos, spaces)
    return trimmed;
  } catch {
    console.warn("[api] NEXT_PUBLIC_API_URL invalid, using fallback:", trimmed);
    return FALLBACK_API_URL;
  }
}
export const API_URL = resolveApiUrl(RAW_API_URL);
const API_KEY = (process.env.NEXT_PUBLIC_API_KEY || "").trim();
const ADMIN_TOKEN = (process.env.NEXT_PUBLIC_ADMIN_TOKEN || "").trim();

interface ApiError extends Error {
  status: number;
  body: unknown;
}

/**
 * Fetch wrapper for backend API calls.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = API_URL ? `${API_URL}${cleanPath}` : cleanPath;
  console.log("[apiFetch] Verifying to URL:", url, "| path:", path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (API_KEY && !headers["X-API-Key"]) {
    headers["X-API-Key"] = API_KEY;
  }
  if (ADMIN_TOKEN && !headers["X-Admin-Token"]) {
    headers["X-Admin-Token"] = ADMIN_TOKEN;
  }
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("a2z-token");
    if (stored && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${stored}`;
    }
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (err) {
    console.error("[apiFetch] network error for", url, err);
    throw err instanceof Error ? err : new Error("Network request failed");
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const isGuest = localStorage.getItem("a2z-guest-session") === "1";
      const isWalletDemo = localStorage.getItem("a2z-wallet-session") !== null;
      if (
        !isGuest &&
        !isWalletDemo &&
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/register" &&
        window.location.pathname !== "/"
      ) {
        window.location.href = "/login";
      }
    }
    const err = new Error(
      (body as { error?: string })?.error || `Request failed (${res.status})`
    ) as ApiError;
    err.status = res.status;
    err.body = body;
    console.error("[apiFetch] request rejected:", url, err.status, err.message);
    throw err;
  }

  return body as T;
}
