"use client";
import { useDashboard } from "./DashboardContext";
import { useState } from "react";
import { Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";

const STATUS_STYLES = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed:  "bg-brand-red/10 text-brand-red border-brand-red/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function TransactionList() {
  const { transactions } = useDashboard();
  const [expanded, setExpanded] = useState<string | null>(null);
  const displayed = transactions.slice(0, 8);

  return (
    <div className="glass-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <h2 className="font-heading text-sm font-semibold text-white">Recent Transactions</h2>
          <span className="text-xs text-slate-500 font-mono">{transactions.length} total</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs" role="table" aria-label="Recent blockchain transactions">
          <thead className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm">
            <tr className="border-b border-slate-800">
              <th scope="col" className="text-left px-4 py-2.5 font-medium text-slate-500">Project</th>
              <th scope="col" className="text-right px-4 py-2.5 font-medium text-slate-500 tabular-nums">Amount</th>
              <th scope="col" className="text-center px-4 py-2.5 font-medium text-slate-500">Status</th>
              <th scope="col" className="text-right px-4 py-2.5 font-medium text-slate-500 hidden sm:table-cell">Time</th>
              <th scope="col" className="text-center px-2 py-2.5 font-medium text-slate-500">Tx</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((tx, i) => (
              <>
                <tr
                  key={tx.id}
                  className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/30 cursor-pointer ${i % 2 === 0 ? "" : "bg-slate-900/20"}`}
                  onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
                  aria-expanded={expanded === tx.id}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-200 truncate block max-w-[120px]">{tx.projectName}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-300">${tx.amountUsd}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLES[tx.status]}`}>
                      {tx.status === "success" ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : tx.status === "failed" ? <XCircle className="w-3 h-3" aria-hidden="true" /> : <Clock className="w-3 h-3" aria-hidden="true" />}
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums hidden sm:table-cell">
                    {tx.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <a
                      href={`https://basescan.org/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View transaction ${tx.txHash.slice(0,8)}... on Basescan`}
                      onClick={e => e.stopPropagation()}
                      className="text-brand-accent hover:text-white transition-colors p-1 rounded inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </td>
                </tr>
                {expanded === tx.id && (
                  <tr key={`${tx.id}-detail`} className="bg-slate-800/30">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2"><span className="text-slate-500 w-24">Reason:</span><span className="text-slate-300">{tx.reason}</span></div>
                        <div className="flex gap-2"><span className="text-slate-500 w-24">Target:</span><span className="text-slate-300 font-mono">{tx.targetAddress}</span></div>
                        <div className="flex gap-2"><span className="text-slate-500 w-24">Gas Used:</span><span className="text-slate-300 font-mono">{tx.gasUsedGwei} Gwei</span></div>
                        <div className="flex gap-2"><span className="text-slate-500 w-24">Tx Hash:</span><span className="text-slate-300 font-mono break-all">{tx.txHash}</span></div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {displayed.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No transactions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
