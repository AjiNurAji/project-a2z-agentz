"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { User } from "@/lib/auth";
import * as authLib from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    walletAddress?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  loginAsGuest: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const isGuest = typeof window !== "undefined" && localStorage.getItem("a2z-guest-session") === "1";
      if (isGuest) {
        setUser({ id: 999, email: "judge@a2z.demo", wallet_address: "0xDemoWallet999" });
        setLoading(false);
        return;
      }
      const u = await authLib.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        const u = await authLib.login(email, password);
        setUser(u);
        const next = searchParams.get("next") || "/dashboard";
        router.push(next);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Login failed";
        toast.error("Login failed", message);
        throw err;
      }
    },
    [router, searchParams, toast]
  );

  const handleRegister = useCallback(
    async (
      email: string,
      password: string,
      walletAddress?: string
    ) => {
      try {
        const u = await authLib.register(email, password, walletAddress);
        setUser(u);
        router.push("/dashboard");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Registration failed";
        toast.error("Registration failed", message);
        throw err;
      }
    },
    [router, toast]
  );

  const loginAsGuest = useCallback(() => {
    setUser({ id: 999, email: "judge@a2z.demo", wallet_address: "0xDemoWallet999" });
    if (typeof window !== "undefined") {
      localStorage.setItem("a2z-guest-session", "1");
      // Set dummy token so it passes middleware if enabled.
      // SameSite=None+Secure required for cross-site (Vercel -> Railway).
      document.cookie = "a2z-token=guest; path=/; SameSite=None; Secure";
    }
    router.push("/dashboard");
  }, [router]);

  const handleLogout = useCallback(async () => {
    try {
      await authLib.logout();
    } catch {
      // Ignore logout errors — clear local state regardless
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("a2z-guest-session");
      localStorage.removeItem("a2z-token");
      document.cookie = "a2z-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure";
    }
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        refresh,
        loginAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
