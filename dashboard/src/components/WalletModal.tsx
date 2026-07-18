"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RainbowKitProvider, ConnectButton, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useSignMessage, useConnect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { buildWagmiConfig, getWalletConnectProjectId } from "@/lib/web3";
import { siweLoginWithWagmi, type SiweVerifyResult } from "@/lib/siwe-wagmi";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onSiweSuccess?: (res: SiweVerifyResult) => void;
  onSiweError?: (msg: string) => void;
}

function WalletFlow({
  onSiweSuccess,
  onSiweError,
  onClose,
}: {
  onSiweSuccess?: (res: SiweVerifyResult) => void;
  onSiweError?: (msg: string) => void;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { isPending } = useConnect();
  const [signing, setSigning] = useState(false);
  const [showSignButton, setShowSignButton] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual-only flow: NO auto-sign. As soon as a wallet connects we show the
  // explicit "Sign Message to Verify" button. The user taps it themselves —
  // no timer, no auto deep-link (which mobile browsers block).
  useEffect(() => {
    if (isConnected && address) {
      console.log("[SIWE] wallet connected; showing manual Sign button.", address);
      setShowSignButton(true);
    } else {
      setShowSignButton(false);
    }
  }, [isConnected, address]);

  const runSiwe = useCallback(async () => {
    if (!address) {
      console.warn("[SIWE] runSiwe aborted: address not ready yet");
      return;
    }
    setSigning(true);
    setErrorMsg(null);
    try {
      console.log("[SIWE] manual sign-in starting for", address);
      const res = await siweLoginWithWagmi(address as string, signMessageAsync);
      console.log("[SIWE] verify success, token issued:", res.token ? "yes" : "no");
      onSiweSuccess?.(res);
      onClose();
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SIWE failed";
      console.error("[SIWE] sign failed:", msg, err);
      setErrorMsg(msg);
      setSigning(false);
      setShowSignButton(true); // keep button available so user can retry
      onSiweError?.(msg);
    }
  }, [address, signMessageAsync, onSiweSuccess, onSiweError, onClose]);

  return (
    <div className="flex flex-col items-center gap-4">
      <ConnectButton />
      {signing && (
        <p className="text-xs text-[var(--color-body-subtle)]">
          Approve the signature request in your wallet…
        </p>
      )}
      {showSignButton && !signing && (
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={runSiwe}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--color-brand)" }}
          >
            Sign Message to Verify
          </button>
          {errorMsg && (
            <p className="text-center text-xs text-[var(--color-fg-warning)]">
              {errorMsg}
            </p>
          )}
        </div>
      )}
      {isPending && !signing && (
        <p className="text-xs text-[var(--color-body-subtle)]">
          Confirm in your wallet…
        </p>
      )}
    </div>
  );
}

export default function WalletModal({
  open,
  onClose,
  onSiweSuccess,
  onSiweError,
}: WalletModalProps) {
  const [queryClient] = useState(() => new QueryClient());
  // Resolve the real WC projectId BEFORE mounting Wagmi/RainbowKit.
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getWalletConnectProjectId()
      .then((pid) => {
        if (active) setProjectId(pid || null);
      })
      .catch(() => {
        if (active) setProjectId(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{
          borderColor: "var(--color-border-default)",
          background: "var(--color-surface)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-heading)" }}>
            Connect a Wallet
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-sm opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs" style={{ color: "var(--color-body-subtle)" }}>
          Choose a wallet to sign in with Ethereum (SIWE). Scanned QR works with
          Rainbow, Trust, OKX, Binance, MetaMask mobile and more.
        </p>

        {loading ? (
          <p className="text-sm opacity-70">Loading wallets…</p>
        ) : projectId ? (
          <WagmiProvider config={buildWagmiConfig(projectId)}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider theme={darkTheme({ accentColor: "#6d28d9" })}>
                <WalletFlow
                  onSiweSuccess={onSiweSuccess}
                  onSiweError={onSiweError}
                  onClose={onClose}
                />
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        ) : (
          <p className="text-sm text-[var(--color-fg-warning)]">
            WalletConnect is unavailable (projectId not configured). Use email/password
            or install MetaMask to continue.
          </p>
        )}
      </div>
    </div>
  );
}
