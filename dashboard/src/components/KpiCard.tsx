"use client";

import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: "accent" | "purple" | "green" | "amber" | "red";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

const colorMap = {
  accent: { icon: "text-brand-accent", glow: "shadow-brand-accent/10", ring: "from-brand-accent/20 to-transparent", bg: "bg-brand-accent/10" },
  purple: { icon: "text-brand-purple", glow: "shadow-brand-purple/10", ring: "from-brand-purple/20 to-transparent", bg: "bg-brand-purple/10" },
  green:  { icon: "text-emerald-400",  glow: "shadow-emerald-400/10",  ring: "from-emerald-400/20 to-transparent",  bg: "bg-emerald-400/10" },
  amber:  { icon: "text-amber-400",    glow: "shadow-amber-400/10",    ring: "from-amber-400/20 to-transparent",    bg: "bg-amber-400/10" },
  red:    { icon: "text-brand-red",    glow: "shadow-brand-red/10",    ring: "from-brand-red/20 to-transparent",    bg: "bg-brand-red/10" },
};

export default function KpiCard({ label, value, subValue, icon: Icon, color = "accent", trend, trendValue }: KpiCardProps) {
  const c = colorMap[color];
  return (
    <div className={`glass-card p-5 flex flex-col gap-3 hover:border-slate-700 transition-all duration-200 shadow-lg ${c.glow}`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className="font-heading text-2xl font-bold text-white tabular-nums">{value}</p>
        {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
      </div>
      {trend && trendValue && (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          trend === "up" ? "text-emerald-400" : trend === "down" ? "text-brand-red" : "text-slate-400"
        }`}>
          <span>{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}</span>
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
