"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: Side;
}

const pos: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrow: Record<Side, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-[var(--color-neutral-tertiary-medium)] border-x-transparent border-b-transparent",
  bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-neutral-tertiary-medium)] border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-[var(--color-neutral-tertiary-medium)] border-y-transparent border-r-transparent",
  right: "right-full top-1/2 -translate-y-1/2 border-r-[var(--color-neutral-tertiary-medium)] border-y-transparent border-l-transparent",
};

const origin: Record<Side, string> = { top: "bottom", bottom: "top", left: "right", right: "left" };

export function Tooltip({ children, content, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timeout = useRef<NodeJS.Timeout | null>(null);
  const show = () => { if (timeout.current) clearTimeout(timeout.current); setOpen(true); };
  const hide = () => { timeout.current = setTimeout(() => setOpen(false), 100); };

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            role="tooltip"
            className={`absolute z-50 ${pos[side]}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ transformOrigin: origin[side] }}
          >
            <div className="bg-[var(--color-neutral-tertiary-medium)] text-[var(--color-heading)] text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
              {content}
            </div>
            <span className={`absolute w-0 h-0 border-[5px] ${arrow[side]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
