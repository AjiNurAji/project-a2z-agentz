"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCheck, Inbox, AlertTriangle, XCircle, Radio, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useDashboard, type AppNotification, type NotificationType } from "../DashboardContext";

const TYPE_META: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  approval: { icon: AlertTriangle, color: "var(--color-fg-warning)" },
  failure: { icon: XCircle, color: "var(--color-fg-danger)" },
  agent: { icon: Radio, color: "var(--color-fg-brand)" },
  threshold: { icon: TrendingUp, color: "var(--color-fg-success)" },
};

function timeAgo(d: Date): string {
  const dateObj = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - dateObj.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function NotificationsPanel() {
  const { notifications, unreadCount, markNotificationsRead, clearNotifications } = useDashboard();
  const [open, setOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && triggerEl && !triggerEl.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [open, triggerEl]);

  return (
    <>
      <button
        ref={setTriggerEl}
        onClick={() => { setOpen((o) => !o); if (!open) markNotificationsRead(); }}
        className="relative p-1.5 rounded-xl hover:bg-[var(--color-neutral-secondary-medium)] focus-ring transition-colors"
        aria-label={`${unreadCount} items need review — open notifications`}
      >
        <Bell className="w-5 h-5 text-[var(--color-body-subtle)]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[var(--color-heading)] text-[9px] flex items-center justify-center font-bold"
            style={{ background: "var(--color-danger)" }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && triggerEl && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed right-4 top-16 z-[9997] w-[min(92vw,360px)] rounded-2xl elevation-3 overflow-hidden"
              style={{ background: "var(--color-card)" }}
              role="dialog"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-muted)" }}>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" style={{ color: "var(--color-fg-brand-strong)" }} />
                  <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
                    Notifications
                  </h5>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "var(--color-danger)", color: "var(--color-heading)" }}>
                      {unreadCount}
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} className="flex items-center gap-1 text-[11px] hover:opacity-70 transition-opacity focus-ring rounded" style={{ color: "var(--color-body-subtle)" }}>
                    <CheckCheck className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <Inbox className="w-8 h-8 mb-2" style={{ color: "var(--color-fg-disabled)" }} />
                    <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>No notifications</p>
                  </div>
                ) : (
                  notifications.map((n: AppNotification) => {
                    const meta = TYPE_META[n.type];
                    const Icon = meta.icon;
                    return (
                      <Link
                        key={n.id}
                        href={n.link ?? "#"}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--color-neutral-secondary-medium)]"
                        style={{ borderBottom: "1px solid var(--color-border-muted)" }}
                      >
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--color-heading)" }}>{n.title}</p>
                          <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--color-body-subtle)" }}>{n.body}</p>
                          <p className="text-[10px] mt-1 tabular-nums" style={{ color: "var(--color-fg-disabled)" }}>{timeAgo(n.timestamp)}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "var(--color-brand)" }} />}
                      </Link>
                    );
                  })
                )}
              </div>

              <Link href="/history" onClick={() => setOpen(false)} className="block text-center text-xs py-2.5 hover:bg-[var(--color-neutral-secondary-medium)] transition-colors" style={{ color: "var(--color-fg-brand)", borderTop: "1px solid var(--color-border-muted)" }}>
                View all in Audit Trail
              </Link>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
