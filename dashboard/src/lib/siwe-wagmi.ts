"use client";

import { type SignableMessage } from "viem";
import { useSignMessage } from "wagmi";

/**
 * SIWE bridge for RainbowKit/Wagmi wallets.
 *
 * Reuses the SAME backend endpoints as the MetaMask flow:
 *   POST /api/auth/siwe/nonce {address}  -> {message} (EIP-4361)
 *   sign message with wagmi signMessage
 *   POST /api/auth/siwe/verify {message, signature} -> {token, user}
 *
 * All network calls go through apiFetch (safe URL builder, no "Invalid value").
 */

export interface SiweVerifyResult {
  token: string;
  user: Record<string, unknown>;
  wallet?: { seed_phrase?: string; address?: string };
}

export async function siweNonce(address: string): Promise<{ message: string; nonce: string }> {
  const { apiFetch } = await import("./api");
  return apiFetch<{ message: string; nonce: string }>("/api/auth/siwe/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function siweVerify(
  message: string,
  signature: string
): Promise<SiweVerifyResult> {
  const { apiFetch } = await import("./api");
  const data = await apiFetch<SiweVerifyResult>("/api/auth/siwe/verify", {
    method: "POST",
    body: JSON.stringify({ message, signature }),
  });
  if (data.token && typeof window !== "undefined") {
    window.localStorage.setItem("a2z-token", data.token);
  }
  return data;
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
