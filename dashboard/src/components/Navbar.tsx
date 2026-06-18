"use client";

import { useDashboard } from "./DashboardContext";
import { Bell, Cpu, Menu } from "lucide-react";
import { CommandCenterToggle } from "./ui/CommandCenter";
import { ThemeToggle } from "./ui/ThemeToggle";
import { motion } from "motion/react";

export default function Navbar() {
  const { kpiMetrics, agentAStatus, agentBStatus, setSidebarOpen } = useDashboard();

  return (
    <motion.header
      data-navbar="true"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-30 w-full backdrop-blur-md border-b border-[var(--color-border-default)] px-4 md:px-6 py-3"
      style={{ background: "color-mix(in srgb, var(--color-surface) 85%, transparent)" }}
    >
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
        {/* Left: hamburger + badges */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-xl text-[var(--color-body-subtle)] hover:text-[var(--color-heading)] hover:bg-[var(--color-neutral-secondary-medium)] focus-ring transition-colors"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[var(--color-body-subtle)]"
            style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-default)" }}
          >
            <Cpu className="w-3.5 h-3.5 text-[var(--color-fg-brand)]" aria-hidden="true" />
            <span>AMD MI300X · ROCm · vLLM</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[var(--color-body-subtle)]"
            style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-default)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-success)" }} aria-hidden="true" />
            <span>Base Network</span>
          </div>
        </div>

        {/* Right: alerts + agent pings */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
          <ThemeToggle />
          <CommandCenterToggle />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono hidden sm:inline-flex items-center" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)", border: "1px solid var(--color-border-default)" }}>⌘K</kbd>
          </div>
          {kpiMetrics.activeAlerts > 0 && (
            <button
              className="relative p-1.5 rounded-xl hover:bg-[var(--color-neutral-secondary-medium)] focus-ring transition-colors"
              aria-label={`${kpiMetrics.activeAlerts} pending approvals`}
            >
              <Bell className="w-5 h-5 text-[var(--color-body-subtle)]" aria-hidden="true" />
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[var(--color-heading)] text-[9px] flex items-center justify-center font-bold"
                style={{ background: "var(--color-warning)" }}
              >
                {kpiMetrics.activeAlerts}
              </span>
            </button>
          )}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  agentAStatus === "online" ? "" : agentAStatus === "analyzing" ? "animate-pulse" : ""
                }`}
                style={{
                  background: agentAStatus === "online"
                    ? "var(--color-success)"
                    : agentAStatus === "analyzing"
                    ? "var(--color-warning)"
                    : "var(--color-gray)",
                }}
                aria-hidden="true"
              />
              <span className="text-[var(--color-body-subtle)] hidden md:inline">Agent A</span>
              <span
                className="font-medium capitalize"
                style={{
                  color: agentAStatus === "online"
                    ? "var(--color-fg-success)"
                    : agentAStatus === "analyzing"
                    ? "var(--color-fg-warning)"
                    : "var(--color-fg-brand)",
                }}
              >
                {agentAStatus}
              </span>
            </div>
            <div className="w-px h-4" style={{ background: "var(--color-border-default)" }} aria-hidden="true" />
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  agentBStatus === "online" ? "" : agentBStatus === "executing" ? "animate-pulse" : ""
                }`}
                style={{
                  background: agentBStatus === "online"
                    ? "var(--color-success)"
                    : agentBStatus === "executing"
                    ? "var(--color-fg-brand)"
                    : "var(--color-gray)",
                }}
                aria-hidden="true"
              />
              <span className="text-[var(--color-body-subtle)] hidden md:inline">Agent B</span>
              <span
                className="font-medium capitalize"
                style={{
                  color: agentBStatus === "online"
                    ? "var(--color-fg-success)"
                    : "var(--color-fg-brand)",
                }}
              >
                {agentBStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
