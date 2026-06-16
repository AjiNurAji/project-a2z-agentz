"use client";
import { useDashboard } from "./DashboardContext";
import { useState } from "react";
import { Bot, ShieldAlert, Save, RotateCcw, Info } from "lucide-react";

interface InputFieldProps {
  id: string;
  label: string;
  helper?: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
}

function InputField({ id, label, helper, type = "text", value, onChange, min, max, step }: InputFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-300">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors"
      />
      {helper && <p className="text-xs text-slate-500 flex items-center gap-1"><Info className="w-3 h-3" aria-hidden="true" />{helper}</p>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children }: { title: string; icon: React.FC<{ className?: string }>; iconColor: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <h2 className="font-heading text-base font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function SliderField({ id, label, value, min, max, onChange, unit }: { id: string; label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-slate-300">{label}</label>
        <span className="text-sm font-mono font-semibold text-brand-accent tabular-nums">{value}{unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
      <div className="flex justify-between text-xs text-slate-600">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  const { config, setConfig } = useDashboard();
  const [localConfig, setLocalConfig] = useState(config);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setConfig(localConfig);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => setLocalConfig(config);

  const updateAgentA = (key: string, val: string | number) =>
    setLocalConfig(prev => ({ ...prev, agentA: { ...prev.agentA, [key]: val } }));

  const updateAgentB = (key: string, val: string | number) =>
    setLocalConfig(prev => ({ ...prev, agentB: { ...prev.agentB, [key]: val } }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Agent A */}
      <SectionCard title="Agent A — Scout Configuration" icon={Bot} iconColor="text-brand-accent">
        <InputField
          id="cronSchedule"
          label="Cron Schedule"
          helper='Standard cron format. Default "0 * * * *" runs every hour.'
          value={localConfig.agentA.cronSchedule}
          onChange={v => updateAgentA("cronSchedule", v)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SliderField
            id="sentimentWeight"
            label="LLM Sentiment Weight"
            value={localConfig.agentA.sentimentWeight}
            min={0}
            max={100}
            unit="%"
            onChange={v => {
              updateAgentA("sentimentWeight", v);
              updateAgentA("tvlWeight", 100 - v);
            }}
          />
          <SliderField
            id="tvlWeight"
            label="On-Chain TVL Weight"
            value={localConfig.agentA.tvlWeight}
            min={0}
            max={100}
            unit="%"
            onChange={v => {
              updateAgentA("tvlWeight", v);
              updateAgentA("sentimentWeight", 100 - v);
            }}
          />
        </div>
        <SliderField
          id="scoreThreshold"
          label="Score Threshold (min to trigger Agent B)"
          value={localConfig.agentA.scoreThreshold}
          min={50}
          max={100}
          onChange={v => updateAgentA("scoreThreshold", v)}
        />
      </SectionCard>

      {/* Agent B */}
      <SectionCard title="Agent B — Vault Configuration" icon={ShieldAlert} iconColor="text-brand-purple">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InputField
            id="primaryRpc"
            label="Primary RPC Endpoint"
            helper="Alchemy Base Mainnet recommended"
            value={localConfig.agentB.primaryRpc}
            onChange={v => updateAgentB("primaryRpc", v)}
          />
          <InputField
            id="fallbackRpc"
            label="Fallback RPC Endpoint"
            helper="Used if primary RPC times out"
            value={localConfig.agentB.fallbackRpc}
            onChange={v => updateAgentB("fallbackRpc", v)}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <InputField
            id="kmsRegion"
            label="AWS KMS Region"
            helper="Region where private key is stored"
            value={localConfig.agentB.kmsRegion}
            onChange={v => updateAgentB("kmsRegion", v)}
          />
          <SliderField
            id="autonomousCap"
            label="Autonomous Transaction Cap"
            value={localConfig.agentB.autonomousCap}
            min={0.5}
            max={10}
            unit=" USD"
            onChange={v => updateAgentB("autonomousCap", v)}
          />
        </div>
        <SliderField
          id="gasBuffer"
          label="Gas Buffer Above Market Rate"
          value={localConfig.agentB.gasBuffer}
          min={5}
          max={50}
          unit="%"
          onChange={v => updateAgentB("gasBuffer", v)}
        />
      </SectionCard>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent min-h-[44px] ${
            saved
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-brand-accent/15 text-brand-accent border border-brand-accent/30 hover:bg-brand-accent/25"
          }`}
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          {saved ? "Saved!" : "Save Configuration"}
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 min-h-[44px]"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
}
