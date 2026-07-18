"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Mail, Lock, Wallet, UserPlus, Loader2, Link2, KeyRound, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import WalletConnectModal from "@/components/WalletConnectModal";

export default function RegisterPage() {
  const { register, loginWithWallet } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [generateWallet, setGenerateWallet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    address: string;
    seed_phrase: string;
    warning: string;
  } | null>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = "Please enter a valid email";
    }
    if (password.length < 8) {
      e.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      e.walletAddress = "Invalid wallet address (0x... 40 hex chars)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await register(
        email.trim().toLowerCase(),
        password,
        walletAddress.trim() || undefined,
        generateWallet
      );
      if (res.wallet?.seed_phrase) {
        // Show seed phrase ONCE. Do NOT navigate away.
        setSeedResult(res.wallet);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      // Surface the failure explicitly so the user is never left on a dead form.
      const message = err instanceof Error ? err.message : "Registration failed";
      toast.error("Registration failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSiwe = async () => {
    setSiweLoading(true);
    try {
      const res = await loginWithWallet();
      if (res.wallet?.seed_phrase) {
        // Brand-new wallet via SIWE: reuse the same seed display as email signup.
        setSeedResult(res.wallet);
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
              Create Account
            </h1>
            <p
              className="text-xs"
              style={{ color: "var(--color-body-subtle)" }}
            >
              Join Mission Control
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          {/* Email */}
          <div>
            <label
              htmlFor="reg-email"
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
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agent.io"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "reg-email-error" : undefined}
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
                id="reg-email-error"
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
              htmlFor="reg-password"
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
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "reg-password-error" : undefined
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
                id="reg-password-error"
                role="alert"
                className="mt-1 text-xs"
                style={{ color: "var(--color-fg-danger)" }}
              >
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="reg-confirm"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-body)" }}
            >
              Confirm Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--color-body-subtle)" }}
                aria-hidden="true"
              />
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword ? "reg-confirm-error" : undefined
                }
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${
                    errors.confirmPassword
                      ? "var(--color-fg-danger)"
                      : "var(--color-border-default)"
                  }`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.confirmPassword && (
              <p
                id="reg-confirm-error"
                role="alert"
                className="mt-1 text-xs"
                style={{ color: "var(--color-fg-danger)" }}
              >
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Wallet (optional) */}
          <div>
            <label
              htmlFor="reg-wallet"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--color-body)" }}
            >
              Wallet Address{" "}
              <span
                className="text-xs font-normal"
                style={{ color: "var(--color-body-subtle)" }}
              >
                (optional)
              </span>
            </label>
            <div className="relative">
              <Wallet
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "var(--color-body-subtle)" }}
                aria-hidden="true"
              />
              <input
                id="reg-wallet"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x... (Base Network)"
                aria-invalid={!!errors.walletAddress}
                aria-describedby={
                  errors.walletAddress ? "reg-wallet-error" : undefined
                }
                className="w-full pl-10 pr-24 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 font-mono text-ellipsis overflow-hidden"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${
                    errors.walletAddress
                      ? "var(--color-fg-danger)"
                      : "var(--color-border-default)"
                  }`,
                  color: "var(--color-heading)",
                }}
              />
              <button
                type="button"
                onClick={() => setWalletModalOpen(true)}
                className="group absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[10px] font-bold rounded-lg border transition-all duration-300 focus-ring overflow-hidden flex items-center hover:border-[var(--color-border-brand)] hover:shadow-[0_0_10px_rgba(110,90,124,0.15)] active:scale-95"
                style={{
                  borderColor: "var(--color-border-brand-subtle)",
                  color: "var(--color-heading)",
                  background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
                }}
              >
                {/* Subtle background glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-brand)]/10 to-[var(--color-accent-purple)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <span className="relative z-10 flex items-center gap-1.5">
                  <Wallet className="w-3 h-3 text-[var(--color-fg-brand)] group-hover:scale-110 transition-transform duration-300" aria-hidden="true" />
                  Connect
                </span>
              </button>
            </div>
            {errors.walletAddress && (
              <p
                id="reg-wallet-error"
                role="alert"
                className="mt-1 text-xs"
                style={{ color: "var(--color-fg-danger)" }}
              >
                {errors.walletAddress}
              </p>
            )}
          </div>

          {/* Generate wallet toggle (P3 self-custodial) */}
          <div
            className="flex items-start gap-3 rounded-xl p-3 border"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              borderColor: "var(--color-border-default)",
            }}
          >
            <div className="mt-0.5">
              <KeyRound
                className="w-4 h-4"
                style={{ color: "var(--color-fg-brand)" }}
                aria-hidden="true"
              />
            </div>
            <div className="flex-1">
              <label className="flex items-center justify-between cursor-pointer gap-3">
                <span className="text-sm" style={{ color: "var(--color-body)" }}>
                  Generate a new wallet for me
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={generateWallet}
                  onClick={() => setGenerateWallet((v) => !v)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
                  style={{
                    background: generateWallet
                      ? "var(--color-fg-brand)"
                      : "var(--color-border-default)",
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{
                      transform: generateWallet
                        ? "translateX(22px)"
                        : "translateX(2px)",
                    }}
                  />
                </button>
              </label>
              <p className="text-xs mt-1" style={{ color: "var(--color-body-subtle)" }}>
                We'll create a self-custodial wallet and show you the seed phrase
                once. Leave off to link your own wallet address instead.
              </p>
            </div>
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
            aria-label="Create account"
          >
            {submitting ? (
              <>
                <Loader2
                  className="w-4 h-4 animate-spin"
                  aria-hidden="true"
                />
                Creating account...
              </>
            ) : (
              <>
                CREATE ACCOUNT
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>



        {/* SIWE — wallet-only sign in (no email/password) */}
        <button
          type="button"
          onClick={handleSiwe}
          disabled={siweLoading}
          className="group relative w-full py-3 rounded-xl text-sm font-bold border transition-all duration-300 overflow-hidden focus-ring flex items-center justify-center gap-2 hover:border-[var(--color-border-brand)] hover:shadow-[0_0_15px_rgba(110,90,124,0.15)] active:scale-[0.98] disabled:opacity-50 mt-4"
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

        {/* Login link */}
        <p
          className="mt-5 text-center text-sm"
          style={{ color: "var(--color-body-subtle)" }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold hover:underline"
            style={{ color: "var(--color-fg-brand)" }}
          >
            Log In
          </Link>
        </p>
      </div>
    </motion.div>

    <WalletConnectModal
      open={walletModalOpen}
      onClose={() => setWalletModalOpen(false)}
      onConnected={(session) => setWalletAddress(session.address)}
      onContinue={() => router.push("/dashboard")}
      onSiweConnect={handleSiwe}
    />

    {seedResult && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.7)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Your new wallet seed phrase"
      >
        <div
          className="w-full max-w-md rounded-2xl p-6 border shadow-2xl"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border-default)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert
              className="w-5 h-5"
              style={{ color: "var(--color-fg-danger)" }}
            />
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--color-heading)" }}
            >
              Save your seed phrase
            </h2>
          </div>
          <p className="text-sm mb-3" style={{ color: "var(--color-body-subtle)" }}>
            This is the <strong>only</strong> time you'll see it. Write it down
            and store it safely. Anyone with this phrase controls your wallet.
          </p>
          <div
            className="rounded-lg p-3 font-mono text-sm break-words select-all"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              color: "var(--color-body)",
            }}
          >
            {seedResult.seed_phrase}
          </div>
          <p
            className="text-xs mt-3 mb-4"
            style={{ color: "var(--color-body-subtle)" }}
          >
            Wallet address:{" "}
            <span className="font-mono">{seedResult.address}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setSeedResult(null);
              router.push("/dashboard");
            }}
            className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{
              background: "var(--color-fg-brand)",
              color: "#ffffff",
            }}
          >
            I've saved it — continue
          </button>
        </div>
      </div>
    )}
    </>
  );
}
