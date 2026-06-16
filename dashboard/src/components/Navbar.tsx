"use client";
import { useDashboard } from "./DashboardContext";
import { Bell, Cpu } from "lucide-react";

export default function Navbar() {
  const { kpiMetrics, agentAStatus, agentBStatus } = useDashboard();
  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60 px-6 py-3">
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        {/* Left: AMD badge */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-brand-accent" aria-hidden="true" />
            <span>AMD MI300X · ROCm · vLLM</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span>Base Network</span>
          </div>
        </div>

        {/* Right: alerts + agent pings */}
        <div className="flex items-center gap-4">
          {kpiMetrics.activeAlerts > 0 && (
            <div className="relative" aria-label={`${kpiMetrics.activeAlerts} pending approvals`}>
              <Bell className="w-5 h-5 text-slate-400" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {kpiMetrics.activeAlerts}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${agentAStatus === "online" ? "bg-emerald-400" : agentAStatus === "analyzing" ? "bg-amber-400 animate-pulse" : "bg-slate-600"}`} aria-hidden="true" />
              <span className="text-slate-400 hidden md:inline">Agent A</span>
              <span className={`font-medium capitalize ${agentAStatus === "online" ? "text-emerald-400" : "text-amber-400"}`}>{agentAStatus}</span>
            </div>
            <div className="w-px h-4 bg-slate-700" aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${agentBStatus === "online" ? "bg-emerald-400" : agentBStatus === "executing" ? "bg-brand-accent animate-pulse" : "bg-slate-600"}`} aria-hidden="true" />
              <span className="text-slate-400 hidden md:inline">Agent B</span>
              <span className={`font-medium capitalize ${agentBStatus === "online" ? "text-emerald-400" : "text-brand-accent"}`}>{agentBStatus}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
