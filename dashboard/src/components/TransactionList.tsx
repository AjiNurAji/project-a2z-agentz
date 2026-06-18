"use client";
import { useDashboard, type Transaction } from "./DashboardContext";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2, XCircle, Clock, ArrowUpRight,
  ChevronDown, ChevronRight, Zap,
} from "lucide-react";

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  success: {
    bg: "var(--color-success-soft)",
    text: "var(--color-fg-success)",
    border: "var(--color-border-success-subtle)",
  },
  failed: {
    bg: "var(--color-danger-soft)",
    text: "var(--color-fg-danger)",
    border: "var(--color-border-danger-subtle)",
  },
  pending: {
    bg: "var(--color-warning-soft)",
    text: "var(--color-fg-warning)",
    border: "var(--color-border-warning-subtle)",
  },
};

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const s = STATUS_STYLES[status];
  const Icon = status === "success" ? CheckCircle2 : status === "failed" ? XCircle : Clock;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function ExpandableDetail({ tx }: { tx: Transaction }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="overflow-hidden"
    >
      <div
        className="px-4 sm:px-5 py-3"
        style={{
          background: "var(--color-neutral-secondary-medium)",
          borderBottom: "1px solid var(--color-border-muted)",
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-20" style={{ color: "var(--color-fg-disabled)" }}>Reason</span>
            <span style={{ color: "var(--color-body)" }}>{tx.reason}</span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-20" style={{ color: "var(--color-fg-disabled)" }}>Target</span>
            <span style={{ color: "var(--color-body)", fontFamily: "var(--font-mono)" }} className="truncate">
              {tx.targetAddress}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-20" style={{ color: "var(--color-fg-disabled)" }}>Gas Used</span>
            <span className="flex items-center gap-1" style={{ color: "var(--color-body)", fontFamily: "var(--font-mono)" }}>
              <Zap className="w-3 h-3" style={{ color: "var(--color-fg-warning)" }} />
              {tx.gasUsedGwei} Gwei
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-20" style={{ color: "var(--color-fg-disabled)" }}>Tx Hash</span>
            <span style={{ color: "var(--color-body)", fontFamily: "var(--font-mono)" }} className="break-all">
              {tx.txHash}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TxCard({ tx, expanded, onToggle }: { tx: Transaction; expanded: boolean; onToggle: () => void }) {
  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--color-neutral-primary-medium)",
        border: "1px solid var(--color-border-default)",
      }}
    >
      <div
        className="p-3.5 sm:p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate" style={{ color: "var(--color-heading)" }}>
                {tx.projectName}
              </span>
              <StatusBadge status={tx.status} />
            </div>
            <p
              className="text-[11px] mt-1 truncate"
              style={{ fontFamily: "var(--font-mono)", color: "var(--color-fg-disabled)" }}
            >
              {tx.targetAddress.slice(0, 24)}...
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p
              className="text-base font-bold tabular-nums"
              style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}
            >
              ${tx.amountUsd}
            </p>
            <p className="text-[11px] tabular-nums" style={{ color: "var(--color-fg-disabled)" }}>
              {tx.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" style={{ color: "var(--color-fg-warning)" }} />
            <span className="text-[11px] tabular-nums" style={{ color: "var(--color-fg-disabled)", fontFamily: "var(--font-mono)" }}>
              {tx.gasUsedGwei} Gwei
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://basescan.org/tx/${tx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View transaction on Basescan`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors"
              style={{ color: "var(--color-fg-purple)" }}
            >
              <ArrowUpRight className="w-3 h-3" />
              Basescan
            </a>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4" style={{ color: "var(--color-fg-disabled)" }} />
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <div
            className="px-4 py-3 space-y-2 text-xs"
            style={{ background: "var(--color-neutral-secondary-medium)", borderTop: "1px solid var(--color-border-muted)" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex gap-2">
                <span className="flex-shrink-0 w-16" style={{ color: "var(--color-fg-disabled)" }}>Reason</span>
                <span style={{ color: "var(--color-body)" }}>{tx.reason}</span>
              </div>
              <div className="flex gap-2">
                <span className="flex-shrink-0 w-16" style={{ color: "var(--color-fg-disabled)" }}>Target</span>
                <span style={{ color: "var(--color-body)", fontFamily: "var(--font-mono)" }} className="break-all">
                  {tx.targetAddress}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="flex-shrink-0 w-16" style={{ color: "var(--color-fg-disabled)" }}>Gas</span>
                <span style={{ color: "var(--color-body)", fontFamily: "var(--font-mono)" }}>{tx.gasUsedGwei} Gwei</span>
              </div>
              <div className="flex gap-2">
                <span className="flex-shrink-0 w-16" style={{ color: "var(--color-fg-disabled)" }}>Hash</span>
                <span style={{ color: "var(--color-body)", fontFamily: "var(--font-mono)" }} className="break-all text-[11px]">{tx.txHash}</span>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TransactionList() {
  const { transactions } = useDashboard();
  const [expanded, setExpanded] = useState<string | null>(null);
  const displayed = transactions.slice(0, 10);

  return (
    <div
      className="card flex flex-col h-full"
      style={{ borderRadius: "var(--radius-base)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-5 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-muted)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: "var(--color-success-soft)" }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--color-fg-success)" }} />
          </div>
          <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
            Recent Transactions
          </h5>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--color-fg-disabled)", fontFamily: "var(--font-mono)" }}>
            {transactions.length} total
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-fg-success)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: "var(--color-fg-success)" }} />
          Live
        </div>
      </div>

      {/* Desktop Table (hidden on mobile) */}
      <div className="hidden md:block flex-1 overflow-y-auto">
        <table className="w-full text-xs" role="table" aria-label="Recent blockchain transactions">
          <thead>
            <tr
              className="sticky top-0 z-10"
              style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border-muted)" }}
            >
              <th scope="col" className="text-left px-4 sm:px-5 py-2.5 font-medium" style={{ color: "var(--color-fg-disabled)" }}>Project</th>
              <th scope="col" className="text-right px-4 py-2.5 font-medium tabular-nums" style={{ color: "var(--color-fg-disabled)" }}>Amount</th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium" style={{ color: "var(--color-fg-disabled)" }}>Status</th>
              <th scope="col" className="text-right px-4 py-2.5 font-medium" style={{ color: "var(--color-fg-disabled)" }}>Time</th>
              <th scope="col" className="text-center px-3 py-2.5 font-medium" style={{ color: "var(--color-fg-disabled)" }}>Link</th>
            </tr>
          </thead>
            <AnimatePresence initial={false}>
              {displayed.map((tx) => (
                <motion.tbody key={tx.id}>
                  <motion.tr
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: "1px solid var(--color-border-muted)" }}
                    onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
                    aria-expanded={expanded === tx.id}
                  >
                    <td className="px-4 sm:px-5 py-2.5">
                      <span className="font-medium truncate block max-w-[140px]" style={{ color: "var(--color-heading)" }}>
                        {tx.projectName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--color-body)" }}>
                      ${tx.amountUsd}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--color-fg-disabled)" }}>
                      {tx.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <a
                        href={`https://basescan.org/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View transaction on Basescan`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/[0.05]"
                        style={{ color: "var(--color-fg-purple)" }}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {expanded === tx.id && (
                      <ExpandableDetail tx={tx} />
                    )}
                  </AnimatePresence>
                </motion.tbody>
              ))}
            </AnimatePresence>
            {displayed.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center" style={{ color: "var(--color-fg-disabled)" }}>
                    No transactions yet
                  </td>
                </tr>
              </tbody>
            )}
        </table>
      </div>

      {/* Mobile Cards (visible on mobile) */}
      <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {displayed.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: "var(--color-fg-disabled)" }}>
              No transactions yet
            </div>
          ) : (
            displayed.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 300, damping: 25 }}
              >
                <TxCard
                  tx={tx}
                  expanded={expanded === tx.id}
                  onToggle={() => setExpanded(expanded === tx.id ? null : tx.id)}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
