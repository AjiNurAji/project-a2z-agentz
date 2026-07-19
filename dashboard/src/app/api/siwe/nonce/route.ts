// Proxy SIWE endpoints to the Railway backend (same-origin to the Vercel app).
// Keeping these as Next.js API routes means the client never builds an
// absolute backend URL — eliminating the "Failed to execute fetch: Invalid
// value" class of bug that came from constructing URLs in the browser.

const RAILWAY = "https://project-a2z-agentz-production-dc3d.up.railway.app";

async function proxy(req: Request, path: string): Promise<Response> {
  const url = `${RAILWAY}${path}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
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
