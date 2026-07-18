"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { http, type Chain } from "viem";

/**
 * WalletConnect projectId is NOT inlined by Vercel (NEXT_PUBLIC_ Sensitive
 * quirk). We fetch it from the public backend /api/config endpoint at runtime
 * so RainbowKit can bootstrap WalletConnect even when the build env is empty.
 *
 * Falls back to the build-time var if present, then to the backend, then to
 * an empty string (RainbowKit will show a clear "projectId missing" state).
 */
let _wcProjectId: string | null = null;

export async function getWalletConnectProjectId(): Promise<string> {
  if (_wcProjectId !== null) return _wcProjectId;
  const buildTime = (process.env.NEXT_PUBLIC_WC_PROJECT_ID || "").trim();
  if (buildTime) {
    _wcProjectId = buildTime;
    return _wcProjectId;
  }
  try {
    const { apiFetch } = await import("./api");
    const data = await apiFetch<{ wc_project_id?: string }>("/api/config", {
      headers: { Accept: "application/json" },
    });
    _wcProjectId = (data.wc_project_id || "").trim();
  } catch {
    _wcProjectId = "";
  }
  return _wcProjectId;
}

export function buildWagmiConfig(projectId: string) {
  return getDefaultConfig({
    appName: "A2Z Agentz",
    projectId,
    chains: [base as Chain],
    ssr: true,
    // CRITICAL: provide an explicit RPC transport for `base`. Without this,
    // wagmi/viem generate a transport from the chain definition, and on some
    // setups (esp. WalletConnect mobile webviews) that resolves to `undefined`,
    // causing signMessageAsync to internally call fetch(undefined) →
    // "Failed to execute 'fetch' on 'Window': Invalid value". Pinning a known
    // public Base RPC guarantees a valid transport for signing.
    transports: {
      [base.id]: http("https://mainnet.base.org"),
    },
  });
}
