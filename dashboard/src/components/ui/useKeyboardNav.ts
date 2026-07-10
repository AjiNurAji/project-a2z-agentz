"use client";

import { useRouter } from "next/navigation";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

const PAGE_SHORTCUTS: Record<string, string> = {
  "1": "/",
  "2": "/analytics",
  "3": "/memory",
  "4": "/history",
  "5": "/settings",
};

export function useKeyboardNav() {
  const router = useRouter();

  // Navigation shortcuts: 1-5
  useKeyboardShortcut(
    ["1", "2", "3", "4", "5"],
    (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const path = PAGE_SHORTCUTS[e.key];
        if (path) {
          router.push(path);
        }
      }
    },
    { preventDefault: true }
  );

  // Escape to close mobile sidebar
  useKeyboardShortcut(
    ["Escape"],
    () => {
      const sidebar = document.querySelector("[data-sidebar]");
      if (sidebar) {
        sidebar.dispatchEvent(new CustomEvent("close-sidebar"));
      }
    },
    { preventDefault: false }
  );

  // '/' to focus search input
  useKeyboardShortcut(
    ["/"],
    (e) => {
      if (!e.metaKey && !e.ctrlKey) {
        const searchInput = document.querySelector<HTMLInputElement>("[data-search-input]");
        if (searchInput) {
          searchInput.focus();
        }
      }
    },
    { preventDefault: true }
  );
}

