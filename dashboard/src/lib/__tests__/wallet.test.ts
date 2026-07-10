import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectWalletProviders,
  formatAddress,
  getWalletSession,
  saveWalletSession,
  clearWalletSession,
  WALLET_SESSION_COOKIE,
  WALLET_SESSION_KEY,
  type Eip1193Provider,
} from "../wallet";

function setWindowEthereum(provider: Eip1193Provider | undefined) {
  Object.defineProperty(window, "ethereum", {
    value: provider,
    configurable: true,
    writable: true,
  });
}

describe("wallet lib", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${WALLET_SESSION_COOKIE}=; Max-Age=0; path=/`;
    setWindowEthereum(undefined);
    vi.restoreAllMocks();
  });

  it("formats EVM addresses", () => {
    expect(formatAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678");
    expect(formatAddress("")).toBe("Not connected");
  });

  it("returns install hints when no provider exists", () => {
    const wallets = detectWalletProviders();
    expect(wallets.map((w) => w.id)).toEqual(["metamask", "coinbase", "rabby", "injected"]);
    expect(wallets.every((w) => w.status === "install_required" || w.status === "open_wallet_browser")).toBe(true);
  });

  it("detects multiple injected providers", () => {
    const metamask = { isMetaMask: true, request: vi.fn() };
    const coinbase = { isCoinbaseWallet: true, request: vi.fn() };
    const rabby = { isRabby: true, request: vi.fn() };
    setWindowEthereum({ providers: [metamask, coinbase, rabby], request: vi.fn() });

    const wallets = detectWalletProviders();
    expect(wallets.find((w) => w.id === "metamask")?.status).toBe("detected");
    expect(wallets.find((w) => w.id === "coinbase")?.status).toBe("detected");
    expect(wallets.find((w) => w.id === "rabby")?.status).toBe("detected");
  });

  it("detects generic injected wallet", () => {
    const provider = { request: vi.fn() };
    setWindowEthereum(provider);
    const wallets = detectWalletProviders();
    const injected = wallets.find((w) => w.id === "injected");
    expect(injected?.status).toBe("detected");
    expect(injected?.provider).toBe(provider);
  });

  it("saves, reads, and clears wallet session", () => {
    saveWalletSession({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletName: "MetaMask",
      chainId: "0x2105",
      connectedAt: "2026-06-21T00:00:00.000Z",
      frontendOnly: true,
    });

    expect(localStorage.getItem(WALLET_SESSION_KEY)).toContain("MetaMask");
    expect(document.cookie).toContain(`${WALLET_SESSION_COOKIE}=1`);
    expect(getWalletSession()?.address).toBe("0x1234567890abcdef1234567890abcdef12345678");

    clearWalletSession();
    expect(getWalletSession()).toBeNull();
  });

  it("returns null for invalid stored session JSON", () => {
    localStorage.setItem(WALLET_SESSION_KEY, "not-json");
    expect(getWalletSession()).toBeNull();
  });
});
