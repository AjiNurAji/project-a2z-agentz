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
    const res = await fetch("/api/config");
    const data = await res.json();
    _wcProjectId = (data.wc_project_id || FALLBACK_PROJECT_ID).trim();
  } catch {
    _wcProjectId = FALLBACK_PROJECT_ID;
  }
  return _wcProjectId;
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
