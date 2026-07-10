"use client";

import React, { useState, useRef, useEffect } from "react";

import { useDashboard } from "./DashboardContext";
import { useAuth } from "./AuthProvider";
import { Cpu, Menu, LogOut, User } from "lucide-react";
import { CommandCenterToggle } from "./ui/CommandCenter";
import { ThemeToggle } from "./ui/ThemeToggle";
import { NotificationsPanel } from "./ui/NotificationsPanel";
import { motion } from "motion/react";

export default function Navbar() {
  const { kpiMetrics, agentAStatus, agentBStatus, setSidebarOpen } = useDashboard();
  const { user, loading, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <NotificationsPanel />
          {/* User badge + logout */}
          {loading ? (
            <div className="w-20 h-7 rounded-full animate-pulse" style={{ background: "var(--color-neutral-secondary-medium)" }} />
          ) : user ? (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs hover:bg-[var(--color-neutral-secondary-medium)] transition-all focus-ring"
                style={{ 
                  background: profileOpen ? "var(--color-neutral-secondary-strong)" : "var(--color-neutral-secondary-medium)", 
                  border: "1px solid var(--color-border-default)" 
                }}
                aria-label="User profile menu"
                aria-expanded={profileOpen}
              >
                <User className="w-3.5 h-3.5" style={{ color: "var(--color-fg-brand)" }} aria-hidden="true" />
                <span className="text-[var(--color-heading)] font-medium max-w-[120px] truncate hidden sm:inline-block">
                  {user.email}
                </span>
              </button>

              {/* Profile Dropdown */}
              {profileOpen && (
                <div 
                  className="absolute right-0 mt-2 w-56 rounded-xl shadow-2xl overflow-hidden py-1 border z-50 origin-top-right animate-in fade-in slide-in-from-top-2"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border-default)",
                  }}
                >
                  <div className="px-4 py-3 border-b mb-1" style={{ borderColor: "var(--color-border-default)" }}>
                    <p className="text-[10px] font-bold tracking-wider uppercase mb-0.5" style={{ color: "var(--color-body-subtle)" }}>
                      Signed in as
                    </p>
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-heading)" }}>
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-ring"
                    style={{ color: "var(--color-fg-danger)" }}
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : null}
          <div className="hidden xl:flex items-center gap-3 text-xs">
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
