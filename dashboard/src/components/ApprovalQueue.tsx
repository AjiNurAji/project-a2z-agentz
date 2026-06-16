"use client";
import { useDashboard } from "./DashboardContext";
import { ListChecks, CheckCircle2, XCircle, Clock, Inbox } from "lucide-react";

export default function ApprovalQueue() {
  const { approvalQueue, handleApprove, handleReject } = useDashboard();

  return (
    <div className="glass-card flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <h2 className="font-heading text-sm font-semibold text-white">Manual Approval Queue</h2>
        </div>
        {approvalQueue.length > 0 && (
          <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full font-semibold">
            {approvalQueue.length} pending
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {approvalQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <Inbox className="w-10 h-10 text-slate-700 mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-400">Queue is empty</p>
            <p className="text-xs text-slate-600 mt-1">All transactions are within the $2 autonomous limit</p>
          </div>
        ) : (
          approvalQueue.map((item) => (
            <div key={item.id} className="p-4 space-y-3 hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.projectName}</p>
                  <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{item.targetAddress.slice(0, 20)}...</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-heading text-lg font-bold text-amber-400 tabular-nums">${item.amountUsd}</p>
                  <p className="text-xs text-slate-500">Score: <span className="text-emerald-400 font-semibold">{item.llmScore}/100</span></p>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{item.reason}</p>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-slate-600 text-xs">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>{item.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => handleReject(item.id)}
                    aria-label={`Reject transaction for ${item.projectName}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-red/30 text-brand-red bg-brand-red/5 hover:bg-brand-red/15 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red min-h-[44px]"
                  >
                    <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(item.id)}
                    aria-label={`Approve transaction for ${item.projectName}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
