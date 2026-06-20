"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Mail, Lock, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

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
    } catch {
      // Error toast shown by AuthProvider
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))",
            }}
          >
            <LogIn
              className="w-5 h-5"
              style={{ color: "var(--color-heading)" }}
            />
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
            <span
              className="cursor-pointer hover:underline"
              style={{ color: "var(--color-fg-brand)" }}
            >
              Forgot password?
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
            style={{
              background:
                "linear-gradient(135deg, var(--color-fg-brand), var(--color-accent-purple))",
              color: "var(--color-heading)",
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
            className="w-full py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80 focus-ring"
            style={{
              borderColor: "var(--color-border-default)",
              color: "var(--color-body)",
              background: "var(--color-neutral-secondary-medium)",
            }}
            aria-label="Connect Web3 wallet"
          >
            🦊 Connect Wallet
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
  );
}
