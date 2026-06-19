"use client";

import { motion } from "motion/react";

interface ScoreBreakdownProps {
  sentimentPct: number; // 0..100 weight
  tvlPct: number;       // 0..100 weight
  sentimentPts: number;
  tvlPts: number;
  total: number;
}

export function ScoreBreakdown({ sentimentPct, tvlPct, sentimentPts, tvlPts, total }: ScoreBreakdownProps) {
  return (
    <div className="mt-2">
      <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--color-neutral-tertiary)" }}>
        <motion.div
          className="h-full"
          style={{ background: "var(--color-accent-purple)" }}
          initial={{ width: 0 }}
          animate={{ width: `${sentimentPct}%` }}
          transition={{ duration: 0.6 }}
          title={`Sentiment ${sentimentPts}pts (${sentimentPct}%)`}
        />
        <motion.div
          className="h-full"
          style={{ background: "var(--color-accent-teal)" }}
          initial={{ width: 0 }}
          animate={{ width: `${tvlPct}%` }}
          transition={{ duration: 0.6 }}
          title={`TVL ${tvlPts}pts (${tvlPct}%)`}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: "var(--color-fg-disabled)" }}>
        <span>Sentiment {sentimentPts}pts</span>
        <span>TVL {tvlPts}pts</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--color-fg-success)" }}>Total {total}/100</span>
      </div>
    </div>
  );
}
