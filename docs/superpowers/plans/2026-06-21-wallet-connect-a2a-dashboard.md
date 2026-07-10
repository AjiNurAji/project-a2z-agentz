# Wallet Connect Hybrid Auth + A2A Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Modal Wallet Selector wallet connect on login/register, frontend-only wallet dashboard access with SIWE warning, and an A2A Identity & Backend Readiness dashboard section.

**Architecture:** Keep wallet provider detection/session logic in `dashboard/src/lib/wallet.ts`, React wallet state in `dashboard/src/hooks/useWalletConnect.ts`, modal UI in `dashboard/src/components/WalletConnectModal.tsx`, and dashboard readiness UI in `dashboard/src/components/A2AIdentityReadiness.tsx`. Login/register integrate the modal without changing email/password backend auth. Middleware allows dashboard access when either JWT cookie or a non-sensitive wallet-session cookie exists.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library, Tailwind/CSS variables, EIP-1193 browser providers.

## Implementation Status — 2026-06-21

Status: **Completed**

Implemented additions beyond the original plan:

- Hydration mismatch mitigation with `ClientOnly` for extension-injected attributes such as `bis_skin_checked`.
- Wallet connect modal styled as glassmorphism with subtle transparent border; removed harsh black side borders.
- Demo/static fallback: when no EIP-1193 wallet provider is installed, clicking a wallet option creates a frontend-only mock wallet session so the hackathon demo can continue.
- `Continue to dashboard` appears after real or demo wallet session creation.
- Middleware accepts `a2z-wallet-session=1` only as frontend demo access; production backend auth still requires JWT/SIWE.
- Dashboard now shows A2A Identity Handshake Status for wallet session, backend auth, and WebSocket readiness.

Verification:

- `npm run test:e2e` — **205 tests passed**
- `npm run build` — TypeScript/Next.js build completed successfully

---

## File Map

- Create `dashboard/src/lib/wallet.ts`: EIP-1193 types, wallet detection, session storage/cookie helpers, address formatting.
- Create `dashboard/src/lib/__tests__/wallet.test.ts`: unit coverage for detection/session helpers.
- Create `dashboard/src/hooks/useWalletConnect.ts`: client hook for modal/provider connect state.
- Create `dashboard/src/components/WalletConnectModal.tsx`: accessible modal selector and warning/continue UI.
- Create `dashboard/src/components/A2AIdentityReadiness.tsx`: dashboard section showing wallet/backend/A2A status.
- Create `dashboard/src/components/__tests__/WalletConnectModal.test.tsx`: modal component tests.
- Create `dashboard/src/components/__tests__/A2AIdentityReadiness.test.tsx`: dashboard section tests.
- Modify `dashboard/src/app/(auth)/login/page.tsx`: replace placeholder wallet button with modal integration.
- Modify `dashboard/src/app/(auth)/register/page.tsx`: modal integration and auto-fill linked wallet address.
- Modify `dashboard/src/app/(dashboard)/dashboard/page.tsx`: add readiness section after KPIs.
- Modify `dashboard/src/middleware.ts`: allow protected routes with `a2z-wallet-session=1` cookie, still prefer JWT.

---

### Task 1: Wallet Library

**Files:**
- Create: `dashboard/src/lib/wallet.ts`
- Test: `dashboard/src/lib/__tests__/wallet.test.ts`

- [ ] **Step 1: Write failing tests**

Create `dashboard/src/lib/__tests__/wallet.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run from `dashboard/`:

```bash
npm run test:e2e -- src/lib/__tests__/wallet.test.ts
```

Expected: FAIL because `../wallet` does not exist.

- [ ] **Step 3: Implement wallet library**

Create `dashboard/src/lib/wallet.ts`:

```ts
export const WALLET_SESSION_KEY = "a2z-wallet-session";
export const WALLET_SESSION_COOKIE = "a2z-wallet-session";

export type WalletId = "metamask" | "coinbase" | "rabby" | "injected";
export type WalletStatus = "detected" | "available" | "install_required" | "open_wallet_browser";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface WalletOption {
  id: WalletId;
  name: string;
  description: string;
  status: WalletStatus;
  provider?: Eip1193Provider;
}

