"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const PAGE_SHORTCUTS: Record<string, string> = {
  "1": "/",
  "2": "/analytics",
  "3": "/memory",
  "4": "/history",
  "5": "/settings",
};

export function useKeyboardNav() {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      // Page shortcuts 1-5
      if (PAGE_SHORTCUTS[e.key] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        router.push(PAGE_SHORTCUTS[e.key]);
      }

      // Escape to close mobile sidebar
      if (e.key === "Escape") {
        const sidebar = document.querySelector("[data-sidebar]");
        if (sidebar) sidebar.dispatchEvent(new CustomEvent("close-sidebar"));
      }

      // / to focus search
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>("[data-search-input]");
        if (searchInput) searchInput.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
}
