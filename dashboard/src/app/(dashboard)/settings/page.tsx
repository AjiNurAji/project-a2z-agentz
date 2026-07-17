"use client";

import { motion } from "motion/react";
import SettingsPanel from "@/components/SettingsPanel";
import PageHeader from "@/components/PageHeader";
import { Settings, Bot } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

function AutoSellToggle() {
  const { toast } = useToast();
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
      const res: any = await apiFetch("/api/sell-preference", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
      });
      if (res && res.demo) { toast({ type: "info", title: "Demo Mode", description: "Action Simulated" }); return; }
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

function ExecutionModeToggle() {
  const { toast } = useToast();
  const [mode, setMode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiFetch("/api/execution-mode")
      .then((d) => setMode((d as any).execution_mode || "custodial"))
      .catch(() => setMode("custodial"));
  }, []);

  const set = async (next: string) => {
    if (mode === null || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res: any = await apiFetch("/api/execution-mode", {
        method: "POST",
        body: JSON.stringify({ mode: next }),
      });
      if (res && res.demo) { toast({ type: "info", title: "Demo Mode", description: "Action Simulated" }); return; }
      setMode(next);
      setMsg(
        next === "self_custodial"
          ? "Self-Custodial ON — swaps sign from YOUR wallet (you pay gas)."
          : "Custodial ON — swaps sign from the platform vault."
      );
    } catch (e: any) {
      setMsg(e?.message || "Failed to update. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const isSelf = mode === "self_custodial";

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5" style={{ color: "var(--color-fg-cyan)" }} />
        <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
          Execution Mode
        </h3>
      </div>
      <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>
        Choose who signs your sell transactions. <b>Custodial</b> uses the platform vault.
        <b> Self-Custodial</b> signs from your own generated wallet (P3) — you stay in full control and pay gas.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => set("custodial")}
          disabled={busy || mode === null}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{
            background: !isSelf ? "var(--color-fg-success)" : "var(--color-neutral-secondary-medium)",
            color: !isSelf ? "#04141f" : "var(--color-body-subtle)",
          }}
        >
          {mode === null ? "Loading…" : "Custodial"}
        </button>
        <button
          onClick={() => set("self_custodial")}
          disabled={busy || mode === null}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          style={{
            background: isSelf ? "var(--color-fg-success)" : "var(--color-neutral-secondary-medium)",
            color: isSelf ? "#04141f" : "var(--color-body-subtle)",
          }}
        >
          Self-Custodial
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
        <ExecutionModeToggle />
      </motion.div>
    </motion.div>
  );
}
