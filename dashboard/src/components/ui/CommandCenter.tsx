"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Maximize2, Minimize2, Clock, RefreshCw } from "lucide-react";

export function CommandCenterToggle() {
  const [active, setActive] = useState(false);
  const [time, setTime] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add("command-center");
    const sidebar = document.querySelector("[data-sidebar]");
    const navbar = document.querySelector("[data-navbar]");
    if (sidebar) (sidebar as HTMLElement).style.display = "none";
    if (navbar) (navbar as HTMLElement).style.display = "none";
    const mainContent = document.getElementById("main-content");
    if (mainContent) mainContent.style.padding = "0";

    // Auto-refresh visual indicator
    const refreshId = setInterval(() => {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1200);
    }, 30000);

    return () => {
      document.documentElement.classList.remove("command-center");
      if (sidebar) (sidebar as HTMLElement).style.display = "";
      if (navbar) (navbar as HTMLElement).style.display = "";
      if (mainContent) mainContent.style.padding = "";
      clearInterval(refreshId);
    };
  }, [active]);

  return (
    <div className="flex items-center gap-2">
      {/* Clock */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums"
            style={{
              background: "var(--color-neutral-secondary-medium)",
              color: "var(--color-heading)",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <Clock className="w-3 h-3" style={{ color: "var(--color-fg-brand)" }} />
            {time}
            <span className="text-[10px] ml-0.5" style={{ color: "var(--color-fg-disabled)" }}>WIB</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-refresh indicator */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--color-fg-success)" }}
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            Sync
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle */}
      <button
        onClick={() => setActive(!active)}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--color-neutral-secondary-medium)]"
        style={{
          color: active ? "var(--color-fg-brand)" : "var(--color-body-subtle)",
          border: active ? "1px solid var(--color-border-brand-subtle)" : "1px solid transparent",
        }}
        aria-label={active ? "Exit command center" : "Enter command center mode"}
        title={active ? "Exit Command Center (F11)" : "Command Center Mode"}
      >
        {active ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
