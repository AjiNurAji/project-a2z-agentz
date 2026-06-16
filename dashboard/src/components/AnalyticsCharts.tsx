"use client";
import { useDashboard } from "./DashboardContext";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const CHART_COLORS = {
  accent: "#38bdf8",
  purple: "#8a2be2",
  green: "#34d399",
  red: "#ff2a2a",
  amber: "#fbbf24",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-300 capitalize">{p.name}:</span>
          <span className="font-mono font-semibold text-white">{p.value}{unit ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-4">
        <h3 className="font-heading text-base font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsCharts() {
  const { tvlHistory, gasHistory, successHistory } = useDashboard();

  return (
    <div className="space-y-6">
      {/* TVL Area Chart */}
      <ChartCard title="TVL Trend Analysis" subtitle="Total Value Locked across all tracked Web3 projects (30 days)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={tvlHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="tvl" name="TVL" stroke={CHART_COLORS.accent} strokeWidth={2} fill="url(#tvlGrad)" dot={false} activeDot={{ r: 4, fill: CHART_COLORS.accent }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gas Price Line Chart */}
        <ChartCard title="Gas Price Tracker" subtitle="Real-time Base Network gas prices (last 24 hours)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={gasHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip unit=" Gwei" />} />
              <Line type="monotone" dataKey="gwei" name="Gas" stroke={CHART_COLORS.amber} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: CHART_COLORS.amber }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Success/Fail Bar Chart */}
        <ChartCard title="Transaction Success Rate" subtitle="Weekly breakdown of successful vs. failed on-chain transactions">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={successHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8", paddingTop: "8px" }} />
              <Bar dataKey="success" name="Success" fill={CHART_COLORS.green} radius={[3, 3, 0, 0]} />
              <Bar dataKey="failed" name="Failed" fill={CHART_COLORS.red} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Avg Gas Price", value: "42 Gwei", delta: "−8% vs last week" },
          { label: "Peak TVL (30d)", value: "$9.2M", delta: "+134% growth" },
          { label: "Best Day", value: "Friday", delta: "24 successful txs" },
          { label: "LLM Accuracy", value: "91.4%", delta: "Score > 85 threshold" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="font-heading text-lg font-bold text-white mt-1">{stat.value}</p>
            <p className="text-xs text-emerald-400 mt-0.5">{stat.delta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
