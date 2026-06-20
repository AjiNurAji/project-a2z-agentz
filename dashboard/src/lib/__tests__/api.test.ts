import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "../api";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("apiFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends credentials: include", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    await apiFetch("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("throws on non-ok response with status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    await expect(apiFetch("/protected")).rejects.toThrow("Unauthorized");
  });

  it("parses JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { email: "a@b.io" } }),
    });
    const data = await apiFetch("/me");
    expect(data).toEqual({ user: { email: "a@b.io" } });
  });

  it("sets Content-Type to application/json", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await apiFetch("/test", { method: "POST", body: '{"a":1}' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });
});
