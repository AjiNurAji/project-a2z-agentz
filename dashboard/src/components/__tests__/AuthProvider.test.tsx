import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

import { AuthProvider, useAuth } from "../AuthProvider";
import * as authLib from "@/lib/auth";

// Test component that consumes the context
function TestConsumer() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div data-testid="loading">Loading...</div>;
  return (
    <div>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.mocked(authLib.me).mockReset();
    vi.mocked(authLib.logout).mockReset();
  });

  it("shows loading initially, then user from /me", async () => {
    vi.mocked(authLib.me).mockResolvedValue({ id: 1, email: "u@b.io" });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially loading
    expect(screen.getByTestId("loading")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("email").textContent).toBe("u@b.io");
    });
  });

  it("shows 'none' when /me returns null (unauthenticated)", async () => {
    vi.mocked(authLib.me).mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("email").textContent).toBe("none");
    });
  });

  it("logout clears user state", async () => {
    vi.mocked(authLib.me).mockResolvedValue({ id: 1, email: "u@b.io" });
    vi.mocked(authLib.logout).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("email").textContent).toBe("u@b.io");
    });

    await act(async () => {
      screen.getByText("Logout").click();
    });

    expect(authLib.logout).toHaveBeenCalled();
  });
});
