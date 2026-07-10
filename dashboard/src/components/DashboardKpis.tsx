"use client";

import { useState, useEffect, useRef } from "react";
import { useDashboard } from "./DashboardContext";
import KpiCard from "./KpiCard";
import { Activity, TrendingUp, Zap, Fuel, ScanSearch, AlertTriangle } from "lucide-react";

export default function DashboardKpis() {
  const { kpiMetrics, tvlHistory, successHistory } = useDashboard();
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
        trendValue="Above 30-day average"
        iconTooltip="Total value locked across all scanned DeFi protocols"
        index={0}
        showPulse={lastChangedIndex === 0}
        sparkData={tvlHistory && tvlHistory.length > 0 ? tvlHistory.map(t => t.tvl / 1000000) : [0, 0, 0, 0]}
      />
      <KpiCard
        label="Success Rate"
        value={`${kpiMetrics.successRate}%`}
        numericValue={kpiMetrics.successRate}
        counterSuffix="%"
        counterDecimals={1}
        subValue="across all cycles"
        icon={Activity}
        color="green"
        trend="up"
        trendValue="Above 30-day average"
        iconTooltip="Percentage of transactions that completed successfully"
        index={1}
        showPulse={lastChangedIndex === 1}
        sparkData={successHistory && successHistory.length > 0 ? successHistory.map(s => s.success) : [0, 0, 0, 0]}
      />
      <KpiCard
        label="Total Txs"
        value={kpiMetrics.totalTransactions}
        numericValue={kpiMetrics.totalTransactions}
        counterDecimals={0}
        subValue="Base mainnet"
        icon={Zap}
        color="purple"
        iconTooltip="Total transactions executed on Base Network"
        index={2}
        showPulse={lastChangedIndex === 2}
        sparkData={successHistory && successHistory.length > 0 ? successHistory.map(s => s.success + s.failed) : [0, 0, 0, 0]}
      />
      <KpiCard
        label="Gas Saved"
        value={`$${kpiMetrics.gasSavedUsd}`}
        numericValue={kpiMetrics.gasSavedUsd}
        counterPrefix="$"
        counterDecimals={2}
        subValue="Oracle-optimized gas"
        icon={Fuel}
        color="amber"
        trend="up"
        trendValue="+15% vs last cycle"
        iconTooltip="Gas fees saved through oracle-based optimization"
        index={3}
        showPulse={lastChangedIndex === 3}
      />
      <KpiCard
        label="Projects Scanned"
        value={kpiMetrics.projectsScanned.toLocaleString()}
        numericValue={kpiMetrics.projectsScanned}
        counterDecimals={0}
        subValue="Farcaster + On-Chain"
        icon={ScanSearch}
        color="accent"
        iconTooltip="DeFi projects analyzed via Farcaster and on-chain signals"
        index={4}
        showPulse={lastChangedIndex === 4}
      />
      <KpiCard
        label="Active Alerts"
        value={kpiMetrics.activeAlerts}
        numericValue={kpiMetrics.activeAlerts}
        counterDecimals={0}
        subValue="Need review"
        icon={AlertTriangle}
        color={kpiMetrics.activeAlerts > 0 ? "red" : "green"}
        trend={kpiMetrics.activeAlerts > 0 ? "down" : "neutral"}
        trendValue={kpiMetrics.activeAlerts > 0 ? "Needs review" : "All clear"}
        iconTooltip="Pending approval requests requiring manual review"
        index={5}
        showPulse={lastChangedIndex === 5}
      />
    </div>
  );
}
