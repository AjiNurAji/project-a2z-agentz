"use client";

import { motion } from "motion/react";

interface RadialGaugeProps {
  value: number;       // 0..max
  max?: number;        // default 100
  size?: number;       // px, default 56
  stroke?: number;     // default 5
  label?: string;
}

function colorFor(pct: number): string {
  if (pct >= 0.85) return "var(--color-success)";
  if (pct >= 0.65) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function RadialGauge({ value, max = 100, size = 56, stroke = 5, label }: RadialGaugeProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - pct);
  const color = colorFor(pct);

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--color-neutral-tertiary)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--color-heading)" }}>
          {label ?? Math.round(value)}
        </span>
      </div>
    </div>
  );
}
