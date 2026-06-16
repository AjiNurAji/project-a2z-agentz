"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./DashboardContext";
import {
  LayoutDashboard, BarChart3, Database, Settings, History,
  Bot, Zap, ShieldAlert, ChevronLeft, ChevronRight
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/memory", label: "Vector Memory", icon: Database },
  { href: "/history", label: "Audit Trail", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-emerald-400",
    offline: "bg-slate-500",
    analyzing: "bg-amber-400 animate-pulse",
    executing: "bg-brand-accent animate-pulse",
  };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? "bg-slate-500"}`} />;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { agentAStatus, agentBStatus, isPaused, approvalQueue } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out bg-slate-950 border-r border-slate-800 ${collapsed ? "w-16" : "w-60"}`}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-brand-purple to-brand-accent flex items-center justify-center shadow-lg shadow-brand-purple/30">
          <Zap className="w-5 h-5 text-white" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-heading font-bold text-white text-sm leading-tight">A2Z Agent</h1>
            <p className="text-slate-500 text-xs">AMD MI300X · Base</p>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" role="navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative min-h-[44px]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950
                ${isActive
                  ? "bg-brand-purple/15 text-white border border-brand-purple/30 shadow-sm shadow-brand-purple/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? "text-brand-accent" : "text-slate-500 group-hover:text-slate-300"}`}
                aria-hidden="true"
              />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {label === "Audit Trail" && approvalQueue.length > 0 && (
                    <span className="ml-auto bg-brand-red text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                      {approvalQueue.length}
                    </span>
                  )}
                  {label === "Dashboard" && approvalQueue.length > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {approvalQueue.length}
                    </span>
                  )}
                </>
              )}
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-accent rounded-r-full" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Agent Status Panel */}
      {!collapsed && (
        <div className="px-3 pb-4 space-y-2">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Agent Status</p>
          <div className="glass-card px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-brand-accent" aria-hidden="true" />
                <span className="text-xs text-slate-400 truncate">Agent A (Scout)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={agentAStatus} />
                <span className="text-xs text-slate-500 capitalize">{agentAStatus}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-brand-purple" aria-hidden="true" />
                <span className="text-xs text-slate-400 truncate">Agent B (Vault)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={isPaused ? "offline" : agentBStatus} />
                <span className="text-xs text-slate-500 capitalize">{isPaused ? "paused" : agentBStatus}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center justify-center h-12 border-t border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
