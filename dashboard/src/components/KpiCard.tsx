"use client";

import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "motion/react";

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: "accent" | "purple" | "green" | "amber" | "red";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  index?: number;
}

const colorMap = {
  accent: {
    icon: "var(--color-fg-brand-strong)",
    bg: "var(--color-brand-softer)",
    border: "var(--color-border-brand-subtle)",
  },
  purple: {
    icon: "var(--color-fg-purple)",
    bg: "var(--color-brand-softer)",
    border: "var(--color-border-brand-subtle)",
  },
  green: {
    icon: "var(--color-fg-success)",
    bg: "var(--color-success-soft)",
    border: "var(--color-border-success-subtle)",
  },
  amber: {
    icon: "var(--color-fg-warning)",
    bg: "var(--color-warning-soft)",
    border: "var(--color-border-warning-subtle)",
  },
  red: {
    icon: "var(--color-fg-danger)",
    bg: "var(--color-danger-soft)",
    border: "var(--color-border-danger-subtle)",
  },
};

export default function KpiCard({
  label, value, subValue, icon: Icon, color = "accent", trend, trendValue, index = 0,
}: KpiCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="card card-interactive p-5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--color-body-subtle)]">{label}</p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          <Icon className="w-5 h-5" style={{ color: c.icon }} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-bold text-[var(--color-heading)] tabular-nums"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {value}
        </p>
        {subValue && <p className="text-xs text-[var(--color-body-subtle)] mt-0.5">{subValue}</p>}
      </div>
      {trend && trendValue && (
        <div
          className="flex items-center gap-1 text-xs font-medium"
          style={{
            color:
              trend === "up"
                ? "var(--color-fg-success)"
                : trend === "down"
                ? "var(--color-fg-danger)"
                : "var(--color-body-subtle)",
          }}
        >
          {trend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
          {trend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
          <span>{trendValue}</span>
        </div>
      )}
    </motion.div>
  );
}
