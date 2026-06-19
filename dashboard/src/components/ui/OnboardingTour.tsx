"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, ChevronRight, Check } from "lucide-react";
import { useDashboard } from "../DashboardContext";

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { title: "Welcome to Mission Control", body: "This is your live view of both autonomous agents operating on Base Network." },
  { title: "Agent status, always visible", body: "The sidebar shows Scout and Vault status, latency, and uptime at a glance." },
  { title: "Approvals need your input", body: "Transactions above the autonomous limit appear in the approval queue. Review and approve or reject each one." },
  { title: "Move fast with the command palette", body: "Press ⌘K (or Ctrl+K) to jump between pages and run actions. Press ? any time to see all shortcuts." },
];

export function OnboardingTour() {
  const { preferences, setPreferences } = useDashboard();
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  const open = !preferences.onboarded;
  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => setPreferences({ onboarded: true });
  const next = () => (isLast ? finish() : setStep((s) => s + 1));

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9996] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog" aria-modal="true" aria-label="Onboarding tour"
      >
        <motion.div
          className="w-full max-w-md rounded-2xl elevation-3 p-6"
          style={{ background: "var(--color-card)" }}
          initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--color-brand-softer)", border: "1px solid var(--color-border-brand-subtle)" }}>
                <Sparkles className="w-5 h-5" style={{ color: "var(--color-fg-brand-strong)" }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-body-subtle)" }}>
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <button onClick={finish} aria-label="Skip tour" className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring">
              <X className="w-4 h-4" style={{ color: "var(--color-body-subtle)" }} />
            </button>
          </div>

          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>{current.title}</h3>
          <p className="text-sm mb-6" style={{ color: "var(--color-body-subtle)" }}>{current.body}</p>

          <div className="flex items-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 rounded-full transition-all" style={{ width: i === step ? 24 : 8, background: i <= step ? "var(--color-fg-brand-strong)" : "var(--color-neutral-tertiary)" }} />
            ))}
          </div>

          <div className="flex justify-between">
            <button onClick={finish} className="text-sm font-medium hover:opacity-70 transition-opacity focus-ring rounded" style={{ color: "var(--color-body-subtle)" }}>Skip</button>
            <button onClick={next} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold btn-glint" style={{ background: "var(--color-brand)", color: "var(--color-heading)" }}>
              {isLast ? (<><Check className="w-4 h-4" /> Get started</>) : (<>Next <ChevronRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
