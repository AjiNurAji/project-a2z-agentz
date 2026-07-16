"use client";

import { motion } from "motion/react";
import SettingsPanel from "@/components/SettingsPanel";
import SubscriptionPanel from "@/components/SubscriptionPanel";
import PageHeader from "@/components/PageHeader";
import { Settings, CreditCard, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

function AutoSellToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("/api/sell-preference")
      .then((d) => setEnabled(!!(d as any).auto_sell_enabled))
      .catch(() => setEnabled(false));
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    setMsg("");
    const next = !enabled;
    try {
      await apiFetch("/api/sell-preference", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
      });
      setEnabled(next);
      setMsg(next ? "Auto-Sell Agent ON — bot may take profit automatically." : "Auto-Sell Agent OFF — you keep full control of your vault.");
    } catch (e: any) {
      setMsg("Failed to update. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5" style={{ color: "var(--color-fg-cyan)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
          Auto-Sell Agent
        </h3>
      </div>
      <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>
        When ON, the bot may sell your held tokens automatically at take-profit. When OFF, only YOU can sell — via Market or Limit orders in the Agents tab.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{
            background: enabled ? "var(--color-fg-success)" : "var(--color-neutral-secondary-medium)",
            color: enabled ? "#04141f" : "var(--color-body-subtle)",
          }}
        >
          {enabled === null ? "Loading…" : enabled ? "ON" : "OFF"}
        </button>
        {msg && <span className="text-xs" style={{ color: "var(--color-body-subtle)" }}>{msg}</span>}
      </div>
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 20 } },
};

export default function SettingsPage() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <PageHeader
          title="Configuration & Settings"
          description="Tune Agent A scoring parameters, Agent B execution limits, and RPC configuration"
          icon={Settings}
        />
      </motion.div>
      <motion.div variants={itemVariants}>
        <SettingsPanel />
      </motion.div>
      <motion.div variants={itemVariants}>
        <AutoSellToggle />
      </motion.div>
      <motion.div variants={itemVariants}>
        <SubscriptionPanel />
      </motion.div>
    </motion.div>
  );
}
