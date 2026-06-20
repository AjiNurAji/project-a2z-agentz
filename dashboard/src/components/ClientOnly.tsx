"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * Renders children only on the client side.
 * Prevents hydration mismatches from browser extensions
 * that inject attributes (e.g., bis_skin_checked) into the DOM.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
