import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "a2z-token";

// Paths that don't require authentication
const PUBLIC_PATHS = ["/", "/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".");

  // Skip middleware for static assets and Next.js internals
  if (isStaticAsset) {
    return NextResponse.next();
  }

  // Unauthenticated user trying to access protected route → redirect to login
  if (!token && !isPublic && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on auth pages → redirect to dashboard
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
