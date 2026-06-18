"use client";
import { useDashboard, type LogEntry } from "./DashboardContext";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Terminal, ChevronDown, ChevronUp, Wifi, Radio } from "lucide-react";

const levelStyles: Record<LogEntry["level"], { text: string; badge: string }> = {
  INFO:    { text: "text-[#7F94AD]",   badge: "bg-[#7F94AD]/10 text-[#7F94AD] border-[#7F94AD]/20" },
  WARN:    { text: "text-[#E5B57A]",   badge: "bg-[#E5B57A]/10 text-[#E5B57A] border-[#E5B57A]/20" },
  SUCCESS: { text: "text-[#8AB89A]",   badge: "bg-[#8AB89A]/10 text-[#8AB89A] border-[#8AB89A]/20" },
  ERROR:   { text: "text-[#E08A92]",   badge: "bg-[#E08A92]/10 text-[#E08A92] border-[#E08A92]/20" },
  AGENT_A: { text: "text-[#A78FB5]",   badge: "bg-[#A78FB5]/10 text-[#A78FB5] border-[#A78FB5]/20" },
  AGENT_B: { text: "text-[#7FA8A8]",   badge: "bg-[#7FA8A8]/10 text-[#7FA8A8] border-[#7FA8A8]/20" },
};

const levelLabels: Record<LogEntry["level"], string> = {
  INFO: "SYS", WARN: "WRN", SUCCESS: "OK", ERROR: "ERR", AGENT_A: "SCT", AGENT_B: "VLT",
};

export default function LiveLog() {
  const { logs, agentAStatus } = useDashboard();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(logs.length);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  }, []);

  const statusColor =
    agentAStatus === "online" ? "#8AB89A" :
    agentAStatus === "analyzing" ? "#E5B57A" :
    "#6B6577";

  const reversed = [...logs].reverse();

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
            style={{ background: "var(--color-brand-softer)" }}
          >
            <Terminal className="w-3.5 h-3.5" style={{ color: "var(--color-fg-purple)" }} />
          </div>
          <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
            Agent A Live Log
          </h5>
          <span
            className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium"
            style={{
              background: `${statusColor}10`,
              color: statusColor,
              borderColor: `${statusColor}25`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse-glow"
              style={{ background: statusColor }}
            />
            {agentAStatus}
          </span>
        </div>

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
          {reversed.map((entry) => (
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
                className={`flex-shrink-0 w-8 text-center font-bold text-[9px] sm:text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${levelStyles[entry.level].badge}`}
              >
                {levelLabels[entry.level]}
              </span>
              <span
                className={`break-all text-[11px] sm:text-xs leading-relaxed ${levelStyles[entry.level].text}`}
              >
                {entry.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
