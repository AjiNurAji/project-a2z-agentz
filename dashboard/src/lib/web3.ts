"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { http, type Chain } from "viem";

/**
 * WalletConnect projectId is NOT inlined by Vercel (NEXT_PUBLIC_ Sensitive
 * quirk). We fetch it from the public backend /api/config endpoint at runtime
 * so WalletConnect can bootstrap even when the build env is empty.
 */
let _resolved = false;
let _pid = "";

export async function getWalletConnectProjectId(): Promise<string> {
  if (_resolved) return _pid;
  const buildTime = (process.env.NEXT_PUBLIC_WC_PROJECT_ID || "").trim();
  if (buildTime) {
    _pid = buildTime;
    _resolved = true;
    return _pid;
  }
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    _pid = (data.wc_project_id || FALLBACK_PROJECT_ID).trim();
  } catch {
    _pid = FALLBACK_PROJECT_ID;
  }
  _resolved = true;
  return _pid;
}

export function buildWagmiConfig(projectId: string) {
  const pid = projectId && projectId !== "undefined" ? projectId : FALLBACK_PROJECT_ID;
  return getDefaultConfig({
    appName: "A2Z Agentz",
    projectId: pid,
    chains: [base as Chain],
    ssr: true,
    // Pin an explicit Base RPC transport. Without this, getDefaultConfig
    // derives a public RPC that can resolve to `undefined` on mobile
    // WalletConnect webviews, making wagmi internally call fetch(undefined)
    // -> "Failed to execute 'fetch' on 'Window': Invalid value".
    transports: {
      [base.id]: http("https://mainnet.base.org"),
    },
  });
}
