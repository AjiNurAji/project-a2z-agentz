import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, register, me, logout } from "../auth";

vi.mock("../api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../api";
const mockedApiFetch = vi.mocked(apiFetch);

describe("auth helpers", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("login calls POST /api/auth/login", async () => {
    const fakeUser = { id: 1, email: "a@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    const result = await login("a@b.io", "pass1234");
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.io", password: "pass1234" }),
    });
    expect(result).toEqual(fakeUser);
  });

  it("register calls POST /api/auth/register", async () => {
    const fakeUser = { id: 2, email: "new@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    const wallet = "0x" + "a".repeat(40);
    const result = await register("new@b.io", "pass1234", wallet);
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "new@b.io",
        password: "pass1234",
        wallet_address: wallet,
      }),
    });
    expect(result).toEqual(fakeUser);
  });

  it("register without wallet omits wallet_address", async () => {
    const fakeUser = { id: 3, email: "nw@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    await register("nw@b.io", "pass1234");
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: "nw@b.io", password: "pass1234" }),
    });
  });

  it("me calls GET /api/auth/me and returns user", async () => {
    const fakeUser = { id: 1, email: "a@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    const result = await me();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/me");
    expect(result).toEqual(fakeUser);
  });

  it("me returns null on 401", async () => {
    const err = new Error("Unauthorized") as Error & { status: number };
    err.status = 401;
    mockedApiFetch.mockRejectedValueOnce(err);
    const result = await me();
    expect(result).toBeNull();
  });

  it("me re-throws non-401 errors", async () => {
    const err = new Error("Server error") as Error & { status: number };
    err.status = 500;
    mockedApiFetch.mockRejectedValueOnce(err);
    await expect(me()).rejects.toThrow("Server error");
  });

  it("logout calls POST /api/auth/logout", async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: true });
    await logout();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});
