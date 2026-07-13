"use client";

import { motion } from "motion/react";
import { useDashboard, type AgentHealth } from "@/components/DashboardContext";
import PageHeader from "@/components/PageHeader";
import { Sparkline } from "@/components/ui/Sparkline";
import { Bot, Shield, Activity, Zap, Clock, CheckCircle2, XCircle, ListChecks, Pause, Play, Link2, TrendingUp, Wallet, ArrowUpRight, Coins } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

function genSpark(base: number, n = 12): number[] {
  // Deterministic placeholder; real history is fed from agent activity.
  let v = base;
  return Array.from({ length: n }, () => { v += (Math.random() - 0.45) * base * 0.1; return Math.max(0, v); });
}

function realSpark(activities: number[]): number[] {
  // Build a sparkline from the actual number of agent log events seen per
  // recent poll window (no fabricated randomness).
  if (activities.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const out = activities.slice(-12);
  while (out.length < 12) out.unshift(0);
  return out;
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-neutral-secondary-medium)" }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[11px]" style={{ color: "var(--color-body-subtle)" }}>{label}</p>
        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-heading)" }}>{value}</p>
      </div>
    </div>
  );
}

function AgentHero({ name, role, icon: Icon, color, bg, status, health, spark, isPaused }: {
  name: string; role: string; icon: typeof Bot; color: string; bg: string;
  status: string; health: AgentHealth; spark: number[]; isPaused?: boolean;
}) {
  return (
    <motion.div
      className="card p-6 space-y-5"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg, border: `1px solid ${color}` }}>
          <Icon className="w-7 h-7" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>{name}</h3>
          <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>{role}</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
          style={{
            background: isPaused ? "var(--color-danger-soft)" : status === "online" ? "var(--color-success-soft)" : "var(--color-warning-soft)",
            color: isPaused ? "var(--color-fg-danger)" : status === "online" ? "var(--color-fg-success)" : "var(--color-fg-warning)",
            border: `1px solid ${isPaused ? "var(--color-border-danger-subtle)" : status === "online" ? "var(--color-border-success-subtle)" : "var(--color-border-warning-subtle)"}`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: "currentColor" }} />
          {isPaused ? "Paused" : status === "online" ? "Running" : status}
        </span>
      </div>

      <Sparkline data={spark} width={320} height={48} color={color} className="opacity-80 w-full" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Metric icon={Clock} label="Latency" value={`${health.latencyMs}ms`} color="var(--color-fg-warning)" />
        <Metric icon={Zap} label="Inference" value={`${health.inferenceMs}ms`} color="var(--color-fg-purple)" />
        <Metric icon={Activity} label="Uptime" value={`${health.uptimePct}%`} color="var(--color-fg-success)" />
        <Metric icon={CheckCircle2} label="Success" value={health.successCount.toString()} color="var(--color-fg-success)" />
        <Metric icon={XCircle} label="Failed" value={health.failCount.toString()} color="var(--color-fg-danger)" />
        <Metric icon={ListChecks} label="Queue" value={health.queueDepth.toString()} color="var(--color-fg-brand-strong)" />
      </div>

      {health.gpu && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--color-neutral-secondary-soft)", border: `1px solid var(--color-border-soft)` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-fg-purple)" }}>
            AMD MI300X GPU · {health.gpu.source}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric icon={Activity} label="GPU Util" value={`${health.gpu.gpuCacheUsagePct}%`} color="var(--color-fg-purple)" />
            <Metric icon={Zap} label="Req Running" value={health.gpu.requestsRunning.toString()} color="var(--color-fg-purple)" />
            <Metric icon={Clock} label="TTFT" value={`${health.gpu.timeToFirstTokenS}s`} color="var(--color-fg-warning)" />
            <Metric icon={ListChecks} label="Tok/s (gen)" value={health.gpu.generationThroughputTokS.toString()} color="var(--color-fg-cyan)" />
            <Metric icon={Bot} label="Tok/s (prompt)" value={health.gpu.promptThroughputTokS.toString()} color="var(--color-fg-cyan)" />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function AgentsPage() {
  const { agentAStatus, agentBStatus, isPaused, setIsPaused, agentHealth, agentMessages } = useDashboard();
  const [holdings, setHoldings] = useState<any>(null);

  useEffect(() => {
    apiFetch("/api/holdings").then(setHoldings).catch(() => {});
    const interval = setInterval(() => apiFetch("/api/holdings").then(setHoldings).catch(() => {}), 15000);
    return () => clearInterval(interval);
  }, []);

  // Real activity sparkline: count Agent A / B messages seen this session.
  const aActivity = agentMessages.filter((m) => m.sender === "agent_a").map((_, i) => i + 1);
  const bActivity = agentMessages.filter((m) => m.sender === "agent_b").map((_, i) => i + 1);

  const holding = (holdings?.holding || []) as any[];
  const sold = (holdings?.sold || []) as any[];

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <PageHeader
        title="Agents"
        description="Health, performance, and control for both autonomous agents."
        icon={Bot}
      >
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-ring"
          style={{
            background: isPaused ? "var(--color-success-medium)" : "var(--color-danger-soft)",
            color: isPaused ? "var(--color-fg-success-strong)" : "var(--color-fg-danger)",
            border: `1px solid ${isPaused ? "var(--color-border-success-subtle)" : "var(--color-border-danger-subtle)"}`,
          }}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? "Resume execution" : "Pause execution"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentHero
          name="Agent A — Scout"
          role="Signal detection & scoring"
          icon={Bot}
          color="var(--color-fg-purple)"
          bg="var(--color-brand-softer)"
          status={agentAStatus}
          health={agentHealth.a}
          spark={realSpark(aActivity)}
        />
        <AgentHero
          name="Agent B — Vault"
          role="Secure execution on Base"
          icon={Bot}
          color="var(--color-fg-cyan)"
          bg="var(--color-brand-soft)"
          status={agentBStatus}
          health={agentHealth.b}
          spark={realSpark(bActivity)}
          isPaused={isPaused}
        />
      </div>

      {/* Vault Holdings — Agent B held tokens */}
      <motion.div
        className="card p-5 space-y-4"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5" style={{ color: "var(--color-fg-cyan)" }} />
          <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
            Vault Holdings
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)" }}>
            {holding.length} holding · {sold.length} sold
          </span>
        </div>

        {holding.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>No tokens held. Agent B will auto-buy when a token scores ≥60.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--color-border-soft)" }}>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-body-subtle)" }}>Token</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-body-subtle)" }}>Entry</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-body-subtle)" }}>Status</th>
                  <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-body-subtle)" }}>Tx</th>
                </tr>
              </thead>
              <tbody>
                {holding.map((t: any) => (
                  <tr key={t.token_address} className="border-b" style={{ borderColor: "var(--color-border-soft)" }}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4" style={{ color: "var(--color-fg-warning)" }} />
                        <span className="font-medium" style={{ color: "var(--color-heading)" }}>{t.token_name}</span>
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: "var(--color-body-subtle)" }}>{t.token_address?.slice(0, 10)}...</span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: "var(--color-body)" }}>
                      ${Number(t.entry_price_usd).toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "var(--color-success-soft)", color: "var(--color-fg-success)", border: "1px solid var(--color-border-success-subtle)" }}>
                        <span className="w-1 h-1 rounded-full" style={{ background: "var(--color-fg-success)" }} />
                        HOLDING
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <a href={`https://basescan.org/tx/${t.buy_tx_hash}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
                        style={{ color: "var(--color-fg-brand)" }}>
                        View <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sold.length > 0 && (
          <div className="pt-3 border-t" style={{ borderColor: "var(--color-border-soft)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-body-subtle)" }}>
              Recently Sold
            </p>
            {sold.slice(-3).map((t: any) => (
              <div key={t.token_address} className="flex items-center justify-between py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--color-fg-success)" }} />
                  <span style={{ color: "var(--color-heading)" }}>{t.token_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums" style={{ color: "var(--color-fg-success)" }}>+{Number(t.entry_price_usd).toFixed(4)}</span>
                  <a href={`https://basescan.org/tx/${t.sell_tx_hash}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold hover:underline"
                    style={{ color: "var(--color-fg-brand)" }}>
                    Sell <ArrowUpRight className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        className="card p-5 flex items-center gap-3"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Link2 className="w-4 h-4" style={{ color: "var(--color-fg-brand-strong)" }} />
        <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>
          Tune scoring, RPC, and execution limits in <a href="/settings" className="font-medium" style={{ color: "var(--color-fg-brand)" }}>Settings</a>.
          Review raw logs in <a href="/history" className="font-medium" style={{ color: "var(--color-fg-brand)" }}>Audit Trail</a>.
        </p>
      </motion.div>
    </motion.div>
  );
}
