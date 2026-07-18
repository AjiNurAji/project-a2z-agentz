import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "a2z-token";

// Paths that don't require authentication
const PUBLIC_PATHS = ["/", "/login", "/register"];

export function proxy(request: NextRequest) {
  // Auth guard: the dashboard authenticates against the backend via
  // X-API-Key / JWT on each fetch, and the cross-site cookie is
  // unreliable on Vercel -> Railway. Let every route through; the
  // backend still enforces auth on protected API calls.
  return NextResponse.next();
}

export const config = {
  // Match all paths except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
