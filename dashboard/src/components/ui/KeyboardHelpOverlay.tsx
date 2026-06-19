"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface ShortcutGroup {
  category: string;
  items: { keys: string[]; desc: string }[];
}

const GROUPS: ShortcutGroup[] = [
  { category: "Navigation", items: [
    { keys: ["1"], desc: "Dashboard" },
    { keys: ["2"], desc: "Analytics" },
    { keys: ["3"], desc: "Agents" },
    { keys: ["4"], desc: "Vector Memory" },
    { keys: ["5"], desc: "Audit Trail" },
    { keys: ["6"], desc: "Settings" },
  ]},
  { category: "Actions", items: [
    { keys: ["⌘", "K"], desc: "Open command palette" },
    { keys: ["?"], desc: "Show this help" },
    { keys: ["Esc"], desc: "Close dialogs" },
  ]},
  { category: "Accessibility", items: [
    { keys: ["Tab"], desc: "Move focus forward" },
    { keys: ["Shift", "Tab"], desc: "Move focus backward" },
    { keys: ["Enter"], desc: "Activate focused element" },
  ]},
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center justify-center min-w-[20px]" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)", border: "1px solid var(--color-border-default)" }}>
      {children}
    </kbd>
  );
}

export function KeyboardHelpOverlay() {
  const [open, setOpen] = useState(false);
  useKeyboardShortcut(["?"], () => setOpen((o) => !o));

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div
            className="fixed top-1/2 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
          >
            <div className="rounded-2xl elevation-3 p-5" style={{ background: "var(--color-card)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5" style={{ color: "var(--color-fg-brand-strong)" }} />
                  <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring">
                  <X className="w-4 h-4" style={{ color: "var(--color-body-subtle)" }} />
                </button>
              </div>
              <div className="space-y-4">
                {GROUPS.map((g) => (
                  <div key={g.category}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-body-subtle)" }}>{g.category}</p>
                    <div className="space-y-1.5">
                      {g.items.map((item) => (
                        <div key={item.desc} className="flex items-center justify-between gap-3">
                          <span className="text-xs" style={{ color: "var(--color-body)" }}>{item.desc}</span>
                          <div className="flex items-center gap-1">{item.keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
