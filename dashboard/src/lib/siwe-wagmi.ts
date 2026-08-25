"use client";

import { type SignableMessage } from "viem";
import { useSignMessage } from "wagmi";
import type { User } from "@/lib/auth";

/**
 * SIWE bridge for RainbowKit/Wagmi wallets.
 *
 * Reuses the SAME backend endpoints as the MetaMask flow, but ALL calls go
 * through SAME-ORIGIN Next.js proxy routes (/api/siwe/*) which forward to the
 * Railway backend server-side. The client NEVER constructs an absolute backend
 * URL, so the "Failed to execute fetch: Invalid value" bug cannot occur here.
 */

export interface SiweVerifyResult {
  token: string;
  user: User;
  wallet?: { seed_phrase?: string; address?: string };
}

export async function siweNonce(address: string): Promise<{ message: string; nonce: string }> {
  let lastErr = "Failed to get SIWE nonce";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch("/api/siwe/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        lastErr = `Failed to get SIWE nonce (HTTP ${res.status})`;
        // Retry once on server errors (Railway cold-start flare).
        if (res.status >= 500 && attempt === 1) continue;
        throw new Error(lastErr);
      }
      const data = await res.json();
      return { message: data.message as string, nonce: data.nonce as string };
    } catch (err) {
      if (attempt === 2 || !(err instanceof Error) || !err.message.includes("HTTP 5")) {
        throw err instanceof Error ? err : new Error(lastErr);
      }
      // loop will retry
    }
  }
  throw new Error(lastErr);
}

export async function siweVerify(
  message: string,
  signature: string
): Promise<SiweVerifyResult> {
  const res = await fetch("/api/siwe/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  if (!res.ok) throw new Error("SIWE verify failed");
  const data = await res.json();
  if (data.token && typeof window !== "undefined") {
    window.localStorage.setItem("a2z-token", data.token);
    document.cookie = `a2z-token=${data.token}; path=/; SameSite=None; Secure`;
  }
  return data as SiweVerifyResult;
}

/**
 * Full SIWE login using a wagmi signMessage function.
 * `signMessageAsync` comes from wagmi's useSignMessage() hook.
 */
export async function siweLoginWithWagmi(
  address: string,
  signMessageAsync: (args: { message: SignableMessage }) => Promise<`0x${string}`>
): Promise<SiweVerifyResult> {
  const { message } = await siweNonce(address);
  const signature = await signMessageAsync({ message: message as SignableMessage });
  if (!signature) throw new Error("Signature was rejected.");
  return siweVerify(message, signature);
}
