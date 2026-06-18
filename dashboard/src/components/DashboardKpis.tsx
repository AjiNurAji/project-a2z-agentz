"use client";

import { useDashboard } from "./DashboardContext";
import KpiCard from "./KpiCard";
import { Activity, TrendingUp, Zap, Fuel, ScanSearch, AlertTriangle } from "lucide-react";

function formatTvl(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function DashboardKpis() {
  const { kpiMetrics } = useDashboard();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        label="TVL Analyzed"
        value={formatTvl(kpiMetrics.totalTvlAnalyzed)}
        icon={TrendingUp}
        color="accent"
        trend="up"
        trendValue="Live tracking"
        index={0}
      />
      <KpiCard
        label="Success Rate"
        value={`${kpiMetrics.successRate}%`}
        icon={Activity}
        color="green"
        trend="up"
        trendValue="vs 72% avg"
        index={1}
      />
      <KpiCard
        label="Total Txs"
        value={kpiMetrics.totalTransactions}
        subValue="on Base Network"
        icon={Zap}
        color="purple"
        index={2}
      />
      <KpiCard
        label="Gas Saved"
        value={`$${kpiMetrics.gasSavedUsd}`}
        subValue="via oracle optimization"
        icon={Fuel}
        color="amber"
        trend="up"
        trendValue="+15% efficiency"
        index={3}
      />
      <KpiCard
        label="Projects Scanned"
        value={kpiMetrics.projectsScanned.toLocaleString()}
        subValue="Farcaster + Twitter"
        icon={ScanSearch}
        color="accent"
        index={4}
      />
      <KpiCard
        label="Active Alerts"
        value={kpiMetrics.activeAlerts}
        subValue="awaiting approval"
        icon={AlertTriangle}
        color={kpiMetrics.activeAlerts > 0 ? "red" : "green"}
        trend={kpiMetrics.activeAlerts > 0 ? "down" : "neutral"}
        trendValue={kpiMetrics.activeAlerts > 0 ? "Action needed" : "All clear"}
        index={5}
      />
    </div>
  );
}
