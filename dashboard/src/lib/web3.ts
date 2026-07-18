"use client";

import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { walletConnect, injected, coinbaseWallet } from "wagmi/connectors";
import { type Chain } from "viem";

/**
 * WalletConnect projectId is NOT inlined by Vercel (NEXT_PUBLIC_ Sensitive
 * quirk). We fetch it from the public backend /api/config endpoint at runtime
 * so WalletConnect can bootstrap even when the build env is empty.
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

const BASE_RPC = "https://mainnet.base.org";

export function buildWagmiConfig(projectId: string) {
  // Use wagmi's createConfig directly (not RainbowKit getDefaultConfig) so we
  // CONTROL the transports. getDefaultConfig auto-derives an RPC transport from
  // the chain definition, and on mobile webviews that resolves to `undefined`,
  // making signMessageAsync internally call fetch(undefined) →
  // "Failed to execute 'fetch' on 'Window': Invalid value".
  // Pinning an explicit http() transport guarantees a valid URL for signing.
  return createConfig({
    chains: [base as Chain],
    connectors: [
      injected(),
      coinbaseWallet({ appName: "A2Z Agentz", preference: "all" }),
      walletConnect({
        projectId,
        showQrModal: true,
        metadata: {
          name: "A2Z Agentz",
          description: "Autonomous DeFi Trading Agent",
          url: "https://www.archbusins.web.id",
          icons: ["https://www.archbusins.web.id/images/logo/logo.svg"],
        },
      }),
    ],
    transports: {
      [base.id]: http(BASE_RPC),
    },
    ssr: true,
  });
}
