// Default to a relative URL so Next.js rewrites (next.config.ts) proxy
// /api/* to the Railway backend same-origin. Only use an absolute API_URL
// when explicitly provided (e.g. local dev against a running backend).
const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || "").trim();
const API_URL = RAW_API_URL.replace(/\/+$/, ""); // strip trailing slashes
const API_KEY = (process.env.NEXT_PUBLIC_API_KEY || "").trim();
const ADMIN_TOKEN = (process.env.NEXT_PUBLIC_ADMIN_TOKEN || "").trim();

interface ApiError extends Error {
  status: number;
  body: unknown;
}

/**
 * Fetch wrapper for backend API calls.
 *
 * Always sends cookies (the ``a2z-token`` JWT or ``ADMIN_TOKEN``-equivalent
 * demo cookie handled by the auth provider) via ``credentials: "include"``.
 *
 * In addition, when ``NEXT_PUBLIC_API_KEY`` is defined the call adds the
 * ``X-API-Key`` header so it cleanly passes ``backend/routes/api.py::check_auth``
 * for read-only / mutate endpoints without forcing the dashboard to depend
 * on a JWT round-trip in every cycle (rules out 401s on cold-start).
 *
 * When ``NEXT_PUBLIC_ADMIN_TOKEN`` is defined (demo mode), the
 * token is forwarded as ``X-Admin-Token`` for the same read-only admin
 * bypass used by ``backend/routes/api.py``.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Build the request URL safely. If API_URL is empty/unset we use a
  // same-origin relative path (browser resolves it against window.location),
  // which is valid for fetch() and avoids "Invalid URL" from new URL().
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = API_URL ? `${API_URL}${cleanPath}` : cleanPath;
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
  // Forward the JWT stored in localStorage (set after login/register) so
  // cross-site auth works without relying on flaky third-party cookies.
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("a2z-token");
    if (stored && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${stored}`;
    }
  }
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      const isGuest = localStorage.getItem("a2z-guest-session") === "1";
      const isWalletDemo = localStorage.getItem("a2z-wallet-session") !== null;

      // Basic client-side redirect for protected routes
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
    throw err;
  }

  return body as T;
}
