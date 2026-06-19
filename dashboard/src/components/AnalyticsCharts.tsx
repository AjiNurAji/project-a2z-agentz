"use client";

import { useDashboard, type GasDataPoint, type TvlDataPoint, type SuccessDataPoint } from "./DashboardContext";
import { motion } from "motion/react";
import { BarChart3, TrendingUp, Activity, Zap } from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ── Custom Tooltip ─────────────────────────── */
function DarkTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg text-xs"
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      <p className="font-medium mb-1" style={{ color: "var(--color-heading)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

/* ── Summary Stat ───────────────────────────── */
function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div
      className="card flex items-center gap-3 p-4"
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>{label}</p>
        <p className="text-lg font-semibold" style={{ color: "var(--color-heading)" }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────── */
export default function AnalyticsCharts() {
  const { gasHistory, tvlHistory, successHistory } = useDashboard();

  const latestGas = gasHistory[gasHistory.length - 1]?.gwei ?? 0;
  const latestTvl = tvlHistory[tvlHistory.length - 1]?.tvl ?? 0;
  const totalSuccess = successHistory.reduce((s, d) => s + d.success, 0);
  const totalFailed = successHistory.reduce((s, d) => s + d.failed, 0);
  const successRate = totalSuccess + totalFailed > 0
    ? Math.round((totalSuccess / (totalSuccess + totalFailed)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Latest Gas" value={`${latestGas} Gwei`} icon={Zap} color="#D49A5A" />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Current TVL" value={`$${(latestTvl / 1_000_000).toFixed(2)}M`} icon={TrendingUp} color="#6E9C7E" />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Weekly Success" value={totalSuccess.toString()} icon={BarChart3} color="#42344B" />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Success Rate" value={`${successRate}%`} icon={Activity} color="#6E5A7C" />
        </motion.div>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TVL Area Chart */}
        <motion.div
          className="card p-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h4 className="mb-4 font-serif" style={{ color: "var(--color-heading)" }}>TVL Trend (30 Days)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tvlHistory}>
                <defs>
                  <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#42344B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#42344B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#221F2B" />
                <XAxis dataKey="time" tick={{ fill: "#A8A3B0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A8A3B0", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="tvl" stroke="#42344B" strokeWidth={2} fill="url(#tvlGrad)" name="TVL" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Gas Line Chart */}
        <motion.div
          className="card p-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <h4 className="mb-4 font-serif" style={{ color: "var(--color-heading)" }}>Gas Price (24h)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gasHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#221F2B" />
                <XAxis dataKey="time" tick={{ fill: "#A8A3B0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A8A3B0", fontSize: 11 }} axisLine={false} tickLine={false} unit=" Gwei" />
                <Tooltip content={<DarkTooltip />} />
                <Line type="monotone" dataKey="gwei" stroke="#D49A5A" strokeWidth={2} dot={false} name="Gas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Success/Failed Bar Chart */}
        <motion.div
          className="card p-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <h4 className="mb-4 font-serif" style={{ color: "var(--color-heading)" }}>Weekly Transactions</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={successHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#221F2B" />
                <XAxis dataKey="time" tick={{ fill: "#A8A3B0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#A8A3B0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#A8A3B0" }} />
                <Bar dataKey="success" fill="#6E9C7E" radius={[4, 4, 0, 0]} name="Success" />
                <Bar dataKey="failed" fill="#C9596A" radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
