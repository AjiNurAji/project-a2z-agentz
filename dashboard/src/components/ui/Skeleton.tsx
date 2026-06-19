"use client";

import { motion } from "motion/react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

function SkeletonPulse({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={`rounded-xl bg-[var(--color-neutral-primary-medium)] ${className}`}
      style={style}
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export function Skeleton({ variant = "text", width, height, lines = 1, className = "" }: SkeletonProps) {
  const style = {
    ...(width && { width: typeof width === "number" ? `${width}px` : width }),
    ...(height && { height: typeof height === "number" ? `${height}px` : height }),
  };

  if (variant === "circular") {
    return <SkeletonPulse className={`rounded-full w-10 h-10 ${className}`} />;
  }

  if (variant === "rectangular") {
    return <SkeletonPulse className={`h-20 ${className}`} style={style} />;
  }

  if (variant === "card") {
    return (
      <div className={`card p-5 space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <SkeletonPulse className="h-4 w-24" />
          <SkeletonPulse className="h-9 w-9 rounded-xl" />
        </div>
        <SkeletonPulse className="h-8 w-32" />
        <SkeletonPulse className="h-3 w-full" />
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonPulse
          key={i}
          className={`h-3.5 ${i === lines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

// ─── Composite Skeletons ────────────────────────────

export function KpiCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <SkeletonPulse className="h-4 w-20" />
        <SkeletonPulse className="h-9 w-9 rounded-xl" />
      </div>
      <SkeletonPulse className="h-7 w-28" />
      <SkeletonPulse className="h-3 w-16" />
    </div>
  );
}

export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-5 w-32" />
        <SkeletonPulse className="h-6 w-16 rounded-full" />
      </div>
      <SkeletonPulse className={`${height} rounded-xl`} />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-[var(--color-border-default)]">
        <SkeletonPulse className="h-5 w-40" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b border-[var(--color-border-default)] last:border-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="h-4 w-32" />
              <SkeletonPulse className="h-3 w-48" />
            </div>
            <SkeletonPulse className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatBubbleSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div className={`space-y-2 ${i % 2 === 0 ? "items-start" : "items-end"} flex flex-col`}>
            <SkeletonPulse className="h-3 w-16" />
            <SkeletonPulse className={`h-12 ${i % 2 === 0 ? "w-48" : "w-40"} rounded-2xl`} />
          </div>
        </div>
      ))}
    </div>
  );
}
