"use client";

import { useDashboard, type VectorMemoryItem } from "./DashboardContext";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Brain, Search, Filter, Database, Ban, Trash2, ExternalLink, Copy } from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  indexed: { bg: "var(--color-success-soft)", border: "var(--color-border-success-subtle)", text: "var(--color-fg-success-strong)" },
  processing: { bg: "var(--color-warning-soft)", border: "var(--color-border-warning-subtle)", text: "var(--color-fg-warning)" },
  blacklisted: { bg: "var(--color-danger-soft)", border: "var(--color-border-danger-subtle)", text: "var(--color-fg-danger-strong)" },
};

const SOURCE_COLORS: Record<string, string> = {
  Farcaster: "#A78FB5",
  Twitter: "#5C7A99",
  "On-Chain": "#609F89",
};

export default function VectorMemoryExplorer() {
  const { vectorMemory, handleBlacklist, handleClearCache } = useDashboard();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = vectorMemory.filter((item) => {
    const matchesSearch = item.projectName.toLowerCase().includes(search.toLowerCase()) ||
      item.contractAddress.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.embeddingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: vectorMemory.length,
    active: vectorMemory.filter((v) => v.embeddingStatus === "indexed").length,
    blacklisted: vectorMemory.filter((v) => v.embeddingStatus === "blacklisted").length,
    avgSimilarity: vectorMemory.length > 0
      ? (vectorMemory.reduce((s, v) => s + v.similarityScore, 0) / vectorMemory.length).toFixed(3)
      : "0",
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {[
          { label: "Total Entries", value: stats.total, icon: Database },
          { label: "Active", value: stats.active, icon: Brain },
          { label: "Blacklisted", value: stats.blacklisted, icon: Ban },
          { label: "Avg Similarity", value: stats.avgSimilarity, icon: Filter },
        ].map((s) => (
          <motion.div
            key={s.label}
            className="card p-4 flex items-center gap-3"
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--color-brand-softer)", color: "var(--color-fg-brand-strong)" }}>
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>{s.label}</p>
              <p className="text-lg font-semibold" style={{ color: "var(--color-heading)" }}>{s.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-body-subtle)" }} />
          <input
            type="text"
            placeholder="Search projects or addresses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg focus:outline-none"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              border: "1px solid var(--color-border-default-medium)",
              color: "var(--color-heading)",
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-sm rounded-lg focus:outline-none cursor-pointer"
          style={{
            background: "var(--color-neutral-secondary-medium)",
            border: "1px solid var(--color-border-default-medium)",
            color: "var(--color-heading)",
          }}
        >
          <option value="all">All Status</option>
          <option value="indexed">Indexed</option>
          <option value="processing">Processing</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
      </div>

      {/* Table / Cards */}
      {/* Desktop Table */}
      <div className="hidden md:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--color-neutral-secondary-soft)", borderBottom: "1px solid var(--color-border-default)" }}>
                <th className="text-left px-5 py-3 font-medium" style={{ color: "var(--color-body-subtle)" }}>Project</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: "var(--color-body-subtle)" }}>Source</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: "var(--color-body-subtle)" }}>Status</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: "var(--color-body-subtle)" }}>Similarity</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: "var(--color-body-subtle)" }}>TVL</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: "var(--color-body-subtle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((item, i) => {
                  const st = STATUS_COLORS[item.embeddingStatus] || STATUS_COLORS.indexed;
                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      style={{ borderBottom: "1px solid var(--color-border-muted)" }}
                      className="hover:opacity-90 transition-opacity"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: "var(--color-heading)" }}>{item.projectName}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-body-subtle)" }}>
                          {item.contractAddress.slice(0, 10)}...{item.contractAddress.slice(-6)}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: SOURCE_COLORS[item.source] || "var(--color-body)", background: `${SOURCE_COLORS[item.source] || "var(--color-body)"}15` }}>
                          {item.source}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-medium px-2.5 py-1 rounded-md capitalize" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                          {item.embeddingStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-neutral-tertiary)" }}>
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: item.similarityScore > 0.8 ? "var(--color-success)" : item.similarityScore > 0.6 ? "var(--color-warning)" : "var(--color-danger)" }}
                              initial={{ width: 0 }}
                              animate={{ width: `${item.similarityScore * 100}%` }}
                              transition={{ delay: i * 0.05, duration: 0.6 }}
                            />
                          </div>
                          <span className="text-xs tabular-nums" style={{ color: "var(--color-body)" }}>{item.similarityScore}</span>
                        </div>
                      </td>
                      <td className="text-right px-5 py-3 font-medium tabular-nums" style={{ color: "var(--color-heading)" }}>
                        ${(item.tvl / 1_000_000).toFixed(2)}M
                      </td>
                      <td className="text-right px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleBlacklist(item.id)}
                            className="p-1.5 rounded-md transition-colors hover:opacity-80"
                            style={{ color: "var(--color-fg-danger)" }}
                            title="Blacklist"
                          >
                            <Ban size={14} />
                          </button>
                          <button
                            onClick={() => handleClearCache(item.id)}
                            className="p-1.5 rounded-md transition-colors hover:opacity-80"
                            style={{ color: "var(--color-body-subtle)" }}
                            title="Clear cache"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        <AnimatePresence>
          {filtered.map((item, i) => {
            const st = STATUS_COLORS[item.embeddingStatus] || STATUS_COLORS.indexed;
            return (
              <motion.div
                key={item.id}
                className="card p-4 space-y-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium" style={{ color: "var(--color-heading)" }}>{item.projectName}</p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-body-subtle)" }}>
                      {item.contractAddress.slice(0, 10)}...
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md capitalize" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                    {item.embeddingStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: SOURCE_COLORS[item.source] }}>{item.source}</span>
                  <span style={{ color: "var(--color-heading)" }} className="font-medium">${(item.tvl / 1_000_000).toFixed(2)}M TVL</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-neutral-tertiary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${item.similarityScore * 100}%`, background: "var(--color-success)" }} />
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: "var(--color-body)" }}>{item.similarityScore}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleBlacklist(item.id)} className="flex-1 text-xs py-1.5 rounded-md font-medium" style={{ background: "var(--color-danger-soft)", color: "var(--color-fg-danger)", border: "1px solid var(--color-border-danger-subtle)" }}>
                    <Ban size={12} className="inline mr-1" /> Blacklist
                  </button>
                  <button onClick={() => handleClearCache(item.id)} className="flex-1 text-xs py-1.5 rounded-md font-medium" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)", border: "1px solid var(--color-border-default)" }}>
                    <Trash2 size={12} className="inline mr-1" /> Clear
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center">
          <Brain size={40} className="mx-auto mb-3" style={{ color: "var(--color-body-subtle)" }} />
          <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>No vector memory entries found.</p>
        </div>
      )}
    </div>
  );
}
