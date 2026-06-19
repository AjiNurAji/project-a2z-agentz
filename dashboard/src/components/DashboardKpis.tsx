"use client";

import { useState, useEffect, useRef } from "react";
import { useDashboard } from "./DashboardContext";
import KpiCard from "./KpiCard";
import { Activity, TrendingUp, Zap, Fuel, ScanSearch, AlertTriangle } from "lucide-react";

export default function DashboardKpis() {
  const { kpiMetrics } = useDashboard();
  const prevMetricsRef = useRef(kpiMetrics);
  const [lastChangedIndex, setLastChangedIndex] = useState<number>(-1);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevMetricsRef.current;
    const metricsKeys = ["totalTvlAnalyzed", "successRate", "totalTransactions", "gasSavedUsd", "projectsScanned", "activeAlerts"] as const;
    for (let i = 0; i < metricsKeys.length; i++) {
      const key = metricsKeys[i];
      if (kpiMetrics[key] !== prev[key]) {
        setLastChangedIndex(i);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setLastChangedIndex(-1), 2000);
        break;
      }
    }
    prevMetricsRef.current = kpiMetrics;
  }, [kpiMetrics]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        label="TVL Analyzed"
        value={`$${(kpiMetrics.totalTvlAnalyzed / 1_000_000).toFixed(1)}M`}
        numericValue={kpiMetrics.totalTvlAnalyzed}
        counterPrefix="$"
        counterDecimals={2}
        icon={TrendingUp}
        color="accent"
        trend="up"
        trendValue="Live tracking"
        iconTooltip="Total value locked across all scanned DeFi protocols"
        index={0}
        showPulse={lastChangedIndex === 0}
      />
      <KpiCard
        label="Success Rate"
        value={`${kpiMetrics.successRate}%`}
        numericValue={kpiMetrics.successRate}
        counterSuffix="%"
        counterDecimals={1}
        icon={Activity}
        color="green"
        trend="up"
        trendValue="vs 72% avg"
        iconTooltip="Percentage of transactions that completed successfully"
        index={1}
        showPulse={lastChangedIndex === 1}
      />
      <KpiCard
        label="Total Txs"
        value={kpiMetrics.totalTransactions}
        numericValue={kpiMetrics.totalTransactions}
        counterDecimals={0}
        subValue="on Base Network"
        icon={Zap}
        color="purple"
        iconTooltip="Total transactions executed on Base Network"
        index={2}
        showPulse={lastChangedIndex === 2}
      />
      <KpiCard
        label="Gas Saved"
        value={`$${kpiMetrics.gasSavedUsd}`}
        numericValue={kpiMetrics.gasSavedUsd}
        counterPrefix="$"
        counterDecimals={2}
        subValue="via oracle optimization"
        icon={Fuel}
        color="amber"
        trend="up"
        trendValue="+15% efficiency"
        iconTooltip="Gas fees saved through oracle-based optimization"
        index={3}
        showPulse={lastChangedIndex === 3}
      />
      <KpiCard
        label="Projects Scanned"
        value={kpiMetrics.projectsScanned.toLocaleString()}
        numericValue={kpiMetrics.projectsScanned}
        counterDecimals={0}
        subValue="Farcaster + Twitter"
        icon={ScanSearch}
        color="accent"
        iconTooltip="DeFi projects analyzed via Farcaster and Twitter signals"
        index={4}
        showPulse={lastChangedIndex === 4}
      />
      <KpiCard
        label="Active Alerts"
        value={kpiMetrics.activeAlerts}
        numericValue={kpiMetrics.activeAlerts}
        counterDecimals={0}
        subValue="awaiting approval"
        icon={AlertTriangle}
        color={kpiMetrics.activeAlerts > 0 ? "red" : "green"}
        trend={kpiMetrics.activeAlerts > 0 ? "down" : "neutral"}
        trendValue={kpiMetrics.activeAlerts > 0 ? "Action needed" : "All clear"}
        iconTooltip="Pending approval requests requiring manual review"
        index={5}
        showPulse={lastChangedIndex === 5}
      />
    </div>
  );
}
