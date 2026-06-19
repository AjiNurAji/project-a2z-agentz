"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setActive(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setActive(false), 1200);
    return () => { if (timeout.current) clearTimeout(timeout.current); };
  }, [pathname]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="route-progress"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
          className="fixed top-0 left-0 right-0 h-[3px] z-[9999] origin-left"
          style={{
            background: "linear-gradient(90deg, var(--color-brand), var(--color-brand-medium), #a855f7)",
          }}
        />
      )}
    </AnimatePresence>
  );
}
