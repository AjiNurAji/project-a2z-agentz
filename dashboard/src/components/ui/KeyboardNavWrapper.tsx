"use client";

import { useKeyboardNav } from "./useKeyboardNav";

export function KeyboardNavWrapper({ children }: { children: React.ReactNode }) {
  useKeyboardNav();
  return <>{children}</>;
}
