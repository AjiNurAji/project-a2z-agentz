'use client';
import { useState, useEffect } from 'react';

export type FreshnessStatus = 'fresh' | 'stale' | 'dead';

export interface Freshness {
  seconds: number;
  label: string;
  status: FreshnessStatus;
  color: string;
}

function build(seconds: number): Freshness {
  let status: FreshnessStatus;
  let color: string;
  if (seconds < 10) { status = 'fresh'; color = 'var(--color-success)'; }
  else if (seconds < 60) { status = 'stale'; color = 'var(--color-warning)'; }
  else { status = 'dead'; color = 'var(--color-danger)'; }
  const label = seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
  return { seconds, label, status, color };
}

export function useDataFreshness(lastSync: number, intervalMs = 1000): Freshness {
  const [freshness, setFreshness] = useState<Freshness>(() =>
    build(Math.max(0, Math.floor((Date.now() - lastSync) / 1000)))
  );

  useEffect(() => {
    const tick = () => {
      const sec = Math.max(0, Math.floor((Date.now() - lastSync) / 1000));
      setFreshness(build(sec));
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [lastSync, intervalMs]);

  return freshness;
}
