"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";

type Variant = "danger" | "warning" | "info";

interface ConfirmModalProps {
  open: boolean;
  variant?: Variant;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT = {
  danger: { icon: AlertCircle, color: "var(--color-fg-danger)", bg: "var(--color-danger-soft)", border: "var(--color-border-danger-subtle)" },
  warning: { icon: AlertTriangle, color: "var(--color-fg-warning)", bg: "var(--color-warning-soft)", border: "var(--color-border-warning-subtle)" },
  info: { icon: Info, color: "var(--color-fg-brand-strong)", bg: "var(--color-brand-softer)", border: "var(--color-border-brand-subtle)" },
};

export function ConfirmModal({
  open, variant = "warning", title, description, details = [],
  confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const v = VARIANT[variant];
  const Icon = v.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel, onConfirm]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel}
            role="presentation"
          />
          <motion.div
            className="fixed top-1/2 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div
              className="rounded-2xl elevation-3 p-5"
              style={{ background: "var(--color-card)" }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: v.bg, border: `1px solid ${v.border}` }}
                >
                  <Icon className="w-5 h-5" style={{ color: v.color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
                    {title}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: "var(--color-body-subtle)" }}>
                    {description}
                  </p>
                </div>
                <button onClick={onCancel} aria-label="Close" className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring">
                  <X className="w-4 h-4" style={{ color: "var(--color-body-subtle)" }} />
                </button>
              </div>

              {details.length > 0 && (
                <div className="rounded-xl p-3 mb-4 space-y-1.5" style={{ background: "var(--color-neutral-secondary-medium)" }}>
                  {details.map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: "var(--color-body-subtle)" }}>{d.label}</span>
                      <span className="font-medium tabular-nums" style={{ color: "var(--color-heading)" }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-ring"
                  style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body)", border: "1px solid var(--color-border-default)" }}
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  className="btn-glint px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-ring"
                  style={{
                    background: variant === "danger" ? "var(--color-danger)" : variant === "warning" ? "var(--color-warning)" : "var(--color-brand)",
                    color: "var(--color-heading)",
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
