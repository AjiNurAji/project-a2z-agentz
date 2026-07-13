"use client";
import { useDashboard, type LogEntry } from "./DashboardContext";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, Radio } from "lucide-react";

const levelStyles: Record<LogEntry["level"], { textColor: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  INFO:    { textColor: "var(--color-body-subtle)",   badgeBg: "var(--color-neutral-tertiary-soft)", badgeText: "var(--color-body-subtle)",   badgeBorder: "var(--color-border-muted)" },
  WARN:    { textColor: "var(--color-warning)",       badgeBg: "var(--color-warning-soft)",          badgeText: "var(--color-warning)",       badgeBorder: "var(--color-warning)" },
  SUCCESS: { textColor: "var(--color-success)",       badgeBg: "var(--color-success-soft)",          badgeText: "var(--color-success)",       badgeBorder: "var(--color-success)" },
  ERROR:   { textColor: "var(--color-danger)",        badgeBg: "var(--color-danger-soft)",           badgeText: "var(--color-danger)",        badgeBorder: "var(--color-danger)" },
  AGENT_A: { textColor: "var(--color-fg-purple)",     badgeBg: "var(--color-brand-softer)",          badgeText: "var(--color-fg-purple)",     badgeBorder: "var(--color-brand-softer)" },
  AGENT_B: { textColor: "var(--color-fg-cyan)",       badgeBg: "var(--color-brand-softer)",          badgeText: "var(--color-fg-cyan)",       badgeBorder: "var(--color-brand-softer)" },
};

const levelLabels: Record<LogEntry["level"], string> = {
  INFO: "SYS", WARN: "WRN", SUCCESS: "OK", ERROR: "ERR", AGENT_A: "SCT", AGENT_B: "VLT",
};

export default function LiveLog() {
  const { agentMessages, agentAStatus } = useDashboard();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      const timeoutId = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 350);
      return () => clearTimeout(timeoutId);
    }
  }, [agentMessages, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  }, []);

  const statusColor =
    agentAStatus === "online" ? "var(--color-success)" :
    agentAStatus === "analyzing" ? "var(--color-warning)" :
    "var(--color-gray)";

  const reversed = [...agentMessages]
    .filter((m) => m.sender === "agent_a")
    .reverse();

  return (
    <div
      className="card flex flex-col h-[400px] transition-all duration-300"
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
            style={{ background: "var(--color-brand-soft)" }}
          >
            <Terminal className="w-3.5 h-3.5" style={{ color: "var(--color-fg-purple)" }} />
          </div>
          <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
            Agent A Live Log
          </h5>
          <span
            className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium"
            style={{
              background: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
              color: statusColor,
              borderColor: `color-mix(in srgb, ${statusColor} 25%, transparent)`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
              style={{ background: statusColor }}
            />
            {agentAStatus}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            aria-label={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
            style={{
              color: autoScroll ? "var(--color-fg-success)" : "var(--color-fg-disabled)",
              background: autoScroll ? "var(--color-success-soft)" : "transparent",
            }}
          >
            <Radio className="w-3 h-3" />
            {autoScroll ? "Live" : "Paused"}
          </button>
        </div>
      </div>

      {/* Log Lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-0.5"
        style={{ fontFamily: "var(--font-mono)" }}
        aria-live="polite"
        aria-label="Agent A activity log"
        role="log"
      >
          <AnimatePresence initial={false}>
            {reversed.map((entry) => {
              const level = (entry.sender === "agent_a" ? "AGENT_A" : "AGENT_B") as LogEntry["level"];
              const styles = levelStyles[level];
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: -12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="flex items-start gap-2 sm:gap-3 py-1 px-2 rounded-md hover:bg-white/[0.02] transition-colors group"
                >
                  <span
                    className="flex-shrink-0 mt-[1px] tabular-nums text-[10px] sm:text-[11px] pt-px"
                    style={{ color: "var(--color-fg-disabled)" }}
                  >
                    {entry.timestamp.toLocaleTimeString("en-US", {
                      hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </span>
                  <span
                    className="flex-shrink-0 w-8 text-center font-bold text-[9px] sm:text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                    style={{ background: `color-mix(in srgb, ${styles.badgeText} 10%, transparent)`, color: styles.badgeText, borderColor: `color-mix(in srgb, ${styles.badgeText} 20%, transparent)` }}
                  >
                    {levelLabels[level]}
                  </span>
                  <span
                    className="break-all text-[11px] sm:text-xs leading-relaxed"
                    style={{ color: styles.textColor }}
                  >
                    {entry.content}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
    </div>
  );
}
