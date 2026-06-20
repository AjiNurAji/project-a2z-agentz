const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError extends Error {
  status: number;
  body: unknown;
}

/**
 * Fetch wrapper for backend API calls.
 * Always includes credentials (cookies) and parses JSON.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(
      (body as { error?: string })?.error || `Request failed (${res.status})`
    ) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body as T;
}