export interface WalletSession {
  address: string;
  walletName: string;
  chainId?: string;
  connectedAt: string;
  frontendOnly: true;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isMobileUserAgent() {
  if (!isBrowser()) return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

function allInjectedProviders(): Eip1193Provider[] {
  if (!isBrowser() || !window.ethereum) return [];
  const root = window.ethereum;
  return Array.isArray(root.providers) && root.providers.length > 0 ? root.providers : [root];
}

function fallbackStatus(): WalletStatus {
  return isMobileUserAgent() ? "open_wallet_browser" : "install_required";
}

export function detectWalletProviders(): WalletOption[] {
  const providers = allInjectedProviders();
  const findProvider = (predicate: (provider: Eip1193Provider) => boolean) => providers.find(predicate);

  const metamask = findProvider((provider) => provider.isMetaMask === true && provider.isRabby !== true);
  const coinbase = findProvider((provider) => provider.isCoinbaseWallet === true);
  const rabby = findProvider((provider) => provider.isRabby === true);
  const generic = providers.find((provider) => provider !== metamask && provider !== coinbase && provider !== rabby) ?? providers[0];
  const noProviderStatus = fallbackStatus();

  return [
    {
      id: "metamask",
      name: "MetaMask",
      description: "Browser extension or MetaMask mobile browser",
      status: metamask ? "detected" : noProviderStatus,
      provider: metamask,
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      description: "Coinbase Wallet extension or mobile browser",
      status: coinbase ? "detected" : noProviderStatus,
      provider: coinbase,
    },
    {
      id: "rabby",
      name: "Rabby",
      description: "Rabby browser wallet for EVM chains",
      status: rabby ? "detected" : noProviderStatus,
      provider: rabby,
    },
    {
      id: "injected",
      name: "Browser Wallet",
      description: "Generic injected EVM provider",
      status: generic ? "detected" : noProviderStatus,
      provider: generic,
    },
  ];
}

export function formatAddress(address: string) {
  if (!address) return "Not connected";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function saveWalletSession(session: WalletSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
  document.cookie = `${WALLET_SESSION_COOKIE}=1; path=/; SameSite=Lax; Max-Age=2592000`;
}

export function getWalletSession(): WalletSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(WALLET_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WalletSession;
    if (!parsed.address || !parsed.walletName || parsed.frontendOnly !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWalletSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(WALLET_SESSION_KEY);
  document.cookie = `${WALLET_SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run from `dashboard/`:

```bash
npm run test:e2e -- src/lib/__tests__/wallet.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallet.ts src/lib/__tests__/wallet.test.ts
git commit -m "feat(frontend): add wallet provider detection"
```

---

### Task 2: Wallet Connect Hook and Modal

**Files:**
- Create: `dashboard/src/hooks/useWalletConnect.ts`
- Create: `dashboard/src/components/WalletConnectModal.tsx`
- Test: `dashboard/src/components/__tests__/WalletConnectModal.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `dashboard/src/components/__tests__/WalletConnectModal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import WalletConnectModal from "../WalletConnectModal";

function setEthereum(provider: unknown) {
  Object.defineProperty(window, "ethereum", {
    value: provider,
    configurable: true,
    writable: true,
  });
}

describe("WalletConnectModal", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "a2z-wallet-session=; Max-Age=0; path=/";
    setEthereum(undefined);
  });

  it("does not render when closed", () => {
    render(<WalletConnectModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders wallet options when open", () => {
    render(<WalletConnectModal open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("MetaMask")).toBeTruthy();
    expect(screen.getByText("Coinbase Wallet")).toBeTruthy();
    expect(screen.getByText("Rabby")).toBeTruthy();
    expect(screen.getByText("Browser Wallet")).toBeTruthy();
  });

  it("connects detected wallet and shows SIWE warning", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return ["0x1234567890abcdef1234567890abcdef12345678"];
      if (method === "eth_chainId") return "0x2105";
      return null;
    });
    setEthereum({ isMetaMask: true, request });
    const onConnected = vi.fn();

    render(<WalletConnectModal open onClose={vi.fn()} onConnected={onConnected} />);
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));

    await waitFor(() => {
      expect(screen.getByText(/Wallet login is frontend-only/i)).toBeTruthy();
    });
    expect(screen.getByText(/0x1234...5678/i)).toBeTruthy();
    expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ address: "0x1234567890abcdef1234567890abcdef12345678" }));
  });

  it("shows rejected connection error", async () => {
    const request = vi.fn(async () => {
      throw new Error("User rejected");
    });
    setEthereum({ isMetaMask: true, request });

    render(<WalletConnectModal open onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));

    await waitFor(() => {
      expect(screen.getByText(/Connection rejected/i)).toBeTruthy();
    });
  });

  it("calls onContinue when continue button is clicked", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return ["0x1234567890abcdef1234567890abcdef12345678"];
      if (method === "eth_chainId") return "0x2105";
      return null;
    });
    setEthereum({ isMetaMask: true, request });
    const onContinue = vi.fn();

    render(<WalletConnectModal open onClose={vi.fn()} onContinue={onContinue} />);
    await userEvent.click(screen.getByRole("button", { name: /connect metamask/i }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to dashboard/i }));

    expect(onContinue).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- src/components/__tests__/WalletConnectModal.test.tsx
```

Expected: FAIL because component/hook do not exist.

- [ ] **Step 3: Implement hook**

Create `dashboard/src/hooks/useWalletConnect.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  detectWalletProviders,
  formatAddress,
  getWalletSession,
  saveWalletSession,
  type WalletOption,
  type WalletSession,
} from "@/lib/wallet";

export type WalletConnectState = "idle" | "connecting" | "connected" | "error";

export function useWalletConnect() {
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [session, setSession] = useState<WalletSession | null>(null);
  const [state, setState] = useState<WalletConnectState>("idle");
  const [error, setError] = useState<string | null>(null);

  const refreshWallets = useCallback(() => {
    setWallets(detectWalletProviders());
  }, []);

  useEffect(() => {
    refreshWallets();
    setSession(getWalletSession());
  }, [refreshWallets]);

  const connect = useCallback(async (wallet: WalletOption) => {
    if (!wallet.provider) {
      setError(wallet.status === "open_wallet_browser" ? "Open this page in a wallet browser to connect." : "Install or enable this wallet extension, then try again.");
      setState("error");
      return null;
    }

    setState("connecting");
    setError(null);

    try {
      const accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
      const address = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
      if (!address) throw new Error("No wallet account returned");

      let chainId: string | undefined;
      try {
        const chain = await wallet.provider.request({ method: "eth_chainId" });
        if (typeof chain === "string") chainId = chain;
      } catch {
        chainId = undefined;
      }

      const nextSession: WalletSession = {
        address,
        walletName: wallet.name,
        chainId,
        connectedAt: new Date().toISOString(),
        frontendOnly: true,
      };
      saveWalletSession(nextSession);
      setSession(nextSession);
      setState("connected");
      return nextSession;
    } catch {
      setError("Connection rejected. Please approve the request in your wallet.");
      setState("error");
      return null;
    }
  }, []);

  return {
    wallets,
    session,
    state,
    error,
    connect,
    refreshWallets,
    formattedAddress: formatAddress(session?.address ?? ""),
  };
}
```

- [ ] **Step 4: Implement modal**

Create `dashboard/src/components/WalletConnectModal.tsx`:

```tsx
"use client";

import React, { useEffect } from "react";
import { Wallet, X, Loader2, ShieldAlert } from "lucide-react";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import type { WalletSession, WalletStatus } from "@/lib/wallet";

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (session: WalletSession) => void;
  onContinue?: () => void;
}

function statusLabel(status: WalletStatus) {
  if (status === "detected") return "Detected";
  if (status === "available") return "Available";
  if (status === "open_wallet_browser") return "Open in wallet browser";
  return "Install required";
}

function statusClass(status: WalletStatus) {
  if (status === "detected") return "text-[var(--color-fg-success)] bg-[var(--color-bg-success-subtle)] border-[var(--color-border-success)]";
  if (status === "open_wallet_browser") return "text-[var(--color-fg-info)] bg-[var(--color-bg-info-subtle)] border-[var(--color-border-info)]";
  return "text-[var(--color-fg-warning)] bg-[var(--color-bg-warning-subtle)] border-[var(--color-border-warning)]";
}

export default function WalletConnectModal({ open, onClose, onConnected, onContinue }: WalletConnectModalProps) {
  const wallet = useWalletConnect();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-connect-title"
        className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{ background: "var(--color-surface)", borderColor: "var(--color-border-default)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))" }}>
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="wallet-connect-title" className="text-lg font-bold" style={{ color: "var(--color-heading)" }}>Connect Wallet</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--color-body-subtle)" }}>Choose an active EVM wallet for Base Network.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close wallet connect modal" className="rounded-lg border p-2 focus-ring" style={{ borderColor: "var(--color-border-default)", color: "var(--color-body)" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {wallet.wallets.map((option) => (
            <button
              key={option.id}
              onClick={async () => {
                const session = await wallet.connect(option);
                if (session) onConnected?.(session);
              }}
              disabled={wallet.state === "connecting"}
              aria-label={`Connect ${option.name}`}
              className="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:opacity-85 disabled:opacity-60 focus-ring"
              style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}
            >
              <span>
                <span className="block text-sm font-semibold" style={{ color: "var(--color-heading)" }}>{option.name}</span>
                <span className="block text-xs" style={{ color: "var(--color-body-subtle)" }}>{option.description}</span>
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(option.status)}`}>{statusLabel(option.status)}</span>
            </button>
          ))}
        </div>

