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
