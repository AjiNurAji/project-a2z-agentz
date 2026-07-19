"use client";

import { type SignableMessage } from "viem";
import { useSignMessage } from "wagmi";

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
  user: Record<string, unknown>;
  wallet?: { seed_phrase?: string; address?: string };
}

export async function siweNonce(address: string): Promise<{ message: string; nonce: string }> {
  const res = await fetch("/api/siwe/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error("Failed to get SIWE nonce");
  const data = await res.json();
  return { message: data.message as string, nonce: data.nonce as string };
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
