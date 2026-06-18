"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, LayoutDashboard, BarChart3, Brain, History, Settings,
  Zap, ArrowRight, Command
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  const commands: CommandItem[] = [
    { id: "dash", label: "Dashboard", description: "Mission Control overview", icon: LayoutDashboard, action: () => router.push("/"), category: "Pages" },
    { id: "analytics", label: "Analytics", description: "Charts & TVL trends", icon: BarChart3, action: () => router.push("/analytics"), category: "Pages" },
    { id: "memory", label: "Vector Memory", description: "ChromaDB explorer", icon: Brain, action: () => router.push("/memory"), category: "Pages" },
    { id: "history", label: "Audit Trail", description: "Transaction history", icon: History, action: () => router.push("/history"), category: "Pages" },
    { id: "settings", label: "Settings", description: "Agent configuration", icon: Settings, action: () => router.push("/settings"), category: "Pages" },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.description.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const execute = useCallback((cmd: CommandItem) => {
    cmd.action();
    setOpen(false);
    setQuery("");
  }, []);

  // Global hotkey: Cmd/Ctrl+K toggles, Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) triggerRef.current = document.activeElement as HTMLElement;
          return !prev;
        });
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus trap + return focus on close
  useEffect(() => {
    if (!open) {
      triggerRef.current?.focus();
      return;
    }

    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          />
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg"
          >
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{ background: "var(--color-card)", border: "1px solid var(--color-border-default)" }}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--color-border-default)" }}>
                <Search className="w-5 h-5" style={{ color: "var(--color-body-subtle)" }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pages, actions..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-disabled)]"
                  style={{ color: "var(--color-heading)" }}
                  aria-label="Command palette"
                />
                <kbd className="text-[10px] px-1.5 py-0.5 rounded-md font-mono" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)" }}>
                  ESC
                </kbd>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider px-3 py-2" style={{ color: "var(--color-body-subtle)" }}>
                      {category}
                    </p>
                    {items.map((cmd) => {
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => execute(cmd)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-[var(--color-neutral-secondary-medium)] group"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--color-brand-softer)" }}>
                            <Icon className="w-4 h-4" style={{ color: "var(--color-fg-brand-strong)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "var(--color-heading)" }}>{cmd.label}</p>
                            <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>{cmd.description}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--color-body-subtle)" }} />
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-8 text-sm" style={{ color: "var(--color-body-subtle)" }}>
                    No results for &quot;{query}&quot;
                  </p>
                )}
              </div>
              <div className="px-4 py-2.5 border-t flex items-center gap-2" style={{ borderColor: "var(--color-border-default)" }}>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded-md font-mono" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)" }}>
                  <Command className="inline w-3 h-3" /> K
                </kbd>
                <span className="text-[11px]" style={{ color: "var(--color-body-subtle)" }}>to open</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
