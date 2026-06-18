"use client";

import { useDashboard, type DashboardConfig } from "./DashboardContext";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Save, RotateCcw, Sliders, Server, Shield, Zap, Check } from "lucide-react";

export default function SettingsPanel() {
  const { config, setConfig } = useDashboard();
  const [local, setLocal] = useState<DashboardConfig>({ ...config });
  const [saved, setSaved] = useState(false);

  const updateA = <K extends keyof DashboardConfig["agentA"]>(key: K, value: DashboardConfig["agentA"][K]) => {
    setLocal((prev) => ({ ...prev, agentA: { ...prev.agentA, [key]: value } }));
  };

  const updateB = <K extends keyof DashboardConfig["agentB"]>(key: K, value: DashboardConfig["agentB"][K]) => {
    setLocal((prev) => ({ ...prev, agentB: { ...prev.agentB, [key]: value } }));
  };

  const handleSentimentChange = (val: number) => {
    setLocal((prev) => ({
      ...prev,
      agentA: { ...prev.agentA, sentimentWeight: val, tvlWeight: 100 - val },
    }));
  };

  const handleSave = () => {
    setConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setLocal({ ...config });
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--color-neutral-secondary-medium)",
    border: "1px solid var(--color-border-default-medium)",
    color: "var(--color-heading)",
  };

  const labelStyle: React.CSSProperties = { color: "var(--color-heading)" };
  const subtleStyle: React.CSSProperties = { color: "var(--color-body-subtle)" };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent A Config */}
        <motion.div
          className="card p-5 space-y-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--color-brand-softer)", color: "var(--color-fg-brand-strong)" }}>
              <Sliders size={16} />
            </div>
            <div>
              <h4 className="font-serif" style={labelStyle}>Agent A — The Scout</h4>
              <p className="text-xs" style={subtleStyle}>Signal detection & scoring configuration</p>
            </div>
          </div>

          {/* Cron Schedule */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>Cron Schedule</label>
            <input
              type="text"
              value={local.agentA.cronSchedule}
              onChange={(e) => updateA("cronSchedule", e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={subtleStyle}>Current: every hour</p>
          </div>

          {/* Sentiment / TVL Weight */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={labelStyle}>Sentiment Weight</label>
              <span className="text-sm font-mono tabular-nums" style={{ color: "var(--color-fg-brand-strong)" }}>{local.agentA.sentimentWeight}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              value={local.agentA.sentimentWeight}
              onChange={(e) => handleSentimentChange(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: "var(--color-neutral-tertiary)" }}
            />
            <div className="flex justify-between text-xs mt-1" style={subtleStyle}>
              <span>Sentiment: {local.agentA.sentimentWeight}%</span>
              <span>TVL: {local.agentA.tvlWeight}%</span>
            </div>
          </div>

          {/* Score Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={labelStyle}>Score Threshold</label>
              <span className="text-sm font-mono tabular-nums" style={{ color: "var(--color-fg-brand-strong)" }}>{local.agentA.scoreThreshold}/100</span>
            </div>
            <input
              type="range"
              min={50}
              max={99}
              value={local.agentA.scoreThreshold}
              onChange={(e) => updateA("scoreThreshold", Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: "var(--color-neutral-tertiary)" }}
            />
          </div>

          {/* Sources */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>Data Sources</label>
            <div className="flex flex-wrap gap-2">
              {local.agentA.sources.map((src) => (
                <span
                  key={src}
                  className="text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{ background: "var(--color-brand-softer)", border: "1px solid var(--color-border-brand-subtle)", color: "var(--color-fg-brand-strong)" }}
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Agent B Config */}
        <motion.div
          className="card p-5 space-y-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--color-brand-softer)", color: "var(--color-fg-brand-strong)" }}>
              <Shield size={16} />
            </div>
            <div>
              <h4 className="font-serif" style={labelStyle}>Agent B — The Vault</h4>
              <p className="text-xs" style={subtleStyle}>Execution & security configuration</p>
            </div>
          </div>

          {/* Primary RPC */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>Primary RPC</label>
            <input
              type="text"
              value={local.agentB.primaryRpc}
              onChange={(e) => updateB("primaryRpc", e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg font-mono focus:outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          {/* Fallback RPC */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>Fallback RPC</label>
            <input
              type="text"
              value={local.agentB.fallbackRpc}
              onChange={(e) => updateB("fallbackRpc", e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg font-mono focus:outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          {/* KMS Region */}
          <div>
            <label className="block text-sm font-medium mb-2" style={labelStyle}>KMS Region</label>
            <select
              value={local.agentB.kmsRegion}
              onChange={(e) => updateB("kmsRegion", e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg cursor-pointer focus:outline-none"
              style={inputStyle}
            >
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">EU (Ireland)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>

          {/* Autonomous Cap & Gas Buffer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={labelStyle}>Autonomous Cap</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={local.agentB.autonomousCap}
                  onChange={(e) => updateB("autonomousCap", Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                  style={inputStyle}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={subtleStyle}>ETH</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={labelStyle}>Gas Buffer</label>
              <div className="relative">
                <input
                  type="number"
                  value={local.agentB.gasBuffer}
                  onChange={(e) => updateB("gasBuffer", Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm rounded-lg focus:outline-none focus:ring-1"
                  style={inputStyle}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={subtleStyle}>%</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <motion.div
        className="flex flex-col sm:flex-row gap-3 justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors"
          style={{
            background: "var(--color-neutral-primary-soft)",
            border: "1px solid var(--color-border-default)",
            color: "var(--color-body)",
            borderRadius: "var(--radius-base)",
          }}
        >
          <RotateCcw size={15} /> Reset Changes
        </button>
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all btn-glint relative overflow-hidden"
          style={{
            background: "var(--color-brand)",
            color: "#fff",
            borderRadius: "var(--radius-base)",
          }}
        >
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.span key="saved" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                <Check size={15} /> Saved!
              </motion.span>
            ) : (
              <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                <Save size={15} /> Save Configuration
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </motion.div>
    </div>
  );
}
