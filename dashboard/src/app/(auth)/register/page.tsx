"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Mail, Lock, Wallet, UserPlus, Loader2, Link2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import WalletConnectModal from "@/components/WalletConnectModal";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);

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
      await register(
        email.trim().toLowerCase(),
        password,
        walletAddress.trim() || undefined
      );
    } catch {
      // Error toast shown by AuthProvider
    } finally {
      setSubmitting(false);
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
    />
    </>
  );
}
