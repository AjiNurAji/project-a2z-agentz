"use client";
import { useDashboard, LogEntry } from "./DashboardContext";
import { useEffect, useRef, useState } from "react";
import { Terminal, ChevronDown, ChevronUp, Wifi } from "lucide-react";

const levelStyles: Record<LogEntry["level"], string> = {
  INFO:    "text-slate-400",
  WARN:    "text-amber-400",
  SUCCESS: "text-emerald-400",
  ERROR:   "text-brand-red",
  AGENT_A: "text-brand-accent",
  AGENT_B: "text-brand-purple",
};

const levelLabels: Record<LogEntry["level"], string> = {
  INFO: "SYS", WARN: "WARN", SUCCESS: "OK", ERROR: "ERR", AGENT_A: "SCT", AGENT_B: "VLT",
};

export default function LiveLog() {
  const { logs, agentAStatus } = useDashboard();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  return (
    <div className="glass-card flex flex-col h-80">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-brand-accent" aria-hidden="true" />
          <h2 className="font-heading text-sm font-semibold text-white">Agent A Live Log</h2>
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            agentAStatus === "online" ? "bg-emerald-500/10 text-emerald-400" :
            agentAStatus === "analyzing" ? "bg-amber-500/10 text-amber-400" : "bg-slate-700 text-slate-400"
          }`}>
            <Wifi className="w-2.5 h-2.5" aria-hidden="true" />
            {agentAStatus}
          </span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          aria-label={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
          title={autoScroll ? "Pause scroll" : "Resume scroll"}
        >
          {autoScroll ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Log Lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1"
        aria-live="polite"
        aria-label="Agent A activity log"
        role="log"
      >
        {[...logs].reverse().map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 leading-relaxed hover:bg-slate-800/30 px-1 rounded transition-colors">
            <span className="text-slate-600 flex-shrink-0 mt-0.5 tabular-nums">
              {entry.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className={`flex-shrink-0 w-7 text-center font-bold text-[10px] ${levelStyles[entry.level]}`}>
              {levelLabels[entry.level]}
            </span>
            <span className={`break-all ${levelStyles[entry.level]}`}>{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
