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
  const { apiFetch, API_URL } = await import("./api");
  const url = `${API_URL}/api/auth/siwe/nonce`;
  const body = JSON.stringify({ address });
  console.log("[DEBUG_NONCE_PAYLOAD]", JSON.stringify({
    url, body, address_type: typeof address, address_len: address?.length,
  }, null, 2));
  if (!url || url.includes("undefined") || !address) {
    const msg = `[GUARD] nonce payload incomplete — url=${url} address?=${!!address}`;
    console.error(msg);
    throw new Error("Data belum lengkap (nonce): " + msg);
  }
  return apiFetch<{ message: string; nonce: string }>("/api/auth/siwe/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

export async function siweVerify(
  message: string,
  signature: string
): Promise<SiweVerifyResult> {
  const { apiFetch, API_URL } = await import("./api");
  const url = `${API_URL}/api/auth/siwe/verify`;
  const body = JSON.stringify({ message, signature });
  const headers = { "Content-Type": "application/json" };
  // === MANDATORY DEBUG (per audit): print EVERYTHING before fetch ===
  console.log("[DEBUG_VERIFY_PAYLOAD]", JSON.stringify({
    url,
    body,
    headers,
    message_type: typeof message,
    message_len: message?.length,
    signature_type: typeof signature,
    signature_len: signature?.length,
    api_url: API_URL,
  }, null, 2));
  // === GUARD: never fire fetch with empty/undefined fields ===
  if (!url || url.includes("undefined") || !message || !signature) {
    const msg = `[GUARD] verify payload incomplete — url=${url} message?=${!!message} signature?=${!!signature}`;
    console.error(msg);
    throw new Error("Data belum lengkap (verify): " + msg);
  }
  let data: SiweVerifyResult;
  try {
    data = await apiFetch<SiweVerifyResult>("/api/auth/siwe/verify", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    });
  } catch (err) {
    console.error("[SIWE] verify fetch failed:", err);
    throw err instanceof Error ? err : new Error("SIWE verify request failed");
  }
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
  console.log("[SIWE] nonce received, signing message for", address);
  let signature: `0x${string}`;
  try {
    signature = await signMessageAsync({ message: message as SignableMessage });
  } catch (err) {
    console.error("[SIWE] signMessageAsync FAILED (this is the wallet/sign step, not verify):", err);
    throw err instanceof Error ? err : new Error("Wallet sign rejected");
  }
  if (!signature) throw new Error("Signature was rejected.");
  return siweVerify(message, signature);
}
