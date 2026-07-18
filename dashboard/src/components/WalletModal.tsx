"use use client";

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
  const [manualMode, setManualMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Ensure we only auto-attempt SIWE once per mount (avoids double-fire on
  // re-renders where isConnected/address are already truthy).
  const triggeredRef = useRef(false);

  const runSiwe = useCallback(async () => {
    if (!address) {
      console.warn("[SIWE] runSiwe aborted: address not ready yet");
      return;
    }
    setSigning(true);
    setErrorMsg(null);
    setManualMode(false);
    try {
      console.log("[SIWE] starting sign-in for", address);
      const res = await siweLoginWithWagmi(address as string, signMessageAsync);
      console.log("[SIWE] verify success, token issued:", res.token ? "yes" : "no");
      // Persist auth + hand off to caller, then hard-redirect into the app.
      onSiweSuccess?.(res);
      onClose();
      // Hard navigation guarantees we land in Mission Control even if a
      // parent component forgets to route. (token already stored in localStorage
      // by siweVerify/siweFetchVerify.)
      window.location.href = "/dashboard";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SIWE failed";
      console.error(
        "[SIWE] catch block hit — automatic sign rejected/failed:",
        msg,
        err
      );
      setErrorMsg(msg);
      setSigning(false);
      // Mobile browsers may block the auto deep-link sign; surface a manual
      // button so the user is never stuck at the gate.
      setManualMode(true);
      onSiweError?.(msg);
    }
  }, [address, signMessageAsync, onSiweSuccess, onSiweError, onClose]);

  // Auto-trigger SIWE AFTER a delay once connected. The delay lets the
  // WalletConnect socket settle and RainbowKit's UI finish mounting — on
  // mobile, firing signMessage synchronously on isConnected=true gets blocked
  // by the browser and fails instantly.
  useEffect(() => {
    if (!isConnected || !address) return;
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    console.log("[SIWE] wallet connected; waiting 1200ms before auto-sign…");
    const t = setTimeout(() => {
      runSiwe();
    }, 1200);
    return () => clearTimeout(t);
  }, [isConnected, address, runSiwe]);

  return (
    <div className="flex flex-col items-center gap-4">
      <ConnectButton />
      {signing && (
        <p className="text-xs text-[var(--color-body-subtle)]">
          Sign the message in your wallet to continue…
        </p>
      )}
      {manualMode && (
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => runSiwe()}
            className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--color-brand)" }}
          >
            Sign Message to Verify
          </button>
          {errorMsg && (
            <p className="text-center text-xs text-[var(--color-fg-warning)]">
              Auto-sign was blocked — tap above to sign manually.
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
  // RainbowKit's getDefaultConfig contacts Reown with the projectId; an
  // invalid/dummy id makes Reown return 403 and throws, crashing the tree.
  // So we only build the config once we have a valid projectId.
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
