"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { resetPassword } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = "Please enter a valid email";
    }
    if (!/^\d{6}$/.test(code.trim())) {
      e.code = "Enter the 6-digit code from your email";
    }
    if (password.length < 8) {
      e.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerMsg("");
    try {
      const res = await resetPassword(
        email.trim().toLowerCase(),
        code.trim(),
        password
      );
      setDone(true);
      setServerMsg(res.message || "Password updated.");
    } catch (err) {
      setServerMsg(
        err instanceof Error ? err.message : "Failed to reset password."
      );
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
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{
                background: "var(--color-neutral-secondary-medium)",
                border: "1px solid var(--color-border-brand-subtle)",
              }}
            >
              <img
                src="/images/logo/logo.svg"
                className="w-6 h-6 object-contain"
                alt="A2Z Logo"
              />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{ color: "var(--color-heading)" }}
              >
                Set New Password
              </h1>
              <p
                className="text-xs"
                style={{ color: "var(--color-body-subtle)" }}
              >
                Enter the code we emailed you
              </p>
            </div>
          </div>

          {done ? (
            <div className="space-y-4">
              <div
                className="rounded-lg p-3 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                  color: "var(--color-body)",
                }}
              >
                {serverMsg}
              </div>
              <Link
                href="/login"
                className="block w-full text-center rounded-lg px-4 py-2.5 font-semibold transition"
                style={{
                  background: "var(--color-brand)",
                  color: "var(--color-surface)",
                }}
              >
                Log in with new password
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" role="form">
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border focus:ring-2 transition"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: errors.email
                      ? "var(--color-danger)"
                      : "var(--color-border-default)",
                    color: "var(--color-body)",
                  }}
                />
                {errors.email && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  6-digit code
                </label>
                <div className="relative">
                  <KeyRound
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--color-body-subtle)" }}
                  />
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    className="w-full rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none border focus:ring-2 transition tracking-widest text-center"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: errors.code
                        ? "var(--color-danger)"
                        : "var(--color-border-default)",
                      color: "var(--color-body)",
                    }}
                  />
                </div>
                {errors.code && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                    {errors.code}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  New password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--color-body-subtle)" }}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none border focus:ring-2 transition"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: errors.password
                        ? "var(--color-danger)"
                        : "var(--color-border-default)",
                      color: "var(--color-body)",
                    }}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none border focus:ring-2 transition"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: errors.confirmPassword
                      ? "var(--color-danger)"
                      : "var(--color-border-default)",
                    color: "var(--color-body)",
                  }}
                />
                {errors.confirmPassword && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {serverMsg && (
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{
                    background: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                    color: "var(--color-danger)",
                  }}
                >
                  {serverMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg px-4 py-2.5 font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: "var(--color-brand)",
                  color: "var(--color-surface)",
                }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Update password
              </button>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-xs hover:underline"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  Request a new code
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </>
  );
}
