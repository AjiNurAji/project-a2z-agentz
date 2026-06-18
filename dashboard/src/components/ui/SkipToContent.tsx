"use client";

export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-[var(--color-brand)] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:not-sr-only"
    >
      Skip to main content
    </a>
  );
}
