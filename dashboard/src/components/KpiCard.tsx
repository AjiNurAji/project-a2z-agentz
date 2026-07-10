"use client";

import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Tooltip } from "@/components/ui/Tooltip";
import { useRef, useState, useEffect } from "react";
import { Sparkline } from "@/components/ui/Sparkline";

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  color?: "accent" | "purple" | "green" | "amber" | "red";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  index?: number;
  numericValue?: number;
  counterPrefix?: string;
  counterSuffix?: string;
  counterDecimals?: number;
  iconTooltip?: string;
  showPulse?: boolean;
  sparkData?: number[];
}

const colorMap = {
  accent: {
    icon: "var(--color-brand-strong)",
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
  numericValue, counterPrefix, counterSuffix, counterDecimals, iconTooltip, showPulse = false,
  sparkData,
}: KpiCardProps) {
  const c = colorMap[color];
  const prevValueRef = useRef<number | undefined>(numericValue);
  const [glowing, setGlowing] = useState(false);
  const [positiveChange, setPositiveChange] = useState(true);

  useEffect(() => {
    if (numericValue !== undefined && prevValueRef.current !== undefined && numericValue !== prevValueRef.current) {
      setPositiveChange(numericValue > prevValueRef.current);
      setGlowing(true);
      const timeout = setTimeout(() => setGlowing(false), 600);
      prevValueRef.current = numericValue;
      return () => clearTimeout(timeout);
    }
    prevValueRef.current = numericValue;
  }, [numericValue]);

  const boxShadow = glowing
    ? positiveChange
      ? "0 0 20px rgba(110, 156, 126, 0.3)"
      : "0 0 20px rgba(201, 89, 106, 0.3)"
    : "0 0 0px rgba(0, 0, 0, 0)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, boxShadow }}
      transition={{ delay: index * 0.05, duration: 0.3, boxShadow: { duration: 0.4, ease: "easeInOut" } }}
      className="card card-interactive p-5 flex flex-col gap-3 relative"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--color-body-subtle)]">{label}</p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.bg, border: `1px solid ${c.border}` }}
        >
          {iconTooltip ? (
            <Tooltip content={iconTooltip} side="left">
              <Icon className="w-5 h-5" style={{ color: c.icon }} aria-hidden="true" />
            </Tooltip>
          ) : (
            <Icon className="w-5 h-5" style={{ color: c.icon }} aria-hidden="true" />
          )}
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-bold text-[var(--color-heading)] tabular-nums"
          style={{ fontFamily: "var(--font-serif)" }}
          aria-live="polite"
        >
          {numericValue !== undefined ? (
            <AnimatedCounter
              value={numericValue}
              prefix={counterPrefix}
              suffix={counterSuffix}
              decimals={counterDecimals ?? 0}
            />
          ) : (
            value
          )}
        </p>
        {subValue && <p className="text-xs text-[var(--color-body-subtle)] mt-0.5">{subValue}</p>}
      </div>
      {sparkData && sparkData.length > 1 && (
        <div className="pt-1">
          <Sparkline data={sparkData} width={200} height={28} color={color === "green" ? "var(--color-success)" : color === "red" ? "var(--color-danger)" : "var(--color-fg-brand-strong)"} />
        </div>
      )}
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
          {trend === "up" && (
            <motion.span
              animate={glowing ? { y: [0, -4, 0] } : { y: 0 }}
              transition={{ duration: 0.5, repeat: glowing ? 1 : 0 }}
              className="inline-flex"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </motion.span>
          )}
          {trend === "down" && (
            <motion.span
              animate={glowing ? { y: [0, 4, 0] } : { y: 0 }}
              transition={{ duration: 0.5, repeat: glowing ? 1 : 0 }}
              className="inline-flex"
            >
              <TrendingDown className="w-3.5 h-3.5" />
            </motion.span>
          )}
          <span>{trendValue}</span>
        </div>
      )}
      {showPulse && (
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: "2px solid var(--color-brand)",
            animation: "pulse-ring 1.5s infinite",
          }}
        />
      )}
    </motion.div>
  );
}
