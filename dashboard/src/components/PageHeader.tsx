"use client";

import { LucideIcon } from "lucide-react";
import Breadcrumbs from "@/components/ui/Breadcrumbs";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export default function PageHeader({ title, description, icon: Icon, children }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <Breadcrumbs />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: "var(--color-brand-softer)",
                border: "1px solid var(--color-border-brand-subtle)",
              }}
            >
              <Icon className="w-5 h-5 text-[var(--color-fg-brand-strong)]" aria-hidden="true" />
            </div>
          )}
          <div>
            <h1
              className="text-xl font-semibold text-[var(--color-heading)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {title}
            </h1>
            {description && (
              <p className="text-sm text-[var(--color-body-subtle)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
