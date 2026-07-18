"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Mail, Lock, LogIn, Loader2, Wallet, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import WalletConnectModal from "@/components/WalletConnectModal";

export default function LoginPage() {
  const { login, loginAsGuest, loginWithWallet } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);
  const [siweSeed, setSiweSeed] = useState<{
    address: string;
    seed_phrase: string;
    warning: string;
  } | null>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = "Please enter a valid email";
    }
    if (!password) {
      e.password = "Password is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: unknown) {
      // Surface the failure explicitly so the user is never left on a dead form.
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error("Login failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSiwe = async () => {
    setSiweLoading(true);
    try {
      const res = await loginWithWallet();
      if (res.wallet?.seed_phrase) {
        // Brand-new wallet: show seed ONCE, do NOT navigate.
        setSiweSeed(res.wallet);
      } else {
        router.push(searchParams.get("next") || "/dashboard");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Wallet login failed";
      toast.error("Wallet login failed", message);
    } finally {
      setSiweLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm sm:max-w-md"
      >
      <div
        className="rounded-2xl p-6 sm:p-8 backdrop-blur-xl border shadow-2xl"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 82%, transparent)",
          borderColor: "var(--color-border-default)",
        }}
      >
        {/* Logo + heading */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              border: "1px solid var(--color-border-brand-subtle)",
            }}
          >
            <img src="/images/logo/logo.svg" className="w-6 h-6 object-contain" alt="A2Z Logo" />
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--color-heading)" }}
            >
              Log In
            </h1>
            <p
              className="text-xs"
              style={{ color: "var(--color-body-subtle)" }}
            >
              Enter Mission Control
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-body)" }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--color-body-subtle)" }}
                aria-hidden="true"
              />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agent.io"
                aria-invalid={!!errors.email}
                aria-describedby={
                  errors.email ? "login-email-error" : undefined
                }
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${
                    errors.email
                      ? "var(--color-fg-danger)"
                      : "var(--color-border-default)"
                  }`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.email && (
              <p
                id="login-email-error"
                role="alert"
                className="mt-1 text-xs"
                style={{ color: "var(--color-fg-danger)" }}
              >
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-body)" }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--color-body-subtle)" }}
                aria-hidden="true"
              />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "login-password-error" : undefined
                }
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${
                    errors.password
                      ? "var(--color-fg-danger)"
                      : "var(--color-border-default)"
                  }`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.password && (
              <p
                id="login-password-error"
                role="alert"
                className="mt-1 text-xs"
                style={{ color: "var(--color-fg-danger)" }}
              >
                {errors.password}
              </p>
            )}
          </div>

          {/* Remember + forgot */}
          <div className="flex items-center justify-between text-xs">
            <label
              className="flex items-center gap-2 cursor-pointer"
              style={{ color: "var(--color-body-subtle)" }}
            >
              <input
                type="checkbox"
                className="rounded accent-[var(--color-brand)]"
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="hover:underline"
              style={{ color: "var(--color-fg-brand)" }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
            style={{
              background:
                "linear-gradient(135deg, var(--color-fg-brand), var(--color-accent-purple))",
              color: "#ffffff",
            }}
            aria-label="Log in to Mission Control"
          >
            {submitting ? (
              <>
                <Loader2
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
                Authenticating...
              </>
            ) : (
              <>
                ENTER MISSION CONTROL
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        {/* Divider + wallet */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="flex-1 h-px"
              style={{ background: "var(--color-border-default)" }}
            />
            <span
              className="text-xs"
              style={{ color: "var(--color-body-subtle)" }}
            >
              or
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--color-border-default)" }}
            />
          </div>
          <button
            type="button"
            onClick={handleSiwe}
            disabled={siweLoading}
            className="group relative w-full py-3 rounded-xl text-sm font-bold border transition-all duration-300 overflow-hidden focus-ring flex items-center justify-center gap-2 hover:border-[var(--color-border-brand)] hover:shadow-[0_0_15px_rgba(110,90,124,0.15)] active:scale-[0.98] disabled:opacity-50"
            style={{
              borderColor: "var(--color-border-brand-subtle)",
              color: "var(--color-heading)",
              background: "color-mix(in srgb, var(--color-surface) 40%, transparent)",
            }}
            aria-label="Sign in with Ethereum wallet"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-brand)]/10 via-[var(--color-accent-purple)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Wallet className="w-4 h-4 text-[var(--color-fg-brand)] group-hover:scale-110 transition-transform duration-300 relative z-10" aria-hidden="true" />
            <span className="relative z-10">
              {siweLoading ? "Waiting for signature…" : "Connect Wallet (SIWE)"}
            </span>
          </button>

          {/* First-time SIWE user: show seed phrase ONCE */}
          {siweSeed && (
            <div
              className="rounded-xl p-4 space-y-2 border"
              style={{
                borderColor: "var(--color-border-warning-subtle)",
                background: "color-mix(in srgb, var(--color-warning-soft) 30%, transparent)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-fg-warning)" }}>
                Save your recovery phrase
              </p>
              <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>
                {siweSeed.warning}
              </p>
              <code className="block text-sm break-words rounded-lg p-2" style={{ background: "var(--color-neutral-secondary-soft)", color: "var(--color-heading)" }}>
                {siweSeed.seed_phrase}
              </code>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full py-2 rounded-lg text-sm font-semibold"
                style={{ background: "var(--color-fg-warning)", color: "#1a0b2e" }}
              >
                I&apos;ve saved it → Enter Mission Control
              </button>
            </div>
          )}

          {/* Demo / Guest Login */}
          <button
            type="button"
            onClick={loginAsGuest}
            className="group mt-3 w-full py-2.5 rounded-xl text-sm font-semibold border transition-all duration-300 hover:border-[var(--color-border-brand)] hover:shadow-[0_0_10px_rgba(110,90,124,0.1)] active:scale-[0.98] focus-ring flex items-center justify-center gap-2"
            style={{ 
              borderColor: "var(--color-border-default)",
              color: "var(--color-heading)",
              background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
            }}
          >
            <User className="w-4 h-4 text-[var(--color-fg-brand)] group-hover:scale-110 transition-transform duration-300 relative z-10" aria-hidden="true" />
            <span className="relative z-10">Continue as Demo / Guest</span>
          </button>
        </div>



        {/* Register link */}
        <p
          className="mt-5 text-center text-sm"
          style={{ color: "var(--color-body-subtle)" }}
        >
          No account?{" "}
          <Link
            href="/register"
            className="font-semibold hover:underline"
            style={{ color: "var(--color-fg-brand)" }}
          >
            Register
          </Link>
        </p>
      </div>
    </motion.div>

    <WalletConnectModal
      open={walletModalOpen}
      onClose={() => setWalletModalOpen(false)}
      onContinue={() => router.push("/dashboard")}
      onSiweConnect={handleSiwe}
    />
    </>
  );
}
