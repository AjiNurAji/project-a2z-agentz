"use client";

import { EthereumProvider } from "@walletconnect/ethereum-provider";

/**
 * WalletConnect v2 bridge for A2Z Agentz.
 *
 * We deliberately REUSE the existing SIWE backend flow:
 *   1. request accounts from the WC provider (mobile wallet scans QR)
 *   2. POST /api/auth/siwe/nonce {address}  -> EIP-4361 message
 *   3. personal_sign with the WC provider
 *   4. POST /api/auth/siwe/verify {message, signature} -> {token, user}
 *
 * This keeps a single auth path (SIWE) for both MetaMask (injected) and
 * WalletConnect (QR / mobile), so the database upsert logic is shared.
 */

let _provider: InstanceType<typeof EthereumProvider> | null = null;

export function getWalletConnectProjectId(): string {
  return (process.env.NEXT_PUBLIC_WC_PROJECT_ID || "").trim();
}

export async function initWalletConnect(): Promise<InstanceType<typeof EthereumProvider>> {
  if (_provider) return _provider;
  const projectId = getWalletConnectProjectId();
  if (!projectId) {
    throw new Error(
      "WalletConnect projectId missing. Set NEXT_PUBLIC_WC_PROJECT_ID in your deploy env."
    );
  }
  _provider = await EthereumProvider.init({
    projectId,
    chains: [8453], // Base mainnet
    optionalChains: [8453],
    rpcMap: {
      8453:
        (process.env.NEXT_PUBLIC_BASE_RPC ||
          "https://mainnet.base.org") as string,
    },
    showQrModal: true, // built-in QR modal
    methods: ["eth_requestAccounts", "personal_sign", "eth_chainId"],
  });
  return _provider;
}

/**
 * Full SIWE login via WalletConnect.
 * Returns the same shape as auth.ts `siweLogin` so callers can treat both
 * injected and WC wallets identically.
 */
export async function walletConnectSiweLogin(): Promise<{
  address: string;
  message: string;
  signature: string;
}> {
  const provider = await initWalletConnect();
  await provider.enable();
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No account connected via WalletConnect.");
  }
  const address = accounts[0];

  // Reuse the API helper so URL building is consistent with apiFetch.
  const { siweFetchNonce } = await import("./auth");
  const { message } = await siweFetchNonce(address);

  const signature = (await provider.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
  if (!signature) throw new Error("Signature was rejected.");

  return { address, message, signature };
}

export async function disconnectWalletConnect(): Promise<void> {
  if (_provider) {
    try {
      await _provider.disconnect();
    } catch {
      /* ignore */
    }
    _provider = null;
  }
}
