"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";
import { type Chain } from "viem";

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

// Reown/RainbowKit requires a non-empty projectId at config-build time.
// We use a placeholder synchronously and patch it post-mount via the
// RainbowKitProvider (see components/WalletModal.tsx) once we resolve it.
export const FALLBACK_PROJECT_ID = "demo-project-id";

export function buildWagmiConfig(projectId: string) {
  return getDefaultConfig({
    appName: "A2Z Agentz",
    projectId: projectId || FALLBACK_PROJECT_ID,
    chains: [base as Chain],
    ssr: true,
  });
}
