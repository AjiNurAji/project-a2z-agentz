// Proxy SIWE endpoints to the Railway backend (same-origin to the Vercel app).
// Keeping these as Next.js API routes means the client never builds an
// absolute backend URL — eliminating the "Failed to execute fetch: Invalid
// value" class of bug that came from constructing URLs in the browser.

const RAILWAY = "https://project-a2z-agentz-production-dc3d.up.railway.app";

async function proxyOnce(req: Request, path: string): Promise<Response> {
  const url = `${RAILWAY}${path}`;
  // Forward the browser's Origin/Host to Railway so the backend generates the
  // EIP-4361 message domain (and validates it on verify) using the REAL
  // frontend origin (archbusins.web.id), not the Railway API host. Without
  // this, the message URI == railway.app -> wallet + verify reject (400 domain
  // mismatch).
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const origin = req.headers.get("origin");
  if (origin) headers["origin"] = origin;
  const host = req.headers.get("host");
  if (host) headers["host"] = host;
  const init: RequestInit = {
    method: req.method,
    headers,
  };
  if (req.method !== "GET") {
    init.body = JSON.stringify(await req.json().catch(() => ({})));
  }
  const res = await fetch(url, init);
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Retry once on backend 5xx — Railway instances can cold-start/sleep, and the
// first hit after idle occasionally returns 500. One transparent retry makes
// the SIWE nonce/verify flow resilient to that flare without surfacing an
// error to the user.
async function proxy(req: Request, path: string): Promise<Response> {
  const first = await proxyOnce(req, path);
  if (first.status < 500) return first;
  return proxyOnce(req, path);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/nonce")) {
    return proxy(req, "/api/auth/siwe/nonce");
  }
  if (url.pathname.endsWith("/verify")) {
    return proxy(req, "/api/auth/siwe/verify");
  }
  return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
}
