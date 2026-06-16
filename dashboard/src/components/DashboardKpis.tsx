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
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        label="TVL Analyzed"
        value={formatTvl(kpiMetrics.totalTvlAnalyzed)}
        icon={TrendingUp}
        color="accent"
        trend="up"
        trendValue="Live tracking"
      />
      <KpiCard
        label="Success Rate"
        value={`${kpiMetrics.successRate}%`}
        icon={Activity}
        color="green"
        trend="up"
        trendValue="vs 72% avg"
      />
      <KpiCard
        label="Total Txs"
        value={kpiMetrics.totalTransactions}
        subValue="on Base Network"
        icon={Zap}
        color="purple"
      />
      <KpiCard
        label="Gas Saved"
        value={`$${kpiMetrics.gasSavedUsd}`}
        subValue="via oracle optimization"
        icon={Fuel}
        color="amber"
        trend="up"
        trendValue="+15% efficiency"
      />
      <KpiCard
        label="Projects Scanned"
        value={kpiMetrics.projectsScanned.toLocaleString()}
        subValue="Farcaster + Twitter"
        icon={ScanSearch}
        color="accent"
      />
      <KpiCard
        label="Active Alerts"
        value={kpiMetrics.activeAlerts}
        subValue="awaiting approval"
        icon={AlertTriangle}
        color={kpiMetrics.activeAlerts > 0 ? "red" : "green"}
        trend={kpiMetrics.activeAlerts > 0 ? "down" : "neutral"}
        trendValue={kpiMetrics.activeAlerts > 0 ? "Action needed" : "All clear"}
      />
    </div>
  );
}
