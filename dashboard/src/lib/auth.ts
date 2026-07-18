import { apiFetch } from "./api";

export interface User {
  id: number;
  email: string;
  wallet_address?: string | null;
  created_at?: string;
  last_login_at?: string | null;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<{ user: User; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.token && typeof window !== "undefined") {
    localStorage.setItem("a2z-token", data.token);
  }
  return data.user;
}

export interface RegisterResult {
  user: User;
  token: string;
  wallet?: {
    address: string;
    seed_phrase: string;
    warning: string;
  };
}

export async function register(
  email: string,
  password: string,
  walletAddress?: string,
  generateWallet?: boolean
): Promise<RegisterResult> {
  const data = await apiFetch<RegisterResult>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      ...(walletAddress ? { wallet_address: walletAddress } : {}),
      ...(generateWallet ? { generate_wallet: true } : {}),
    }),
  });
  if (data.token && typeof window !== "undefined") {
    localStorage.setItem("a2z-token", data.token);
  }
  return data;
}

export async function me(): Promise<User | null> {
  try {
    const data = await apiFetch<{ user: User }>("/api/auth/me");
    return data.user;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err as { status: number }).status === 401
    ) {
      return null;
    }
    throw err;
  }
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

export async function forgotPassword(email: string): Promise<{ ok: boolean; message?: string }> {
  const data = await apiFetch<{ ok: boolean; message?: string; error?: string }>(
    "/api/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    }
  );
  if (data.error) {
    throw new Error(data.error);
  }
  return { ok: data.ok, message: data.message };
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ ok: boolean; message?: string }> {
  const data = await apiFetch<{ ok: boolean; message?: string; error?: string }>(
    "/api/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify({ email, code, password: newPassword }),
    }
  );
  if (data.error) {
    throw new Error(data.error);
  }
  return { ok: data.ok, message: data.message };
}

export interface SiweVerifyResult {
  user: User;
  token: string;
  is_new?: boolean;
  wallet?: {
    address: string;
    seed_phrase: string;
    warning: string;
  };
}

export async function siweFetchNonce(address: string): Promise<{ message: string; nonce: string }> {
  const data = await apiFetch<{ message: string; nonce: string }>("/api/auth/siwe/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
  return data;
}

export async function siweFetchVerify(message: string, signature: string): Promise<SiweVerifyResult> {
  const data = await apiFetch<SiweVerifyResult>("/api/auth/siwe/verify", {
    method: "POST",
    body: JSON.stringify({ message, signature }),
  });
  if (data.token && typeof window !== "undefined") {
    localStorage.setItem("a2z-token", data.token);
  }
  return data;
}

/**
 * Sign-In-With-Ethereum (P6): pure wallet-signature login, no email/password.
 * 1. Request the connected address from window.ethereum.
 * 2. POST /api/auth/siwe/nonce {address} -> {message} (EIP-4361 string).
 * 3. personal_sign the message with the wallet.
 * 4. POST /api/auth/siwe/verify {message, signature} -> {token, user, wallet?}.
 * The seed phrase only appears when the wallet is brand new (first SIWE login).
 */
export async function siweLogin(): Promise<SiweVerifyResult> {
  const eth = (window as any).ethereum;
  if (!eth || !eth.request) {
    throw new Error("No Ethereum wallet found. Install MetaMask.");
  }
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) {
    throw new Error("No account connected.");
  }
  const address = accounts[0];

  const { message } = await siweFetchNonce(address);

  const signature: string = await eth.request({
    method: "personal_sign",
    params: [message, address],
  });
  if (!signature) {
    throw new Error("Signature was rejected.");
  }

  return siweFetchVerify(message, signature);
}

/**
 * WalletConnect v2 SIWE login. Reuses the same nonce/verify backend so the
 * database upsert path is identical to injected-wallet SIWE.
 */
export async function siweLoginWalletConnect(): Promise<SiweVerifyResult> {
  const wc = await import("./walletconnect");
  const { address, message, signature } = await wc.walletConnectSiweLogin();
  return siweFetchVerify(message, signature);
}
