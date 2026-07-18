"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { http, type Chain } from "viem";

/**
 * WalletConnect projectId is NOT inlined by Vercel (NEXT_PUBLIC_ Sensitive
 * quirk). We fetch it from the public backend /api/config endpoint at runtime
 * so WalletConnect can bootstrap even when the build env is empty.
 */
let _wcProjectId: string | null = null;
const FALLBACK_PROJECT_ID = "970e9bd81ce1de4876fc0781b8dce583";

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
    _wcProjectId = (data.wc_project_id || FALLBACK_PROJECT_ID).trim();
  } catch {
    _wcProjectId = FALLBACK_PROJECT_ID;
  }
  return _wcProjectId;
}

export function buildWagmiConfig(projectId: string) {
  // getDefaultConfig keeps the RainbowKit UI intact (proper modal, wallet list).
  // We pin an explicit http() transport for `base` so wagmi never derives an
  // undefined RPC URL (which made signMessageAsync call fetch(undefined) →
  // "Failed to execute 'fetch' on 'Window': Invalid value").
  // Pass a guaranteed-non-empty projectId (FALLBACK hard-coded) so WalletConnect
  // relay URLs are always well-formed.
  const pid = projectId && projectId !== "undefined" ? projectId : FALLBACK_PROJECT_ID;
  return getDefaultConfig({
    appName: "A2Z Agentz",
    projectId: pid,
    chains: [base as Chain],
    ssr: true,
    transports: {
      [base.id]: http("https://mainnet.base.org"),
    },
  });
}
