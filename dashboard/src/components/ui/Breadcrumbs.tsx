"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { motion } from "motion/react";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const items = [
    { label: "Home", href: "/" },
    ...segments.map((seg, i) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " "),
      href: "/" + segments.slice(0, i + 1).join("/"),
    })),
  ];

  return (
    <motion.nav
      aria-label="Breadcrumb"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-1 text-xs mb-3"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.href} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="w-3 h-3 text-[var(--color-body-faint)]" />
            )}
            {isLast ? (
              <span className="font-semibold text-white flex items-center gap-1">
                {i === 0 && <Home className="w-3 h-3" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-[var(--color-body-subtle)] hover:text-[var(--color-fg-brand)] transition-colors flex items-center gap-1"
              >
                {i === 0 && <Home className="w-3 h-3" />}
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </motion.nav>
  );
}