        {wallet.state === "connecting" && (
          <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: "var(--color-body-subtle)" }}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Waiting for wallet approval...
          </p>
        )}

        {wallet.error && (
          <p role="alert" className="mt-3 rounded-xl border p-3 text-sm" style={{ color: "var(--color-fg-danger)", borderColor: "var(--color-border-danger)", background: "var(--color-bg-danger-subtle)" }}>
            {wallet.error}
          </p>
        )}

        <div className="mt-4 rounded-xl border p-3 text-xs" style={{ color: "var(--color-fg-info)", borderColor: "var(--color-border-info)", background: "var(--color-bg-info-subtle)" }}>
          Wallet login currently creates a frontend-only session until backend SIWE is implemented.
        </div>

        {wallet.session && (
          <div className="mt-4 rounded-xl border p-4" style={{ color: "var(--color-fg-warning)", borderColor: "var(--color-border-warning)", background: "var(--color-bg-warning-subtle)" }}>
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Wallet login is frontend-only</h3>
                <p className="mt-1 text-xs leading-relaxed">
                  Connected as <span className="font-mono">{wallet.formattedAddress}</span>. Backend SIWE is not ready yet, so protected backend auth still requires email/password.
                </p>
              </div>
            </div>
            <button onClick={onContinue} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold focus-ring" style={{ background: "var(--color-fg-warning)", color: "var(--color-neutral-primary)" }}>
              Continue to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run modal tests**

```bash
npm run test:e2e -- src/components/__tests__/WalletConnectModal.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useWalletConnect.ts src/components/WalletConnectModal.tsx src/components/__tests__/WalletConnectModal.test.tsx
git commit -m "feat(frontend): add wallet connect modal"
```

---

### Task 3: Login/Register Integration and Middleware Wallet Session Access

**Files:**
- Modify: `dashboard/src/app/(auth)/login/page.tsx`
- Modify: `dashboard/src/app/(auth)/register/page.tsx`
- Modify: `dashboard/src/middleware.ts`
- Test: existing/auth smoke via lint/build plus middleware tests if present

- [ ] **Step 1: Update middleware**

Modify `dashboard/src/middleware.ts` so it checks wallet session cookie:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "a2z-token";
const WALLET_SESSION_COOKIE = "a2z-wallet-session";

const PUBLIC_PATHS = ["/", "/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const walletSession = request.cookies.get(WALLET_SESSION_COOKIE)?.value;
  const hasFrontendWalletSession = walletSession === "1";

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".");

  if (isStaticAsset) return NextResponse.next();

  if (!token && !hasFrontendWalletSession && !isPublic && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if ((token || hasFrontendWalletSession) && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Integrate login modal**

Modify `dashboard/src/app/(auth)/login/page.tsx`:

- Import `useRouter`, `Wallet`, and `WalletConnectModal`.
- Add state `walletModalOpen`.
- Replace placeholder wallet button with modal-opening button.
- Continue handler pushes `/dashboard`.

Patch shape:

```tsx
import { useRouter } from "next/navigation";
import { Mail, Lock, LogIn, Loader2, Wallet } from "lucide-react";
import WalletConnectModal from "@/components/WalletConnectModal";

const router = useRouter();
const [walletModalOpen, setWalletModalOpen] = useState(false);

<button type="button" onClick={() => setWalletModalOpen(true)} ...>
  <Wallet className="w-4 h-4" aria-hidden="true" />
  Connect Wallet
</button>

<WalletConnectModal
  open={walletModalOpen}
  onClose={() => setWalletModalOpen(false)}
  onContinue={() => router.push("/dashboard")}
/>
```

- [ ] **Step 3: Integrate register modal**

Modify `dashboard/src/app/(auth)/register/page.tsx`:

- Import `useRouter` if needed only for continue; register wallet connect can also push dashboard after warning.
- Import `WalletConnectModal`.
- Add `walletModalOpen` state.
- On connected session, set `walletAddress` to session address.
- Add button near wallet address input: `Connect Wallet`.
- Render modal with `onConnected={(session) => setWalletAddress(session.address)}` and `onContinue={() => router.push("/dashboard")}`.

- [ ] **Step 4: Run lint/build smoke**

```bash
npm run lint
npm run build
```

Expected: both PASS or document unrelated failures.

- [ ] **Step 5: Commit**

```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/register/page.tsx src/middleware.ts
git commit -m "feat(frontend): integrate wallet modal into auth pages"
```

---

### Task 4: Dashboard A2A Identity Readiness Section

**Files:**
- Create: `dashboard/src/components/A2AIdentityReadiness.tsx`
- Create: `dashboard/src/components/__tests__/A2AIdentityReadiness.test.tsx`
- Modify: `dashboard/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Write failing dashboard section tests**

Create `dashboard/src/components/__tests__/A2AIdentityReadiness.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import A2AIdentityReadiness from "../A2AIdentityReadiness";
import { WALLET_SESSION_KEY, type WalletSession } from "@/lib/wallet";

function saveSession(session: WalletSession) {
  localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
}

describe("A2AIdentityReadiness", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows not connected when no wallet session exists", () => {
    render(<A2AIdentityReadiness wsStatus="disconnected" user={null} />);
    expect(screen.getByText("Identity Handshake Status")).toBeTruthy();
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByText("Fallback / Demo Mode")).toBeTruthy();
  });

  it("shows connected wallet and frontend auth state", () => {
    saveSession({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      walletName: "MetaMask",
      chainId: "0x2105",
      connectedAt: "2026-06-21T00:00:00.000Z",
      frontendOnly: true,
    });

    render(<A2AIdentityReadiness wsStatus="connected" user={null} />);
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("MetaMask · 0x1234...5678")).toBeTruthy();
    expect(screen.getByText("Frontend wallet session")).toBeTruthy();
  });

  it("shows JWT authenticated when user exists", () => {
    render(<A2AIdentityReadiness wsStatus="connecting" user={{ id: 1, email: "u@b.io" }} />);
    expect(screen.getByText("JWT Authenticated")).toBeTruthy();
    expect(screen.getByText("Connecting")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
npm run test:e2e -- src/components/__tests__/A2AIdentityReadiness.test.tsx
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement dashboard component**

Create `dashboard/src/components/A2AIdentityReadiness.tsx`:

```tsx
"use client";

import React, { useEffect, useState } from "react";
import { Link2, ShieldCheck, Radio } from "lucide-react";
import { formatAddress, getWalletSession, type WalletSession } from "@/lib/wallet";
import type { User } from "@/lib/auth";

interface Props {
  wsStatus: "connecting" | "connected" | "disconnected";
  user: User | null;
}

function wsLabel(status: Props["wsStatus"]) {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting";
  return "Fallback / Demo Mode";
}

export default function A2AIdentityReadiness({ wsStatus, user }: Props) {
  const [session, setSession] = useState<WalletSession | null>(null);

  useEffect(() => {
    setSession(getWalletSession());
  }, []);

  const walletConnected = Boolean(session?.address);
  const backendAuthTitle = user ? "JWT Authenticated" : walletConnected ? "Frontend wallet session" : "Auth unknown";
  const backendAuthDescription = user ? "Email/password backend session active" : walletConnected ? "SIWE endpoint needed" : "Backend unavailable or not signed in";

  return (
    <section className="rounded-2xl border p-5" style={{ background: "color-mix(in srgb, var(--color-surface) 84%, transparent)", borderColor: "var(--color-border-default)" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--color-fg-purple)" }}>Agent-to-Agent Backend</p>
          <h2 className="mt-1 text-xl font-bold" style={{ color: "var(--color-heading)" }}>Identity Handshake Status</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-body-subtle)" }}>Tracks wallet session, backend auth readiness, and A2A WebSocket state.</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ color: "var(--color-fg-warning)", borderColor: "var(--color-border-warning)", background: "var(--color-bg-warning-subtle)" }}>SIWE Pending</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}>
          <Link2 className="h-4 w-4" style={{ color: "var(--color-fg-success)" }} aria-hidden="true" />
          <p className="mt-3 text-xs" style={{ color: "var(--color-body-subtle)" }}>Wallet Session</p>
          <h3 className="mt-2 font-semibold" style={{ color: walletConnected ? "var(--color-fg-success)" : "var(--color-body)" }}>{walletConnected ? "Connected" : "Not connected"}</h3>
          <p className="mt-1 text-xs font-mono" style={{ color: "var(--color-body-subtle)" }}>{walletConnected ? `${session?.walletName} · ${formatAddress(session?.address ?? "")}` : "Use Connect Wallet from login/register"}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}>
          <ShieldCheck className="h-4 w-4" style={{ color: user ? "var(--color-fg-success)" : "var(--color-fg-warning)" }} aria-hidden="true" />
          <p className="mt-3 text-xs" style={{ color: "var(--color-body-subtle)" }}>Backend Auth</p>
          <h3 className="mt-2 font-semibold" style={{ color: user ? "var(--color-fg-success)" : "var(--color-fg-warning)" }}>{backendAuthTitle}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-body-subtle)" }}>{backendAuthDescription}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}>
          <Radio className="h-4 w-4" style={{ color: "var(--color-fg-cyan)" }} aria-hidden="true" />
          <p className="mt-3 text-xs" style={{ color: "var(--color-body-subtle)" }}>A2A WebSocket</p>
          <h3 className="mt-2 font-semibold" style={{ color: "var(--color-fg-cyan)" }}>{wsLabel(wsStatus)}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-body-subtle)" }}>Agent A ↔ Agent B sync</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border p-3 text-xs leading-relaxed" style={{ color: "var(--color-fg-warning)", borderColor: "var(--color-border-warning)", background: "var(--color-bg-warning-subtle)" }}>
        Wallet connect is ready on the frontend. Backend sign-in-with-wallet is pending. Next backend milestone: add SIWE challenge/verify endpoint and issue the same auth cookie used by email login.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Add section to dashboard page**

Modify `dashboard/src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import A2AIdentityReadiness from "@/components/A2AIdentityReadiness";
import { useDashboard } from "@/components/DashboardContext";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const { wsStatus } = useDashboard();
  const { user } = useAuth();
  return (...);
}
```

Insert after `DashboardKpis` motion block:

```tsx
<motion.div variants={itemVariants}>
  <A2AIdentityReadiness wsStatus={wsStatus} user={user} />
</motion.div>
```

- [ ] **Step 5: Run tests**

```bash
npm run test:e2e -- src/components/__tests__/A2AIdentityReadiness.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/A2AIdentityReadiness.tsx src/components/__tests__/A2AIdentityReadiness.test.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(frontend): add A2A identity readiness section"
```

---

### Task 5: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run wallet tests**

```bash
npm run test:e2e -- src/lib/__tests__/wallet.test.ts src/components/__tests__/WalletConnectModal.test.tsx src/components/__tests__/A2AIdentityReadiness.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

```bash
npm run test:e2e
```

Expected: PASS or document exact unrelated failures.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Final commit if verification fixes were needed**

```bash
git status --short
git add <changed-files>
git commit -m "fix(frontend): stabilize wallet connect verification"
```

Only commit if files changed after previous task commits.

---

## Self-Review

Spec coverage:

- Modal Wallet Selector: Task 2 and Task 3.
- Multi-wallet EVM detection: Task 1.
- Frontend-only wallet session: Task 1 and Task 2.
- Warning before continue: Task 2.
- Login/register integration: Task 3.
- Register wallet address auto-fill: Task 3.
- Dashboard section: Task 4.
- A2A WebSocket state: Task 4 uses `wsStatus`.
- Middleware wallet-only dashboard access: Task 3.
- Tests/lint/build: Task 5.

No placeholders remain. Function/type names are consistent across tasks.
