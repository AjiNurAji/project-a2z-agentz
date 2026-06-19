"use client";
import { useDashboard } from "./DashboardContext";
import { motion, AnimatePresence } from "motion/react";
import { ListChecks, CheckCircle2, XCircle, Clock, Inbox, AlertTriangle } from "lucide-react";

export default function ApprovalQueue() {
  const { approvalQueue, handleApprove, handleReject } = useDashboard();

  return (
    <div
      className="card flex flex-col"
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
            style={{ background: "var(--color-warning-soft)" }}
          >
            <ListChecks className="w-3.5 h-3.5" style={{ color: "var(--color-fg-warning)" }} />
          </div>
          <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
            Manual Approval Queue
          </h5>
        </div>
        {approvalQueue.length > 0 && (
          <span
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border font-semibold"
            style={{
              background: "var(--color-warning-soft)",
              color: "var(--color-fg-warning)",
              borderColor: "var(--color-border-warning-subtle)",
            }}
          >
            <AlertTriangle className="w-3 h-3" />
            {approvalQueue.length} pending
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {approvalQueue.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center px-6"
            >
              <div
                className="flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                style={{ background: "var(--color-neutral-secondary-medium)" }}
              >
                <Inbox className="w-7 h-7" style={{ color: "var(--color-fg-disabled)" }} />
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--color-body-subtle)" }}>
                Queue is empty
              </p>
              <p className="text-xs mt-1.5" style={{ color: "var(--color-fg-disabled)" }}>
                All transactions are within the $2 autonomous limit
              </p>
            </motion.div>
          ) : (
            approvalQueue.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                  delay: index * 0.05,
                }}
                className="p-3.5 sm:p-4 space-y-3 rounded-xl"
                style={{
                  background: "var(--color-neutral-primary-medium)",
                  border: "1px solid var(--color-border-default)",
                }}
              >
                {/* Project + Amount Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--color-heading)" }}
                    >
                      {item.projectName}
                    </p>
                    <p
                      className="text-[11px] truncate mt-0.5"
                      style={{ fontFamily: "var(--font-mono)", color: "var(--color-fg-disabled)" }}
                    >
                      {item.targetAddress.slice(0, 20)}...
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p
                      className="text-lg font-bold tabular-nums"
                      style={{ color: "var(--color-fg-warning)", fontFamily: "var(--font-serif)" }}
                    >
                      ${item.amountUsd}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--color-fg-disabled)" }}>
                      Score:{" "}
                      <span className="font-semibold" style={{ color: "var(--color-fg-success)" }}>
                        {item.llmScore}/100
                      </span>
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <p
                  className="text-xs leading-relaxed line-clamp-2"
                  style={{ color: "var(--color-body-subtle)" }}
                >
                  {item.reason}
                </p>

                {/* Footer: Time + Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <div
                    className="flex items-center gap-1.5 text-[11px]"
                    style={{ color: "var(--color-fg-disabled)" }}
                  >
                    <Clock className="w-3 h-3" />
                    <span className="tabular-nums">
                      {item.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="ml-auto flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleReject(item.id)}
                      aria-label={`Reject transaction for ${item.projectName}`}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl transition-colors min-h-[36px]"
                      style={{
                        background: "var(--color-danger-soft)",
                        color: "var(--color-fg-danger)",
                        border: "1px solid var(--color-border-danger-subtle)",
                        borderRadius: "var(--radius-base)",
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleApprove(item.id)}
                      aria-label={`Approve transaction for ${item.projectName}`}
                      className="btn-glint flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-2xl transition-colors min-h-[36px]"
                      style={{
                        background: "var(--color-success-medium)",
                        color: "var(--color-fg-success-strong)",
                        border: "1px solid var(--color-border-success-subtle)",
                        borderRadius: "var(--radius-base)",
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
