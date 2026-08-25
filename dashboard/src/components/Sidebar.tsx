"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./DashboardContext";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  LayoutDashboard, BarChart3, Brain, History, Settings,
  Activity, ShieldAlert, ChevronLeft, ChevronRight, X, Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkline } from "@/components/ui/Sparkline";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/memory", label: "Vector Memory", icon: Brain },
  { href: "/history", label: "Audit Trail", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    online: "bg-[var(--color-success)]",
    offline: "bg-[var(--color-gray)]",
    analyzing: "bg-[var(--color-warning)] animate-pulse",
    executing: "bg-[var(--color-fg-brand)] animate-pulse",
  };
  return (
    <span
      className={`w-2 h-2 rounded-full ${colors[status] || "bg-[var(--color-gray)]"}`}
      aria-hidden="true"
    />
  );
}



// Static heartbeat data to prevent random jumping on every render
const STATIC_HEARTBEAT = [0.5, 0.5, 0.6, 1.0, 0.2, 0.5, 0.5, 0.5, 0.4, 0.5];
function generateHeartbeatData(): number[] {
  return STATIC_HEARTBEAT;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, approvalQueue, agentAStatus, agentBStatus, isPaused } = useDashboard();

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-[var(--color-border-default)] ${!sidebarOpen ? "justify-center" : ""}`}>
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
          style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-brand-subtle)" }}
        >
          <img src="/images/logo/logo.svg" className="w-7 h-7 object-contain" alt="A2Z Logo" />
        </div>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-sm font-semibold text-[var(--color-heading)] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
                A2Z Agent
              </h1>
              <p className="text-[11px] text-[var(--color-body-subtle)]">Cloud GPU · Base</p>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="ml-auto lg:hidden p-1 rounded-md text-[var(--color-body-subtle)] hover:text-[var(--color-heading)] hover:bg-[var(--color-neutral-secondary-medium)] focus-ring transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" role="navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon }, index) => {
          const isActive = pathname === href;
          const badge =
            label === "Audit Trail" && approvalQueue.length > 0 ? approvalQueue.length :
            label === "Dashboard" && approvalQueue.length > 0 ? approvalQueue.length : 0;

          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Link
                  href={href}
                  onClick={() => {
                    // Close mobile sidebar on nav
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  title={!sidebarOpen ? label : undefined}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative min-h-[44px]
                  focus-ring
                  ${isActive
                    ? "text-[var(--color-heading)]"
                    : "text-[var(--color-body-subtle)] hover:text-[var(--color-heading)] hover:bg-[var(--color-neutral-secondary-medium)]"
                  }`}
                  style={isActive ? {
                    background: "linear-gradient(135deg, var(--color-brand-softer), var(--color-brand-soft))",
                    border: "1px solid var(--color-border-brand-subtle)",
                  } : undefined}
                >
                  {/* Pulsing dot for active page */}
                  {isActive && (
                    <motion.div
                      className="w-2 h-2 rounded-full"
                      style={{ background: "var(--color-fg-brand-strong)" }}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [1, 0, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? "text-[var(--color-fg-brand-strong)]" : "text-[var(--color-body-subtle)] group-hover:text-[var(--color-body)]"}`}
                    aria-hidden="true"
                  />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        className="flex-1 flex items-center"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <span className="flex-1 truncate">{label}</span>
                        {badge > 0 && (
                          <span
                            className="ml-2 text-[var(--color-heading)] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                            style={{ background: label === "Audit Trail" ? "var(--color-danger)" : "var(--color-warning)" }}
                          >
                            {badge}
                          </span>
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Active indicator bar */}
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                      style={{ background: "var(--color-fg-brand-strong)" }}
                    />
                  )}
                </Link>
              </motion.div>
            </motion.div>
          );
        })}
      </nav>

      {/* Agent Status Panel */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-3 pb-4 space-y-2"
          >
            <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-body-subtle)] mb-2">
              Agent Status
            </p>
            <div className="card p-3 space-y-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[var(--color-fg-brand)]" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--color-body)] truncate">Agent A (Scout)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip content={agentAStatus === "online" ? "Online — actively scanning" : agentAStatus === "analyzing" ? "Analyzing signals..." : agentAStatus === "executing" ? "Executing transaction" : "Offline"} side="right">
                      <StatusDot status={agentAStatus} />
                    </Tooltip>
                    <span className="text-[11px] text-[var(--color-body-subtle)] capitalize">{agentAStatus}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-5">
                  <span className="text-[10px] text-[var(--color-fg-disabled)]">Farcaster Scanner</span>
                  <span className="text-[10px] tabular-nums text-[var(--color-fg-disabled)]">~180ms</span>
                </div>
                <div className="flex items-center justify-between pl-5">
                  <span className="text-[10px] text-[var(--color-fg-disabled)]">Uptime (24h)</span>
                  <span className="text-[10px] tabular-nums text-[var(--color-fg-success)] font-medium">99.8%</span>
                </div>
                {/* Sparkline for Agent A */}
                <div className="pl-5 pt-1">
                  <Sparkline data={generateHeartbeatData()} color="var(--color-success)" />
                </div>
              </div>
              <div className="h-px" style={{ background: "var(--color-border-default)" }} />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-[var(--color-fg-purple)]" aria-hidden="true" />
                    <span className="text-xs font-medium text-[var(--color-body)] truncate">Agent B (Vault)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip content={isPaused ? "Paused — human override" : agentBStatus === "online" ? "Online — awaiting payloads" : agentBStatus === "executing" ? "Executing on Base mainnet" : agentBStatus === "analyzing" ? "Verifying payload" : "Offline"} side="right">
                      <StatusDot status={isPaused ? "offline" : agentBStatus} />
                    </Tooltip>
                    <span className="text-[11px] text-[var(--color-body-subtle)] capitalize">
                      {isPaused ? "paused" : agentBStatus}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-5">
                  <span className="text-[10px] text-[var(--color-fg-disabled)]">Base Network (8453)</span>
                  <span className="text-[10px] tabular-nums text-[var(--color-fg-disabled)] font-medium">Connected</span>
                </div>
                <div className="flex items-center justify-between pl-5">
                  <span className="text-[10px] text-[var(--color-fg-disabled)]">Uptime (24h)</span>
                  <span className="text-[10px] tabular-nums text-[var(--color-fg-success)] font-medium">99.9%</span>
                </div>
                {/* Sparkline for Agent B */}
                <div className="pl-5 pt-1">
                  <Sparkline data={generateHeartbeatData()} color="var(--color-success)" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard navigation hint */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 pb-2 text-[10px]"
            style={{ color: "var(--color-fg-disabled)" }}
          >
            Press <kbd className="font-mono px-1 rounded" style={{ background: "var(--color-neutral-secondary-medium)" }}>1</kbd>-<kbd className="font-mono px-1 rounded" style={{ background: "var(--color-neutral-secondary-medium)" }}>5</kbd> to navigate
          </motion.p>
        )}
      </AnimatePresence>

      {/* Collapse Toggle — desktop only */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className="hidden lg:flex flex-col items-center justify-center gap-1.5 h-16 border-t border-[var(--color-border-default)] text-[var(--color-body-subtle)] hover:text-[var(--color-heading)] hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring"
      >
        {!sidebarOpen && (
          <div className="flex items-center gap-1 px-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: agentAStatus === "online" ? "var(--color-success)" : agentAStatus === "analyzing" ? "var(--color-warning)" : "var(--color-gray)" }} title={`Agent A: ${agentAStatus}`} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isPaused ? "var(--color-danger)" : agentBStatus === "online" ? "var(--color-success)" : agentBStatus === "executing" ? "var(--color-fg-brand)" : "var(--color-gray)" }} title={`Agent B: ${isPaused ? "paused" : agentBStatus}`} />
          </div>
        )}
        {sidebarOpen ? <ChevronLeft className="w-4.5 h-4.5" /> : <ChevronRight className="w-4.5 h-4.5" />}
      </button>
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.aside
        data-sidebar="true"
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          flex flex-col h-screen
          bg-[var(--color-sidebar)] border-r border-[var(--color-border-default)]
          transition-none lg:transition-all lg:duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        animate={{ width: sidebarOpen ? 256 : 72 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        aria-label="Main navigation"
      >
        {sidebarContent}
      </motion.aside>
    </>
  );
}
