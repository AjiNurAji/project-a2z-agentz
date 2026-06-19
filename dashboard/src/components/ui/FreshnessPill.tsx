"use client";

import { useDataFreshness } from "@/hooks/useDataFreshness";
import { RefreshCw } from "lucide-react";

interface FreshnessPillProps {
  lastSync: number; // epoch ms
  onRefresh?: () => void;
  compact?: boolean;
}

export function FreshnessPill({ lastSync, onRefresh, compact = false }: FreshnessPillProps) {
  const { label, color, status } = useDataFreshness(lastSync);
  const live = status === "fresh";

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${live ? "animate-pulse" : ""}`}
        style={{ background: color }}
        aria-hidden="true"
      />
      {!compact && <span>Live ·</span>}
      <span className="tabular-nums">{label}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="ml-0.5 hover:opacity-70 transition-opacity focus-ring rounded text-current"
          aria-label="Refresh data"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
