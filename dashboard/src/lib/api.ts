const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";
const JUDGE_TOKEN = process.env.NEXT_PUBLIC_JUDGE_TOKEN || "";

interface ApiError extends Error {
  status: number;
  body: unknown;
}

/**
 * Fetch wrapper for backend API calls.
 *
 * Always sends cookies (the ``a2z-token`` JWT or ``JUDGE_TOKEN``-equivalent
 * demo cookie handled by the auth provider) via ``credentials: "include"``.
 *
 * In addition, when ``NEXT_PUBLIC_API_KEY`` is defined the call adds the
 * ``X-API-Key`` header so it cleanly passes ``backend/routes/api.py::check_auth``
 * for read-only / mutate endpoints without forcing the dashboard to depend
 * on a JWT round-trip in every cycle (rules out 401s on cold-start).
 *
 * When ``NEXT_PUBLIC_JUDGE_TOKEN`` is defined (hackathon demo mode), the
 * token is forwarded as ``X-Judge-Token`` for the same read-only judge
 * bypass used by ``backend/routes/api.py``.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (API_KEY && !headers["X-API-Key"]) {
    headers["X-API-Key"] = API_KEY;
  }
  if (JUDGE_TOKEN && !headers["X-Judge-Token"]) {
    headers["X-Judge-Token"] = JUDGE_TOKEN;
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
