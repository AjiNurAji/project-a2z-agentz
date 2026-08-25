"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Mail, Loader2 } from "lucide-react";
import { forgotPassword } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverMsg, setServerMsg] = useState("");

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = "Please enter a valid email";
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
      const res = await forgotPassword(email.trim().toLowerCase());
      setDone(true);
      setServerMsg(
        res.message || "If the email exists, a reset code was sent."
      );
    } catch (err) {
      setServerMsg(
        err instanceof Error ? err.message : "Failed to request reset code."
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
                Reset Password
              </h1>
              <p
                className="text-xs"
                style={{ color: "var(--color-body-subtle)" }}
              >
                We'll email you a 6-digit code
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
              <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>
                Check your inbox for the code, then enter it on the next step.
              </p>
              <Link
                href="/reset-password"
                className="block w-full text-center rounded-lg px-4 py-2.5 font-semibold transition"
                style={{
                  background: "var(--color-brand)",
                  color: "var(--color-surface)",
                }}
              >
                Enter reset code
              </Link>
              <div className="text-center">
                <Link
                  href="/login"
                  className="text-xs hover:underline"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  Back to Log In
                </Link>
              </div>
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
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: "var(--color-body-subtle)" }}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    autoComplete="email"
                    className="w-full rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none border focus:ring-2 transition"
                    style={{
                      background: "var(--color-surface)",
                      borderColor: errors.email
                        ? "var(--color-danger)"
                        : "var(--color-border-default)",
                      color: "var(--color-body)",
                    }}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
                    {errors.email}
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
                Send reset code
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-xs hover:underline"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  Back to Log In
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </>
  );
}
