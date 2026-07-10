"use client";

import { motion } from "motion/react";
import { ArrowLeft, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 overflow-hidden"
          style={{
            background: "var(--color-neutral-secondary-medium)",
            border: "1px solid var(--color-border-brand-subtle)",
            boxShadow: "0 8px 32px var(--color-glow-brand)",
          }}
        >
          <img src="/images/logo/logo.svg" className="w-14 h-14 object-contain" alt="A2Z Logo" />
        </div>
        <h1
          className="text-7xl font-bold mb-2 tabular-nums"
          style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}
        >
          404
        </h1>
        <p className="text-lg font-medium mb-2" style={{ color: "var(--color-heading)" }}>
          Route Not Found
        </p>
        <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "var(--color-body-subtle)" }}>
          The agent couldn&apos;t locate this page. It may have been moved, deleted, or never existed on Base Network.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-medium))",
              color: "var(--color-heading)",
            }}
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              color: "var(--color-body)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
