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
    setState("connecting");
    setError(null);

    // Fallback/demo mode when no provider extension is installed in the browser
    if (!wallet.provider) {
      // Simulate connection delay for real feel
      await new Promise((resolve) => setTimeout(resolve, 600));
      
      const mockAddress = "0x7fa8" + Math.random().toString(16).substring(2, 10) + "0000000000000000000000000000";
      const nextSession: WalletSession = {
        address: mockAddress.toLowerCase(),
        walletName: wallet.name + " (Demo)",
        chainId: "0x2105", // Base Mainnet chain ID (8453)
        connectedAt: new Date().toISOString(),
        frontendOnly: true,
      };
      saveWalletSession(nextSession);
      setSession(nextSession);
      setState("connected");
      return nextSession;
    }

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
