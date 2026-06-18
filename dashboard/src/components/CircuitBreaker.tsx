"use client";

import { useDashboard } from "./DashboardContext";
import { ShieldOff, ShieldCheck, AlertTriangle, Power } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function CircuitBreaker() {
  const { isPaused, setIsPaused } = useDashboard();

  return (
    <div
      className="card p-5 transition-all duration-500"
      style={{
        borderColor: isPaused ? "var(--color-border-danger-subtle)" : undefined,
        background: isPaused
          ? "linear-gradient(180deg, var(--color-danger-soft), var(--color-neutral-primary-soft))"
          : undefined,
      }}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: isPaused ? "var(--color-danger-soft)" : "var(--color-neutral-secondary-medium)",
              border: `1px solid ${isPaused ? "var(--color-border-danger-subtle)" : "var(--color-border-default)"}`,
            }}
          >
            {isPaused ? (
              <ShieldOff className="w-5 h-5" style={{ color: "var(--color-fg-danger)" }} aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-5 h-5" style={{ color: "var(--color-fg-success)" }} aria-hidden="true" />
            )}
          </div>
          <div>
            <h2
              className="text-base font-semibold text-[var(--color-heading)] flex items-center gap-2"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Circuit Breaker
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full"
                style={{
                  background: isPaused ? "var(--color-danger-medium)" : "var(--color-success-medium)",
                  color: isPaused ? "var(--color-fg-danger)" : "var(--color-fg-success)",
                  border: `1px solid ${isPaused ? "var(--color-border-danger-subtle)" : "var(--color-border-success-subtle)"}`,
                }}
              >
                {isPaused ? "PAUSED" : "ACTIVE"}
              </span>
            </h2>
            <p className="text-sm text-[var(--color-body-subtle)] mt-0.5">
              Emergency Kill Switch — halts all Agent B on-chain activity instantly.
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => setIsPaused(!isPaused)}
          aria-pressed={isPaused}
          aria-label={isPaused ? "Resume automated payouts" : "Pause automated payouts"}
          className="relative inline-flex h-12 w-24 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent active:scale-95 focus-ring transition-colors"
          style={{
            background: isPaused ? "var(--color-danger)" : "var(--color-neutral-secondary-medium)",
            boxShadow: isPaused
              ? "0 0 20px color-mix(in srgb, var(--color-danger) 25%, transparent), inset 0 2px 4px rgba(0,0,0,0.2)"
              : "inset 0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          <motion.span
            className="pointer-events-none inline-flex h-11 w-11 rounded-full items-center justify-center"
            style={{
              background: "var(--color-heading)",
              boxShadow: "var(--shadow-md)",
            }}
            animate={{ x: isPaused ? 50 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {isPaused ? (
              <Power className="h-5 w-5" style={{ color: "var(--color-danger)" }} aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-[var(--color-body-subtle)]" aria-hidden="true" />
            )}
          </motion.span>
        </button>
      </div>

      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            role="alert"
            aria-live="assertive"
            className="mt-4 p-4 rounded-2xl text-sm flex items-start gap-3"
            style={{
              background: "var(--color-danger-soft)",
              border: "1px solid var(--color-border-danger-subtle)",
              color: "var(--color-fg-danger)",
            }}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" aria-hidden="true" />
            <p>
              <strong>SYSTEM PAUSED:</strong> All automated payouts are blocked. Agent B will not broadcast
              any transactions until you resume operations.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
