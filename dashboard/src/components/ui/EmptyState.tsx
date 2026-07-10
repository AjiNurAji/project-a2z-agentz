"use client";

import { motion } from "motion/react";
import { Inbox, Search, FileX, ShieldCheck, Brain, Settings, History, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

const PRESET_ICONS = {
  transactions: Inbox,
  approvals: ShieldCheck,
  search: Search,
  memory: Brain,
  settings: Settings,
  history: History,
  generic: FileX,
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const Icon = icon || FileX;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center text-center py-12 px-6"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: "var(--color-neutral-secondary-medium)",
          border: "1px solid var(--color-border-default)",
        }}
      >
        <Icon className="w-7 h-7" style={{ color: "var(--color-body-subtle)" }} />
      </div>
      <h3
        className="text-base font-semibold mb-1"
        style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}
      >
        {title}
      </h3>
      <p className="text-sm max-w-sm mb-5" style={{ color: "var(--color-body-subtle)" }}>
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: "var(--color-brand-softer)",
            color: "var(--color-fg-brand-strong)",
            border: "1px solid var(--color-border-brand-subtle)",
          }}
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

export { PRESET_ICONS };
