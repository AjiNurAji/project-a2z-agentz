"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: "var(--color-success-soft)",
    border: "var(--color-border-success-subtle)",
    icon: "var(--color-fg-success)",
  },
  error: {
    bg: "var(--color-danger-soft)",
    border: "var(--color-border-danger-subtle)",
    icon: "var(--color-fg-danger)",
  },
  warning: {
    bg: "var(--color-warning-soft)",
    border: "var(--color-border-warning-subtle)",
    icon: "var(--color-fg-warning)",
  },
  info: {
    bg: "var(--color-info-soft)",
    border: "var(--color-border-info-subtle)",
    icon: "var(--color-fg-info)",
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[toast.type];
  const colors = COLORS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="flex items-start gap-3 p-4 rounded-2xl shadow-lg max-w-sm pointer-events-auto"
      style={{
        background: "var(--color-card)",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: colors.bg }}
      >
        <Icon className="w-4 h-4" style={{ color: colors.icon }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--color-heading)" }}>
          {toast.title}
        </p>
        {toast.description && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-body-subtle)" }}>
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" style={{ color: "var(--color-body-subtle)" }} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...t, id }].slice(-5));
  }, []);

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (title, description) => addToast({ type: "success", title, description }),
    error: (title, description) => addToast({ type: "error", title, description }),
    warning: (title, description) => addToast({ type: "warning", title, description }),
    info: (title, description) => addToast({ type: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite" role="status">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
