"use client";

import { useDashboard, type GasDataPoint, type TvlDataPoint, type SuccessDataPoint } from "./DashboardContext";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { motion } from "motion/react";
import { BarChart3, TrendingUp, Activity, Zap } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/** ── Design System Chart Colors ─────────────────────────────
 *  Mapped from CSS custom properties in globals.css.
 *  Recharts requires hex values — these are the resolved palette.
 *  Update here when the design tokens change.
 */
const CHART_COLORS_DARK = {
  brand:    "#42344B", // var(--color-brand)
  accent:   "#6E5A7C", // var(--color-accent-purple)
  success:  "#6E9C7E", // var(--color-success)
  danger:   "#C9596A", // var(--color-danger)
  warning:  "#D49A5A", // var(--color-warning)
  grid:     "#221F2B", // var(--color-border-muted) / card surface
  muted:    "#A8A3B0", // var(--color-body-subtle)
} as const;

const CHART_COLORS_LIGHT = {
  brand:    "#6B4F8A", // var(--color-brand)
  accent:   "#7E5FA0", // var(--color-accent-purple)
  success:  "#2D7A4A", // var(--color-success)
  danger:   "#B91C3A", // var(--color-danger)
  warning:  "#A16B1A", // var(--color-warning)
  grid:     "#F0EDE8", // var(--color-border-muted)
  muted:    "#6B6380", // var(--color-body-subtle)
} as const;

function getChartColors(theme: Theme) {
  return theme === "light" ? CHART_COLORS_LIGHT : CHART_COLORS_DARK;
}

/* ── Custom Tooltip ─────────────────────────── */
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--color-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 12,
        padding: "8px 12px",
        backdropFilter: "blur(8px)",
      }}
    >
      <p style={{ color: "var(--color-heading)", fontSize: 12, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: 11 }}>
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
  const { theme } = useTheme();
  const CHART_COLORS = getChartColors(theme);

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
          <StatCard label="Latest Gas" value={`${latestGas} Gwei`} icon={Zap} color={CHART_COLORS.warning} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Current TVL" value={`$${(latestTvl / 1_000_000).toFixed(2)}M`} icon={TrendingUp} color={CHART_COLORS.success} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Weekly Success" value={totalSuccess.toString()} icon={BarChart3} color={CHART_COLORS.brand} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
          <StatCard label="Success Rate" value={`${successRate}%`} icon={Activity} color={CHART_COLORS.accent} />
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
                    <stop offset="5%" stopColor={CHART_COLORS.brand} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="time" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="tvl" stroke={CHART_COLORS.brand} strokeWidth={2} fill="url(#tvlGrad)" name="TVL" dot={{ r: 3, fill: CHART_COLORS.brand }} activeDot={{ r: 6, stroke: CHART_COLORS.brand, strokeWidth: 2 }} animationDuration={2000} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Gas Area Chart */}
        <motion.div
          className="card p-5"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <h4 className="mb-4 font-serif" style={{ color: "var(--color-heading)" }}>Gas Price (24h)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gasHistory}>
                <defs>
                  <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.warning} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.warning} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="time" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} unit=" Gwei" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="gwei" stroke={CHART_COLORS.warning} strokeWidth={2} fill="url(#gasGrad)" name="Gas" dot={{ r: 3, fill: CHART_COLORS.warning }} activeDot={{ r: 6, stroke: CHART_COLORS.warning, strokeWidth: 2 }} animationDuration={2000} animationEasing="ease-out" />
              </AreaChart>
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
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="time" tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: CHART_COLORS.muted }} />
                <Bar dataKey="success" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} name="Success" />
                <Bar dataKey="failed" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
