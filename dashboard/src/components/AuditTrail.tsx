"use client";

import { useDashboard } from "./DashboardContext";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { History, Search, ChevronDown, ChevronRight, Hash, Clock, ExternalLink, Copy, FileText, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { exportToCSV } from "./ui/exportUtils";

interface AuditEntry {
  id: string;
  type: "transaction" | "approval";
  projectName: string;
  timestamp: Date;
  status: string;
  detail: Record<string, string>;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; icon: React.ElementType }> = {
  success: { bg: "var(--color-success-soft)", border: "var(--color-border-success-subtle)", text: "var(--color-fg-success-strong)", icon: CheckCircle2 },
  failed: { bg: "var(--color-danger-soft)", border: "var(--color-border-danger-subtle)", text: "var(--color-fg-danger-strong)", icon: XCircle },
  pending: { bg: "var(--color-warning-soft)", border: "var(--color-border-warning-subtle)", text: "var(--color-fg-warning)", icon: AlertTriangle },
  approved: { bg: "var(--color-success-soft)", border: "var(--color-border-success-subtle)", text: "var(--color-fg-success-strong)", icon: CheckCircle2 },
  rejected: { bg: "var(--color-danger-soft)", border: "var(--color-border-danger-subtle)", text: "var(--color-fg-danger-strong)", icon: XCircle },
};

export default function AuditTrail() {
  const { transactions, approvalQueue } = useDashboard();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const perPage = 10;

  // Merge transactions + approvals into unified audit entries
  const allEntries: AuditEntry[] = [
    ...transactions.map((tx) => ({
      id: tx.id,
      type: "transaction" as const,
      projectName: tx.projectName,
      timestamp: tx.timestamp,
      status: tx.status,
      detail: {
        Amount: `$${tx.amountUsd}`,
        "Tx Hash": tx.txHash,
        Address: tx.targetAddress,
        Gas: `${tx.gasUsedGwei} Gwei`,
        Reason: tx.reason,
      },
    })),
    ...approvalQueue.map((a) => ({
      id: a.id,
      type: "approval" as const,
      projectName: a.projectName,
      timestamp: a.createdAt,
      status: "pending",
      detail: {
        Amount: `$${a.amountUsd}`,
        "LLM Score": `${a.llmScore}/100`,
        Address: a.targetAddress,
        Signature: a.signature,
        Reason: a.reason,
      },
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const filtered = allEntries.filter((e) => {
    const matchSearch = e.projectName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageEntries = filtered.slice(page * perPage, (page + 1) * perPage);

  const stats = {
    total: allEntries.length,
    success: allEntries.filter((e) => e.status === "success").length,
    failed: allEntries.filter((e) => e.status === "failed").length,
    pending: allEntries.filter((e) => e.status === "pending").length,
  };

  const timeAgo = (d: Date) => {
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    return `${Math.floor(sec / 3600)}h ago`;
  };

  const handleExport = () => {
    const data = filtered.map((e) => ({
      type: e.type,
      project: e.projectName,
      status: e.status,
      timestamp: e.timestamp.toISOString(),
    }));
    exportToCSV(data, `a2z-audit-trail-${Date.now()}`);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      >
        {[
          { label: "Total Entries", value: stats.total, color: "var(--color-brand)" },
          { label: "Successful", value: stats.success, color: "var(--color-success)" },
          { label: "Failed", value: stats.failed, color: "var(--color-danger)" },
          { label: "Pending", value: stats.pending, color: "var(--color-warning)" },
        ].map((s) => (
          <motion.div
            key={s.label}
            className="card p-4"
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--color-body-subtle)" }}>{s.label}</p>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: s.color }}>{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-body-subtle)" }} />
          <input
            type="text"
            placeholder="Search by project name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
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
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-4 py-2.5 text-sm rounded-lg cursor-pointer focus:outline-none"
          style={{
            background: "var(--color-neutral-secondary-medium)",
            border: "1px solid var(--color-border-default-medium)",
            color: "var(--color-heading)",
          }}
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        {filtered.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--color-neutral-secondary-medium)]"
            style={{ color: "var(--color-body-subtle)", border: "1px solid var(--color-border-default-medium)" }}
          >
            <Download size={14} />
            Export CSV
          </button>
        )}
      </div>

      {/* Accordion Entries */}
      <div className="card overflow-hidden">
        <div
          className="divide-y"
          style={{ borderColor: "var(--color-border-default)" }}
        >
          <AnimatePresence>
            {pageEntries.map((entry, i) => {
              const isOpen = expandedId === entry.id;
              const st = STATUS_STYLES[entry.status] || STATUS_STYLES.pending;
              const StatusIcon = st.icon;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {/* Trigger */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                    style={{ background: isOpen ? "var(--color-neutral-tertiary-soft)" : "transparent" }}
                  >
                    <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                      <ChevronRight size={16} style={{ color: "var(--color-body-subtle)" }} />
                    </motion.div>
                    <StatusIcon size={16} style={{ color: st.text }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" style={{ color: "var(--color-heading)" }}>{entry.projectName}</span>
                    </div>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-md shrink-0" style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.text }}>
                      {entry.status}
                    </span>
                    <span className="text-xs shrink-0 flex items-center gap-1" style={{ color: "var(--color-body-subtle)" }}>
                      <Clock size={12} /> {timeAgo(entry.timestamp)}
                    </span>
                  </button>

                  {/* Panel */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 py-4 space-y-2" style={{ background: "var(--color-neutral-primary-soft)", borderTop: "1px solid var(--color-border-default)" }}>
                          {Object.entries(entry.detail).map(([key, val]) => (
                            <div key={key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                              <span className="text-xs font-medium shrink-0 w-24" style={{ color: "var(--color-body-subtle)" }}>{key}</span>
                              <span className="text-xs font-mono break-all" style={{ color: "var(--color-body)" }}>{val}</span>
                            </div>
                          ))}
                          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                            <span className="text-xs font-medium shrink-0 w-24" style={{ color: "var(--color-body-subtle)" }}>Type</span>
                            <span className="text-xs capitalize" style={{ color: "var(--color-body)" }}>{entry.type}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {pageEntries.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={36} className="mx-auto mb-3" style={{ color: "var(--color-body-subtle)" }} />
            <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>No audit entries found.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>
            Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1" style={{ fontSize: 14 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-l-lg text-sm font-medium disabled:opacity-40 transition-colors"
              style={{
                background: "var(--color-neutral-secondary-medium)",
                border: "1px solid var(--color-border-default-medium)",
                color: "var(--color-body)",
                borderRadius: "var(--radius-base) 0 0 var(--radius-base)",
              }}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="w-9 h-9 flex items-center justify-center text-sm font-medium transition-colors"
                style={{
                  background: i === page ? "var(--color-neutral-tertiary-medium)" : "var(--color-neutral-secondary-medium)",
                  color: i === page ? "var(--color-fg-brand)" : "var(--color-body)",
                  border: "1px solid var(--color-border-default-medium)",
                  marginLeft: i === 0 ? 0 : -1,
                }}
              >
                {i + 1}
              </button>
            ))}
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-r-lg text-sm font-medium disabled:opacity-40 transition-colors"
              style={{
                background: "var(--color-neutral-secondary-medium)",
                border: "1px solid var(--color-border-default-medium)",
                color: "var(--color-body)",
                borderRadius: "0 var(--radius-base) var(--radius-base) 0",
                marginLeft: -1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
