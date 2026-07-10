import { describe, it, expect } from "vitest";

/**
 * Test the middleware decision logic as a pure function.
 * We extract the logic so it's testable without NextRequest mocks.
 */

interface MiddlewareDecision {
  action: "next" | "redirect";
  destination?: string;
}

function decideMiddleware(
  pathname: string,
  hasToken: boolean
): MiddlewareDecision {
  const PUBLIC_PATHS = ["/", "/login", "/register"];
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".");

  if (isStaticAsset) return { action: "next" };
  if (!hasToken && !isPublic && !isAuthPage) {
    return {
      action: "redirect",
      destination: `/login?next=${encodeURIComponent(pathname)}`,
    };
  }
  if (hasToken && isAuthPage) {
    return { action: "redirect", destination: "/dashboard" };
  }
  return { action: "next" };
}

describe("middleware logic", () => {
  it("redirects unauthenticated /dashboard to /login?next=/dashboard", () => {
    const result = decideMiddleware("/dashboard", false);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/login?next=%2Fdashboard");
  });

  it("redirects unauthenticated /analytics to /login?next=/analytics", () => {
    const result = decideMiddleware("/analytics", false);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/login?next=%2Fanalytics");
  });

  it("allows unauthenticated access to / (landing)", () => {
    const result = decideMiddleware("/", false);
    expect(result.action).toBe("next");
  });

  it("allows unauthenticated access to /login", () => {
    const result = decideMiddleware("/login", false);
    expect(result.action).toBe("next");
  });

  it("allows unauthenticated access to /register", () => {
    const result = decideMiddleware("/register", false);
    expect(result.action).toBe("next");
  });

  it("redirects authenticated /login to /dashboard", () => {
    const result = decideMiddleware("/login", true);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/dashboard");
  });

  it("redirects authenticated /register to /dashboard", () => {
    const result = decideMiddleware("/register", true);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/dashboard");
  });

  it("allows authenticated access to /dashboard", () => {
    const result = decideMiddleware("/dashboard", true);
    expect(result.action).toBe("next");
  });

  it("allows static assets through", () => {
    const result = decideMiddleware("/_next/static/chunk.js", false);
    expect(result.action).toBe("next");
  });

  it("allows API routes through", () => {
    const result = decideMiddleware("/api/stats", false);
    expect(result.action).toBe("next");
  });

  it("redirects unauthenticated /agents to login", () => {
    const result = decideMiddleware("/agents", false);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/login?next=%2Fagents");
  });

  it("allows authenticated /agents", () => {
    const result = decideMiddleware("/agents", true);
    expect(result.action).toBe("next");
  });
});
