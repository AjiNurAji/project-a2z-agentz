# A2Z Agent Dashboard — Visual Evolution v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the A2Z Agent Dashboard visual identity, rewrite all copy to professional English, and add 10 new features (Agents page, Notifications, ConfirmModal, RadialGauge, Data Freshness, System Theme, Keyboard Help, Onboarding, Density Toggle, Empty/Loading consistency).

**Architecture:** Additive extension of the existing `DashboardContext` + new isolated hooks + new UI components following established patterns (CSS custom properties, motion/react, lucide-react). No new dependencies. No breaking changes to existing data shapes.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4, Motion (Framer Motion), Recharts 3, Lucide React, TypeScript 5.

**Verification gate:** This project has no test framework installed. Each task verifies via `npm run lint` (ESLint) + `npm run build` (Next.js production build = full TypeScript type-check) being clean, plus a manual visual check. Run all three from the `dashboard/` directory. Commands below assume cwd is `dashboard/`.

**Reference spec:** `docs/superpowers/specs/2026-06-19-visual-evolution-v3-design.md`

---

## File Structure

**New files (hooks):**
- `src/hooks/useChartColors.ts` — single source of chart colors from CSS vars
- `src/hooks/useDataFreshness.ts` — compute seconds-ago + status from a timestamp
- `src/hooks/usePreferences.ts` — localStorage-backed preferences (theme mode, density, onboarded)
- `src/hooks/useKeyboardShortcut.ts` — generalize key-binding pattern

**New files (UI components):**
- `src/components/ui/Sparkline.tsx` — extract reusable sparkline from Sidebar
- `src/components/ui/SegmentedControl.tsx` — reusable N-option toggle (theme, density)
- `src/components/ui/ConfirmModal.tsx` — portaled destructive-action confirmation
- `src/components/ui/RadialGauge.tsx` — SVG arc gauge for scores
- `src/components/ui/ScoreBreakdown.tsx` — sentiment vs TVL split bar
- `src/components/ui/FreshnessPill.tsx` — uses useDataFreshness
- `src/components/ui/NotificationsPanel.tsx` — dropdown for Bell
- `src/components/ui/KeyboardHelpOverlay.tsx` — `?` shortcut reference
- `src/components/ui/OnboardingTour.tsx` — first-run guided tour

**New files (pages):**
- `src/app/agents/page.tsx` — Agents overview
- `src/app/agents/loading.tsx` — skeleton

**Modified files (key ones):**
- `src/app/globals.css` — tokens, elevation, density, prefers-color-scheme
- `src/app/layout.tsx` — density class + theme resolve script
- `src/hooks/useTheme.ts` — support 'system' mode
- `src/components/DashboardContext.tsx` — additive state
- `src/components/AnalyticsCharts.tsx` — use useChartColors
- `src/components/KpiCard.tsx` + `DashboardKpis.tsx` — sparkline, freshness, copy
- `src/components/Navbar.tsx` — freshness pill, notifications, copy
- `src/components/Sidebar.tsx` — status dots collapsed, uptime, extract Sparkline
- `src/components/CircuitBreaker.tsx` + `ApprovalQueue.tsx` + `VectorMemoryExplorer.tsx` — ConfirmModal wiring + copy
- `src/components/ui/ThemeToggle.tsx` — SegmentedControl 3-mode
- All page headers + comm panel + live log + transaction list — copy

---

## Phase 1 — Foundation

### Task 1.1: Add new CSS tokens + elevation + density system

**Files:**
- Modify: `src/app/globals.css` (`:root` block ends ~line 120; add tokens; add elevation + density utilities near end ~line 386)

- [ ] **Step 1: Add new tokens to `:root`**

In `src/app/globals.css`, inside the `:root { ... }` block (before the closing `}` around line 119), add:

```css
  /* Accent (bright variants for data viz emphasis) */
  --color-accent-teal-bright: #4FB3A0;
  --color-accent-cyan-bright: #4FB8C9;
  --color-accent-sky-bright: #5C9FD6;

  /* Glow tokens for interactive hover states */
  --color-glow-brand: rgba(110, 90, 124, 0.35);
  --color-glow-danger: rgba(201, 89, 106, 0.35);
  --color-glow-success: rgba(110, 156, 126, 0.30);

  /* Spacing scale (density toggle multiplier) */
  --spacing-scale: 1;
```

- [ ] **Step 2: Add light-theme bright variants**

In the `html[data-theme="light"] { ... }` block (before its closing `}` around line 223), add:

```css
  /* Accent (bright variants for data viz emphasis) */
  --color-accent-teal-bright: #2D9B7A;
  --color-accent-cyan-bright: #0891B2;
  --color-accent-sky-bright: #3A8AB5;

  /* Glow tokens */
  --color-glow-brand: rgba(107, 79, 138, 0.18);
  --color-glow-danger: rgba(185, 28, 58, 0.18);
  --color-glow-success: rgba(45, 122, 74, 0.18);
```

- [ ] **Step 3: Add elevation utilities**

At the end of `globals.css` (after the mesh gradient block ~line 386), append:

```css
/* ── Elevation System ─────────────────────────── */
.elevation-1 {
  box-shadow: none;
  border: 1px solid var(--color-border-muted);
}
.elevation-2 {
  box-shadow: var(--shadow-xs);
  border: 1px solid var(--color-border-default);
}
.elevation-3 {
  box-shadow: var(--shadow-xl);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-border-default-strong);
}

/* ── Density System ───────────────────────────── */
html[data-density="compact"] { --spacing-scale: 0.85; }
html[data-density="comfortable"] { --spacing-scale: 1; }
html[data-density="spacious"] { --spacing-scale: 1.2; }

/* ── Hover Glow utility ───────────────────────── */
.glow-brand:hover { box-shadow: 0 0 24px var(--color-glow-brand); }
.glow-danger:hover { box-shadow: 0 0 24px var(--color-glow-danger); }
```

- [ ] **Step 4: Add prefers-color-scheme fallback (no stored theme)**

In `globals.css`, after the `html[data-theme="light"] .card { ... }` rule (around line 233), add:

```css
/* ── Auto theme: when no data-theme set, follow system ── */
@media (prefers-color-scheme: light) {
  html:not([data-theme]) {
    /* Mirror the light theme block by toggling the same attribute via JS.
       CSS-only fallback below re-declares key tokens. */
    --color-surface: #FAF9F7;
    --color-card: #FFFFFF;
    --color-heading: #1A1625;
    --color-body: #3D3650;
    --color-border-default: #E8E5EE;
  }
}
```

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run build`
Expected: both pass clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(css): add accent/glow tokens, elevation, density, prefers-color-scheme fallback"
```

---

### Task 1.2: Extend useTheme to support 'system' mode

**Files:**
- Modify: `src/hooks/useTheme.ts` (full rewrite — 28 lines)

- [ ] **Step 1: Rewrite useTheme with system support**

Replace entire contents of `src/hooks/useTheme.ts` with:

```ts
'use client';
import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode: ThemeMode): Theme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [theme, setThemeState] = useState<Theme>('dark');

  // Initialize from storage + apply
  useEffect(() => {
    const stored = localStorage.getItem('a2z-theme') as ThemeMode | null;
    const initialMode: ThemeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';
    const resolved = resolveTheme(initialMode);
    setModeState(initialMode);
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
  }, []);

  // React to system preference changes when in 'system' mode
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved: Theme = mq.matches ? 'dark' : 'light';
      setThemeState(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    const resolved = resolveTheme(m);
    setModeState(m);
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('a2z-theme', m);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setMode]);

  return { mode, theme, setMode, toggleTheme };
}
```

- [ ] **Step 2: Update layout inline script to resolve 'system' before paint**

In `src/app/layout.tsx`, replace the inline `<script>` in `<head>` (lines 64-65) with:

```tsx
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('a2z-theme');if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()` }} />
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: pass clean. Note: `ThemeToggle` still imports nothing from useTheme currently, but `AnalyticsCharts` imports `type Theme` — that type still exists, so no breakage.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTheme.ts src/app/layout.tsx
git commit -m "feat(theme): support 'system' mode with prefers-color-scheme + no-flash script"
```

---

### Task 1.3: Create useChartColors hook

**Files:**
- Create: `src/hooks/useChartColors.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useChartColors.ts`:

```ts
'use client';
import { useState, useEffect } from 'react';
import { useTheme } from './useTheme';

export interface ChartColors {
  brand: string;
  accent: string;
  success: string;
  danger: string;
  warning: string;
  teal: string;
  cyan: string;
  sky: string;
  grid: string;
  muted: string;
}

// Fallback defaults (dark) used pre-mount / SSR
const DARK_FALLBACK: ChartColors = {
  brand: '#42344B', accent: '#6E5A7C', success: '#6E9C7E', danger: '#C9596A',
  warning: '#D49A5A', teal: '#839788', cyan: '#5E8C8C', sky: '#5C7A99',
  grid: '#221F2B', muted: '#A8A3B0',
};

const LIGHT_FALLBACK: ChartColors = {
  brand: '#6B4F8A', accent: '#7E5FA0', success: '#2D7A4A', danger: '#B91C3A',
  warning: '#A16B1A', teal: '#4A8A68', cyan: '#0891B2', sky: '#4A8AB5',
  grid: '#F0EDE8', muted: '#6B6380',
};

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function useChartColors(): ChartColors {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(
    theme === 'light' ? LIGHT_FALLBACK : DARK_FALLBACK
  );

  useEffect(() => {
    const f = theme === 'light' ? LIGHT_FALLBACK : DARK_FALLBACK;
    setColors({
      brand: readVar('--color-brand', f.brand),
      accent: readVar('--color-accent-purple', f.accent),
      success: readVar('--color-success', f.success),
      danger: readVar('--color-danger', f.danger),
      warning: readVar('--color-warning', f.warning),
      teal: readVar('--color-accent-teal', f.teal),
      cyan: readVar('--color-accent-cyan', f.cyan),
      sky: readVar('--color-accent-sky', f.sky),
      grid: readVar('--color-border-muted', f.grid),
      muted: readVar('--color-body-subtle', f.muted),
    });
  }, [theme]);

  return colors;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useChartColors.ts
git commit -m "feat(hooks): add useChartColors — single source of chart colors from CSS vars"
```

---

### Task 1.4: Migrate AnalyticsCharts to useChartColors

**Files:**
- Modify: `src/components/AnalyticsCharts.tsx` (lines 1-39: imports + color constants; lines 84-88: usage)

- [ ] **Step 1: Replace imports and color constants**

In `src/components/AnalyticsCharts.tsx`, replace lines 1-39 (the import block + `CHART_COLORS_DARK`/`LIGHT`/`getChartColors`) with:

```tsx
"use client";

import { useDashboard, type GasDataPoint, type TvlDataPoint, type SuccessDataPoint } from "./DashboardContext";
import { useChartColors } from "@/hooks/useChartColors";
import { motion } from "motion/react";
import { BarChart3, TrendingUp, Activity, Zap } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// Use teal for success bars to differentiate from brand purple.
// Map semantic colors from useChartColors below.
```

- [ ] **Step 2: Update the component to use the hook**

In the same file, replace the lines defining `const { theme } = useTheme(); const CHART_COLORS = getChartColors(theme);` (around lines 86-88 inside `AnalyticsCharts`) with:

```tsx
  const CHART_COLORS = useChartColors();
```

Remove the now-unused `useTheme` import if it remains. The `Theme` type import is gone now.

- [ ] **Step 3: Update StatCard colors (optional semantic upgrade)**

The `StatCard` calls pass `CHART_COLORS.warning`, `CHART_COLORS.success`, etc. — these keys all still exist, so no changes needed there.

- [ ] **Step 4: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Then `npm run dev` → open `/analytics` → charts render with theme colors; toggle theme → charts update.

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalyticsCharts.tsx
git commit -m "refactor(analytics): use useChartColors hook, remove hardcoded hex constants"
```

---

## Phase 2 — Copy & Voice

### Task 2.1: Rewrite DashboardKpis copy

**Files:**
- Modify: `src/components/DashboardKpis.tsx` (props passed to each KpiCard, lines 31-111)

- [ ] **Step 1: Update trend/trendValue/subValue strings**

In `src/components/DashboardKpis.tsx`, update the six KpiCard props:

- TVL Analyzed: `trendValue="Live tracking"` → `trendValue="Above 30-day average"`
- Success Rate: `trendValue="vs 72% avg"` → `trendValue="Above 30-day average"`; `subValue` not set, add `subValue="across all cycles"`
- Total Txs: `subValue="on Base Network"` → `subValue="Base mainnet"`
- Gas Saved: `trendValue="+15% efficiency"` → `trendValue="+15% vs last cycle"`; `subValue="via oracle optimization"` → `subValue="Oracle-optimized gas"`
- Projects Scanned: unchanged (no trend), keep
- Active Alerts: `trendValue="Action needed"` → `trendValue="Needs review"`; `trendValue="All clear"` → `trendValue="All clear"` (keep, it's fine); `subValue="awaiting approval"` → `subValue="Need review"`

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardKpis.tsx
git commit -m "feat(copy): professional rewrite of KPI trend and subvalues"
```

---

### Task 2.2: Rewrite Circuit Breaker copy

**Files:**
- Modify: `src/components/CircuitBreaker.tsx` (description line 53-54, status badges 47-50, alert body 105-109)

- [ ] **Step 1: Update description, status, and alert text**

In `src/components/CircuitBreaker.tsx`:

- Line ~53 description: change
  `Emergency Kill Switch — halts all Agent B on-chain activity instantly.`
  to
  `Pause all Agent B on-chain execution. Transactions queue but are not broadcast until resumed.`

- Status badge (lines ~47-50): change `{isPaused ? "PAUSED" : "ACTIVE"}` to `{isPaused ? "Paused" : "Running"}`

- Alert body (lines ~105-109): change
  `<strong>SYSTEM PAUSED:</strong> All automated payouts are blocked. Agent B will not broadcast any transactions until you resume operations.`
  to
  `<strong>Execution paused.</strong> Agent B will not broadcast transactions. Queued items are preserved and can be resumed.`

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/CircuitBreaker.tsx
git commit -m "feat(copy): professional Circuit Breaker labels (Running/Paused, clear description)"
```

---

### Task 2.3: Rewrite page descriptions + remaining copy

**Files:**
- Modify: `src/app/page.tsx` (line 37), `src/app/analytics/page.tsx` (line 33), `src/app/memory/page.tsx` (line 32), `src/app/history/page.tsx` (line 33), `src/app/settings/page.tsx` (line 32)
- Modify: `src/components/ApprovalQueue.tsx` (reason text in DashboardContext + empty state), `src/components/LiveLog.tsx` (levelLabels), `src/components/AgentCommPanel.tsx` (empty states)

- [ ] **Step 1: Update each page's PageHeader description**

- `src/app/page.tsx` line ~37: `description="Real-time overview of all autonomous agent activity on Base Network"` → `description="Live activity of both autonomous agents on Base Network."`
- `src/app/analytics/page.tsx` line ~33: → `description="Agent performance, TVL trends, gas pricing, and transaction outcomes."`
- `src/app/memory/page.tsx` line ~32: → `description="Semantic memory cache. Indexed embeddings, similarity scores, and recognized project patterns."`
- `src/app/history/page.tsx` line ~33: → `description="Full transaction log — approvals, rejections, and signed payloads."`
- `src/app/settings/page.tsx` line ~32: → `description="Configure Agent A scoring, Agent B execution limits, and RPC endpoints."`

- [ ] **Step 2: Update approval reason + empty state**

In `src/components/DashboardContext.tsx`, function `genInitialApprovals` (~line 203), change the `reason` string to:
`"TVL exceeds $5M with strong KOL engagement. Amount is above the $2 autonomous limit and requires manual approval."`

In `src/components/ApprovalQueue.tsx` (~line 68), change EmptyState `description` to:
`"No pending approvals. Transactions under $2 execute automatically."`

In the same file, ApprovalQueue toast (line ~16): `toast.success("Transaction Approved", ...)` → `toast.success("Transaction approved", \`${item.projectName} ($${item.amountUsd}) forwarded to Agent B for execution\`)`. And line ~21 reject: `toast.warning("Transaction Rejected", ...)` → `toast.warning("Transaction rejected", \`${item.projectName} ($${item.amountUsd}) skipped\`)`.

- [ ] **Step 3: Update LiveLog level labels**

In `src/components/LiveLog.tsx`, `levelLabels` (lines ~16-18), change:
```ts
const levelLabels: Record<LogEntry["level"], string> = {
  INFO: "SYS", WARN: "WARN", SUCCESS: "OK", ERROR: "ERR", AGENT_A: "SCOUT", AGENT_B: "VAULT",
};
```
(`SCT`→`SCOUT` width may overflow the w-8 badge; widen badge to `w-10` on line ~134 className `w-8` → `w-10`.)

- [ ] **Step 4: Update AgentCommPanel empty states**

In `src/components/AgentCommPanel.tsx` (~line 418): `Waiting for agents...` → `Connecting to agents`. (~line 421): `Agent A (Scout) and Agent B (Vault) will appear here` → `Scout and Vault messages will appear here`.

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/analytics/page.tsx src/app/memory/page.tsx src/app/history/page.tsx src/app/settings/page.tsx src/components/DashboardContext.tsx src/components/ApprovalQueue.tsx src/components/LiveLog.tsx src/components/AgentCommPanel.tsx
git commit -m "feat(copy): professional rewrite across pages, approvals, live log, comm panel"
```

---

## Phase 3 — Component Polish

### Task 3.1: Extract reusable Sparkline component

**Files:**
- Create: `src/components/ui/Sparkline.tsx`
- Modify: `src/components/Sidebar.tsx` (lines 35-65: remove local Sparkline, import new)

- [ ] **Step 1: Create reusable Sparkline**

Create `src/components/ui/Sparkline.tsx`:

```tsx
"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color = "var(--color-success)",
  className = "opacity-60",
}: SparklineProps) {
  const padding = 2;
  if (data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Use it in Sidebar**

In `src/components/Sidebar.tsx`:
- Add import: `import { Sparkline } from "@/components/ui/Sparkline";`
- Delete the local `Sparkline` function (lines 36-65).
- The two usages (`<Sparkline data={generateHeartbeatData()} />`) remain valid — the new component accepts the same `data` prop. The `generateHeartbeatData` helper stays in Sidebar (it's simulation-specific).

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: pass. Visual: sidebar sparklines still render.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Sparkline.tsx src/components/Sidebar.tsx
git commit -m "refactor(ui): extract reusable Sparkline component from Sidebar"
```

---

### Task 3.2: Create useDataFreshness hook

**Files:**
- Create: `src/hooks/useDataFreshness.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useDataFreshness.ts`:

```ts
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
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDataFreshness.ts
git commit -m "feat(hooks): add useDataFreshness — computes sync age + status"
```

---

### Task 3.3: Create FreshnessPill component

**Files:**
- Create: `src/components/ui/FreshnessPill.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/FreshnessPill.tsx`:

```tsx
"use client";

import { useDataFreshness } from "@/hooks/useDataFreshness";
import { RefreshCw } from "lucide-react";

interface FreshnessPillProps {
  lastSync: number; // epoch ms
  onRefresh?: () => void;
  compact?: boolean;
}

export function FreshnessPill({ lastSync, onRefresh, compact = false }: FreshnessPillProps) {
  const { label, color, status } = useDataFreshness(lastSync);
  const live = status === "fresh";

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${live ? "animate-pulse-glow" : ""}`}
        style={{ background: color }}
        aria-hidden="true"
      />
      {!compact && <span>Live ·</span>}
      <span className="tabular-nums">{label}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="ml-0.5 hover:opacity-70 transition-opacity focus-ring rounded"
          aria-label="Refresh data"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/FreshnessPill.tsx
git commit -m "feat(ui): add FreshnessPill component"
```

---

### Task 3.4: Extend DashboardContext with lastSync + freshness in Navbar

**Files:**
- Modify: `src/components/DashboardContext.tsx` (add `lastSync` to context + update on each sim tick)
- Modify: `src/components/Navbar.tsx` (add FreshnessPill)

- [ ] **Step 1: Add lastSync to context type + provider**

In `src/components/DashboardContext.tsx`:
- In `DashboardContextType` interface (after `sidebarOpen` ~line 122), add: `lastSync: number;`
- In `DashboardProvider`, add state: `const [lastSync, setLastSync] = useState<number>(Date.now());`
- Inside the live simulation `useEffect` interval callback (the `setInterval` body, before its closing ~line 372), add `setLastSync(Date.now());` at the top of the callback so every tick refreshes it.
- In the provider value object (lines ~462-469), add `lastSync,`.

- [ ] **Step 2: Add FreshnessPill to Navbar**

In `src/components/Navbar.tsx`:
- Add import: `import { FreshnessPill } from "./ui/FreshnessPill";`
- Destructure `lastSync` from `useDashboard()` (line ~10).
- In the left badges group (after the `Base Network` pill div, ~line 44), add on `md:` screens:
```tsx
          <div className="hidden md:block">
            <FreshnessPill lastSync={lastSync} />
          </div>
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: pass. Visual: `Live · 1s ago` pill appears in navbar, updates each second, pauses when circuit breaker is on.

- [ ] **Step 4: Commit**

```bash
git add src/components/DashboardContext.tsx src/components/Navbar.tsx
git commit -m "feat(dashboard): add lastSync + global freshness pill in Navbar"
```

---

### Task 3.5: Sidebar — status dots when collapsed + uptime

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add uptime display in agent status panel**

In `src/components/Sidebar.tsx`, in the Agent A status block (after the Farcaster Scanner row ~line 234, before Sparkline), add:
```tsx
                <div className="flex items-center justify-between pl-5">
                  <span className="text-[10px] text-[var(--color-fg-disabled)]">Uptime (24h)</span>
                  <span className="text-[10px] tabular-nums text-[var(--color-fg-success)]">99.8%</span>
                </div>
```
Add the same pattern in the Agent B block (after Base Network row ~line 258).

- [ ] **Step 2: Show status dot for active nav when collapsed**

The active pulsing dot already shows. For inactive items when collapsed (`!sidebarOpen`), the label is hidden — add a tiny status indicator. This is a minor enhancement; to keep scope tight, leave nav items as-is (icon only when collapsed) and confirm the agent status panel dots still render when collapsed. Test: collapse sidebar on desktop → agent status panel hides (it's wrapped in `{sidebarOpen && ...}`). 

Add a compact status indicator to the collapse toggle button area: in the footer collapse button (lines ~286-292), insert before the chevron a small dual-dot indicator when `!sidebarOpen`:
```tsx
        {!sidebarOpen && (
          <div className="flex items-center gap-1 px-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: agentAStatus === "online" ? "var(--color-success)" : "var(--color-gray)" }} title={`Agent A: ${agentAStatus}`} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: agentBStatus === "online" ? "var(--color-success)" : "var(--color-gray)" }} title={`Agent B: ${agentBStatus}`} />
          </div>
        )}
```
Place this inside the button, before the chevron `{sidebarOpen ? <ChevronLeft/> : <ChevronRight/>}`. Make the button a `flex-row` container — it already uses `justify-center`; change to `flex-col` gap so dots stack above chevron. Adjust: `className="hidden lg:flex flex-col items-center justify-center gap-1 h-14 ..."`.

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(sidebar): show agent status dots when collapsed + uptime stats"
```

---

### Task 3.6: KpiCard — sparkline + per-card freshness

**Files:**
- Modify: `src/components/KpiCard.tsx` (add optional sparkline data + freshness)
- Modify: `src/components/DashboardKpis.tsx` (pass sparkline data + lastSync)

- [ ] **Step 1: Extend KpiCard props**

In `src/components/KpiCard.tsx`:
- Add imports: `import { Sparkline } from "@/components/ui/Sparkline";`
- Extend `KpiCardProps` with: `sparkData?: number[];`
- After the value block (around line 119, after `subValue` paragraph), add:
```tsx
      {sparkData && sparkData.length > 1 && (
        <Sparkline data={sparkData} width={220} height={28} className="opacity-70" />
      )}
```

- [ ] **Step 2: Pass sparkline data from DashboardKpis**

In `src/components/DashboardKpis.tsx`:
- Add a small generator helper near top: 
```ts
function genSpark(base: number, n = 12): number[] {
  let v = base;
  return Array.from({ length: n }, () => { v += (Math.random() - 0.45) * base * 0.1; return Math.max(0, v); });
}
```
- Destructure `lastSync` from `useDashboard()` (line ~9, currently only `kpiMetrics`).
- Add to TVL, Success Rate, Total Txs KpiCards: `sparkData={genSpark(kpiMetrics.totalTvlAnalyzed / 1000000)}`, `sparkData={genSpark(kpiMetrics.successRate)}`, `sparkData={genSpark(kpiMetrics.totalTransactions)}` respectively. (Different base per metric.)

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: pass. Visual: 3 KPI cards show sparklines.

- [ ] **Step 4: Commit**

```bash
git add src/components/KpiCard.tsx src/components/DashboardKpis.tsx
git commit -m "feat(kpi): add sparkline trend to TVL, success rate, and total txs cards"
```

---

## Phase 4 — New Pages & Panels

### Task 4.1: Extend DashboardContext with notifications + agentHealth + preferences

**Files:**
- Modify: `src/components/DashboardContext.tsx`

- [ ] **Step 1: Add types**

Near the other type definitions (after `AgentMessage` ~line 99), add:

```ts
export type NotificationType = "approval" | "failure" | "agent" | "threshold";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

export interface AgentHealth {
  latencyMs: number;
  inferenceMs: number;
  successCount: number;
  failCount: number;
  queueDepth: number;
  uptimePct: number;
}

export type Density = "compact" | "comfortable" | "spacious";

export interface AppPreferences {
  density: Density;
  onboarded: boolean;
}
```

- [ ] **Step 2: Extend context type**

In `DashboardContextType`, add:
```ts
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (type: NotificationType, title: string, body: string, link?: string) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  agentHealth: { a: AgentHealth; b: AgentHealth };
  preferences: AppPreferences;
  setPreferences: (p: Partial<AppPreferences>) => void;
```

- [ ] **Step 3: Add state + persistence in provider**

In `DashboardProvider`, add:
```ts
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferencesState] = useState<AppPreferences>({ density: "comfortable", onboarded: false });
  const [agentHealth, setAgentHealth] = useState<{ a: AgentHealth; b: AgentHealth }>({
    a: { latencyMs: 180, inferenceMs: 1400, successCount: 0, failCount: 0, queueDepth: 0, uptimePct: 99.8 },
    b: { latencyMs: 0, inferenceMs: 0, successCount: 0, failCount: 0, queueDepth: 0, uptimePct: 99.9 },
  });
```

Add a `useEffect` to load preferences from localStorage + apply density class:
```ts
  useEffect(() => {
    try {
      const stored = localStorage.getItem("a2z-prefs");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppPreferences>;
        setPreferencesState((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", preferences.density);
  }, [preferences.density]);
```

- [ ] **Step 4: Add callbacks**

```ts
  const addNotification = useCallback((type, title, body, link) => {
    setNotifications((prev) => [
      { id: genId(), type, title, body, timestamp: new Date(), read: false, link },
      ...prev,
    ].slice(0, 50));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const setPreferences = useCallback((p: Partial<AppPreferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem("a2z-prefs", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
```

- [ ] **Step 5: Wire notifications into simulation + agentHealth updates**

In the live simulation `setInterval` callback, branch on event type:
- On transaction **failure** (the `else` branch ~line 336 where `success` is false): `addNotification("failure", "Transaction failed", \`${proj} — RPC timeout, retry scheduled\`, "/history");`
- On `agentBStatus` set to "executing" (~line 324): increment health b success/fail counts accordingly. Add right after newTx creation in the else branch: `setAgentHealth((h) => ({ ...h, b: { ...h.b, successCount: h.b.successCount + (success ? 1 : 0), failCount: h.b.failCount + (success ? 0 : 1) } }));`
- Also bump `queueDepth` when approvals exist: this is read-only derived; set it from approvalQueue length. Simpler: in a small `useEffect` on `[approvalQueue.length]`, `setAgentHealth(h => ({...h, b: {...h.b, queueDepth: approvalQueue.length}}))`.

- [ ] **Step 6: Add to provider value**

Add all new fields to the provider value object:
```ts
    notifications, unreadCount: notifications.filter((n) => !n.read).length,
    addNotification, markNotificationsRead, clearNotifications,
    agentHealth, preferences, setPreferences,
```

- [ ] **Step 7: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/DashboardContext.tsx
git commit -m "feat(context): add notifications, agentHealth, and preferences state"
```

---

### Task 4.2: Create ConfirmModal component

**Files:**
- Create: `src/components/ui/ConfirmModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/ConfirmModal.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";

type Variant = "danger" | "warning" | "info";

interface ConfirmModalProps {
  open: boolean;
  variant?: Variant;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT = {
  danger: { icon: AlertCircle, color: "var(--color-fg-danger)", bg: "var(--color-danger-soft)", border: "var(--color-border-danger-subtle)" },
  warning: { icon: AlertTriangle, color: "var(--color-fg-warning)", bg: "var(--color-warning-soft)", border: "var(--color-border-warning-subtle)" },
  info: { icon: Info, color: "var(--color-fg-brand-strong)", bg: "var(--color-brand-softer)", border: "var(--color-border-brand-subtle)" },
};

export function ConfirmModal({
  open, variant = "warning", title, description, details = [],
  confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const v = VARIANT[variant];
  const Icon = v.icon;

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel, onConfirm]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onCancel}
            role="presentation"
          />
          <motion.div
            className="fixed top-1/2 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div
              className="rounded-2xl elevation-3 p-5"
              style={{ background: "var(--color-card)" }}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: v.bg, border: `1px solid ${v.border}` }}
                >
                  <Icon className="w-5 h-5" style={{ color: v.color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
                    {title}
                  </h3>
                  <p className="text-sm mt-1" style={{ color: "var(--color-body-subtle)" }}>
                    {description}
                  </p>
                </div>
                <button onClick={onCancel} aria-label="Close" className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring">
                  <X className="w-4 h-4" style={{ color: "var(--color-body-subtle)" }} />
                </button>
              </div>

              {details.length > 0 && (
                <div className="rounded-xl p-3 mb-4 space-y-1.5" style={{ background: "var(--color-neutral-secondary-medium)" }}>
                  {details.map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: "var(--color-body-subtle)" }}>{d.label}</span>
                      <span className="font-medium tabular-nums" style={{ color: "var(--color-heading)" }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-ring"
                  style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body)", border: "1px solid var(--color-border-default)" }}
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmRef}
                  onClick={onConfirm}
                  className="btn-glint px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-ring"
                  style={{
                    background: variant === "danger" ? "var(--color-danger)" : variant === "warning" ? "var(--color-warning)" : "var(--color-brand)",
                    color: "var(--color-heading)",
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ConfirmModal.tsx
git commit -m "feat(ui): add reusable ConfirmModal with danger/warning/info variants"
```

---

### Task 4.3: Wire ConfirmModal into Circuit Breaker

**Files:**
- Modify: `src/components/CircuitBreaker.tsx`

- [ ] **Step 1: Add confirm state + modal**

In `src/components/CircuitBreaker.tsx`:
- Add imports: `import { useState } from "react";` and `import { ConfirmModal } from "./ui/ConfirmModal";`
- Add state: `const [confirming, setConfirming] = useState(false);`
- Change the toggle button `onClick` from `() => setIsPaused(!isPaused)` to `() => { if (!isPaused) setConfirming(true); else setIsPaused(false); }` (only pause needs confirmation; resuming is safe).
- Before the component's closing `</div>`, add:
```tsx
      <ConfirmModal
        open={confirming}
        variant="danger"
        title="Pause on-chain execution"
        description="This will pause all Agent B on-chain activity. Queued items are preserved and can be resumed."
        details={[{ label: "Current state", value: "Running" }, { label: "Action", value: "Pause execution" }]}
        confirmLabel="Pause execution"
        onConfirm={() => { setIsPaused(true); setConfirming(false); }}
        onCancel={() => setConfirming(false)}
      />
```

- [ ] **Step 2: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: clicking the toggle when Running opens confirm modal; Escape/Cancel closes; Confirm pauses.

- [ ] **Step 3: Commit**

```bash
git add src/components/CircuitBreaker.tsx
git commit -m "feat(circuit-breaker): confirm before pausing on-chain execution"
```

---

### Task 4.4: Wire ConfirmModal into VectorMemoryExplorer blacklist

**Files:**
- Modify: `src/components/VectorMemoryExplorer.tsx`

- [ ] **Step 1: Add blacklist confirm**

In `src/components/VectorMemoryExplorer.tsx`:
- Add imports: `import { ConfirmModal } from "@/components/ui/ConfirmModal";` and `import type { VectorMemoryItem } from "./DashboardContext";`
- Add state: `const [pendingBlacklist, setPendingBlacklist] = useState<VectorMemoryItem | null>(null);`
- Change both blacklist buttons (desktop line ~172 and mobile line ~234) `onClick={() => handleBlacklist(item.id)}` to `onClick={() => setPendingBlacklist(item)}`.
- Before the final closing `</div>` of the component root, add:
```tsx
      <ConfirmModal
        open={pendingBlacklist !== null}
        variant="danger"
        title="Blacklist project"
        description="This project will be marked as blacklisted in the vector store. Existing data is preserved but excluded from scans."
        details={pendingBlacklist ? [
          { label: "Project", value: pendingBlacklist.projectName },
          { label: "TVL", value: `$${(pendingBlacklist.tvl / 1_000_000).toFixed(2)}M` },
        ] : []}
        confirmLabel="Blacklist"
        onConfirm={() => { if (pendingBlacklist) handleBlacklist(pendingBlacklist.id); setPendingBlacklist(null); }}
        onCancel={() => setPendingBlacklist(null)}
      />
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/VectorMemoryExplorer.tsx
git commit -m "feat(memory): confirm before blacklisting a project"
```

---

### Task 4.5: Create NotificationsPanel + wire Navbar Bell

**Files:**
- Create: `src/components/ui/NotificationsPanel.tsx`
- Modify: `src/components/Navbar.tsx` (Bell section lines 54-67)

- [ ] **Step 1: Create NotificationsPanel**

Create `src/components/ui/NotificationsPanel.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Bell, CheckCheck, Inbox, AlertTriangle, XCircle, Radio, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useDashboard, type AppNotification, type NotificationType } from "../DashboardContext";

const TYPE_META: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  approval: { icon: AlertTriangle, color: "var(--color-fg-warning)" },
  failure: { icon: XCircle, color: "var(--color-fg-danger)" },
  agent: { icon: Radio, color: "var(--color-fg-brand)" },
  threshold: { icon: TrendingUp, color: "var(--color-fg-success)" },
};

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function NotificationsPanel() {
  const { notifications, unreadCount, markNotificationsRead, clearNotifications } = useDashboard();
  const [open, setOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && triggerEl && !triggerEl.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [open, triggerEl]);

  return (
    <>
      <button
        ref={setTriggerEl}
        onClick={() => { setOpen((o) => !o); if (!open) markNotificationsRead(); }}
        className="relative p-1.5 rounded-xl hover:bg-[var(--color-neutral-secondary-medium)] focus-ring transition-colors"
        aria-label={`${unreadCount} items need review — open notifications`}
      >
        <Bell className="w-5 h-5 text-[var(--color-body-subtle)]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[var(--color-heading)] text-[9px] flex items-center justify-center font-bold"
            style={{ background: "var(--color-danger)" }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && triggerEl && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed right-4 top-16 z-[9997] w-[min(92vw,360px)] rounded-2xl elevation-3 overflow-hidden"
              style={{ background: "var(--color-card)" }}
              role="dialog"
              aria-label="Notifications"
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-muted)" }}>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" style={{ color: "var(--color-fg-brand-strong)" }} />
                  <h5 className="text-sm font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>
                    Notifications
                  </h5>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: "var(--color-danger)", color: "var(--color-heading)" }}>
                      {unreadCount}
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} className="flex items-center gap-1 text-[11px] hover:opacity-70 transition-opacity focus-ring rounded" style={{ color: "var(--color-body-subtle)" }}>
                    <CheckCheck className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                    <Inbox className="w-8 h-8 mb-2" style={{ color: "var(--color-fg-disabled)" }} />
                    <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>No notifications</p>
                  </div>
                ) : (
                  notifications.map((n: AppNotification) => {
                    const meta = TYPE_META[n.type];
                    const Icon = meta.icon;
                    return (
                      <Link
                        key={n.id}
                        href={n.link ?? "#"}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-2.5 px-4 py-3 transition-colors hover:bg-[var(--color-neutral-secondary-medium)]"
                        style={{ borderBottom: "1px solid var(--color-border-muted)" }}
                      >
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--color-heading)" }}>{n.title}</p>
                          <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--color-body-subtle)" }}>{n.body}</p>
                          <p className="text-[10px] mt-1 tabular-nums" style={{ color: "var(--color-fg-disabled)" }}>{timeAgo(n.timestamp)}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "var(--color-brand)" }} />}
                      </Link>
                    );
                  })
                )}
              </div>

              <Link href="/history" onClick={() => setOpen(false)} className="block text-center text-xs py-2.5 hover:bg-[var(--color-neutral-secondary-medium)] transition-colors" style={{ color: "var(--color-fg-brand)", borderTop: "1px solid var(--color-border-muted)" }}>
                View all in Audit Trail
              </Link>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace Navbar Bell block**

In `src/components/Navbar.tsx`:
- Add import: `import { NotificationsPanel } from "./ui/NotificationsPanel";`
- Replace the entire `{kpiMetrics.activeAlerts > 0 && (<button className="relative ...">...Bell...</button>)}` block (lines 54-67) with:
```tsx
          <NotificationsPanel />
```

- [ ] **Step 3: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: Bell always visible now; badge shows unread; clicking opens panel; clicking an item navigates; "Clear" empties. To generate notifications, let the simulation run — failed transactions create failure notifications.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/NotificationsPanel.tsx src/components/Navbar.tsx
git commit -m "feat(notifications): add dropdown panel + wire Navbar Bell"
```

---

### Task 4.6: Create Agents page

**Files:**
- Create: `src/app/agents/page.tsx`
- Create: `src/app/agents/loading.tsx`

- [ ] **Step 1: Create Agents page**

Create `src/app/agents/page.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import { useDashboard, type AgentHealth } from "@/components/DashboardContext";
import PageHeader from "@/components/PageHeader";
import { Sparkline } from "@/components/ui/Sparkline";
import { Bot, Shield, Activity, Zap, Clock, CheckCircle2, XCircle, ListChecks, Pause, Play, Link2 } from "lucide-react";

function genSpark(base: number, n = 12): number[] {
  let v = base;
  return Array.from({ length: n }, () => { v += (Math.random() - 0.45) * base * 0.1; return Math.max(0, v); });
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-neutral-secondary-medium)" }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-[11px]" style={{ color: "var(--color-body-subtle)" }}>{label}</p>
        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--color-heading)" }}>{value}</p>
      </div>
    </div>
  );
}

function AgentHero({ name, role, icon: Icon, color, bg, status, health, spark, isPaused }: {
  name: string; role: string; icon: typeof Bot; color: string; bg: string;
  status: string; health: AgentHealth; spark: number[]; isPaused?: boolean;
}) {
  return (
    <motion.div
      className="card p-6 space-y-5"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: bg, border: `1px solid ${color}` }}>
          <Icon className="w-7 h-7" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>{name}</h3>
          <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>{role}</p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize"
          style={{
            background: isPaused ? "var(--color-danger-soft)" : status === "online" ? "var(--color-success-soft)" : "var(--color-warning-soft)",
            color: isPaused ? "var(--color-fg-danger)" : status === "online" ? "var(--color-fg-success)" : "var(--color-fg-warning)",
            border: `1px solid ${isPaused ? "var(--color-border-danger-subtle)" : status === "online" ? "var(--color-border-success-subtle)" : "var(--color-border-warning-subtle)"}`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-glow" style={{ background: "currentColor" }} />
          {isPaused ? "Paused" : status === "online" ? "Running" : status}
        </span>
      </div>

      <Sparkline data={spark} width={320} height={48} color={color} className="opacity-80 w-full" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Metric icon={Clock} label="Latency" value={`${health.latencyMs}ms`} color="var(--color-fg-warning)" />
        <Metric icon={Zap} label="Inference" value={`${health.inferenceMs}ms`} color="var(--color-fg-purple)" />
        <Metric icon={Activity} label="Uptime" value={`${health.uptimePct}%`} color="var(--color-fg-success)" />
        <Metric icon={CheckCircle2} label="Success" value={health.successCount.toString()} color="var(--color-fg-success)" />
        <Metric icon={XCircle} label="Failed" value={health.failCount.toString()} color="var(--color-fg-danger)" />
        <Metric icon={ListChecks} label="Queue" value={health.queueDepth.toString()} color="var(--color-fg-brand-strong)" />
      </div>
    </motion.div>
  );
}

export default function AgentsPage() {
  const { agentAStatus, agentBStatus, isPaused, setIsPaused, agentHealth } = useDashboard();

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      <PageHeader
        title="Agents"
        description="Health, performance, and control for both autonomous agents."
        icon={Bot}
      >
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors focus-ring"
          style={{
            background: isPaused ? "var(--color-success-medium)" : "var(--color-danger-soft)",
            color: isPaused ? "var(--color-fg-success-strong)" : "var(--color-fg-danger)",
            border: `1px solid ${isPaused ? "var(--color-border-success-subtle)" : "var(--color-border-danger-subtle)"}`,
          }}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? "Resume execution" : "Pause execution"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentHero
          name="Agent A — Scout"
          role="Signal detection & scoring"
          icon={Bot}
          color="var(--color-fg-purple)"
          bg="var(--color-brand-softer)"
          status={agentAStatus}
          health={agentHealth.a}
          spark={genSpark(agentHealth.a.latencyMs)}
        />
        <AgentHero
          name="Agent B — Vault"
          role="Secure execution on Base"
          icon={Shield}
          color="var(--color-fg-cyan)"
          bg="var(--color-brand-soft)"
          status={agentBStatus}
          health={agentHealth.b}
          spark={genSpark(Math.max(1, agentHealth.b.latencyMs))}
          isPaused={isPaused}
        />
      </div>

      <motion.div
        className="card p-5 flex items-center gap-3"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Link2 className="w-4 h-4" style={{ color: "var(--color-fg-brand-strong)" }} />
        <p className="text-sm" style={{ color: "var(--color-body-subtle)" }}>
          Tune scoring, RPC, and execution limits in <a href="/settings" className="font-medium" style={{ color: "var(--color-fg-brand)" }}>Settings</a>.
          Review raw logs in <a href="/history" className="font-medium" style={{ color: "var(--color-fg-brand)" }}>Audit Trail</a>.
        </p>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create loading skeleton**

Create `src/app/agents/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton variant="rectangular" className="h-12 w-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton variant="rectangular" className="h-80 rounded-2xl" />
        <Skeleton variant="rectangular" className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Agents to Sidebar nav**

In `src/components/Sidebar.tsx`, `NAV_ITEMS` array (lines 13-19), add after the Analytics entry:
```ts
  { href: "/agents", label: "Agents", icon: Bot },
```
And add `Bot` to the lucide import (line 7-10): `import { ..., Bot, ... } from "lucide-react";`

- [ ] **Step 4: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: `/agents` shows two hero cards with sparklines + metrics; pause/resume button works; nav item present.

- [ ] **Step 5: Commit**

```bash
git add src/app/agents/page.tsx src/app/agents/loading.tsx src/components/Sidebar.tsx
git commit -m "feat(agents): add Agents page with health metrics, sparklines, and pause control"
```

---

## Phase 5 — Data Visualization

### Task 5.1: Create RadialGauge component

**Files:**
- Create: `src/components/ui/RadialGauge.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/RadialGauge.tsx`:

```tsx
"use client";

import { motion } from "motion/react";

interface RadialGaugeProps {
  value: number;       // 0..max
  max?: number;        // default 100
  size?: number;       // px, default 56
  stroke?: number;     // default 5
  label?: string;
}

function colorFor(pct: number): string {
  if (pct >= 0.85) return "var(--color-success)";
  if (pct >= 0.65) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function RadialGauge({ value, max = 100, size = 56, stroke = 5, label }: RadialGaugeProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = circumference * (1 - pct);
  const color = colorFor(pct);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--color-neutral-tertiary)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold tabular-nums" style={{ color: "var(--color-heading)" }}>
          {label ?? Math.round(value)}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/RadialGauge.tsx
git commit -m "feat(ui): add RadialGauge SVG component for score visualization"
```

---

### Task 5.2: Create ScoreBreakdown component

**Files:**
- Create: `src/components/ui/ScoreBreakdown.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/ScoreBreakdown.tsx`:

```tsx
"use client";

import { motion } from "motion/react";

interface ScoreBreakdownProps {
  sentimentPct: number; // 0..100 weight
  tvlPct: number;       // 0..100 weight
  sentimentPts: number;
  tvlPts: number;
  total: number;
}

export function ScoreBreakdown({ sentimentPct, tvlPct, sentimentPts, tvlPts, total }: ScoreBreakdownProps) {
  return (
    <div className="mt-2">
      <div className="flex h-2 w-full rounded-full overflow-hidden" style={{ background: "var(--color-neutral-tertiary)" }}>
        <motion.div
          className="h-full"
          style={{ background: "var(--color-accent-purple)" }}
          initial={{ width: 0 }}
          animate={{ width: `${sentimentPct}%` }}
          transition={{ duration: 0.6 }}
          title={`Sentiment ${sentimentPts}pts (${sentimentPct}%)`}
        />
        <motion.div
          className="h-full"
          style={{ background: "var(--color-accent-teal)" }}
          initial={{ width: 0 }}
          animate={{ width: `${tvlPct}%` }}
          transition={{ duration: 0.6 }}
          title={`TVL ${tvlPts}pts (${tvlPct}%)`}
        />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: "var(--color-fg-disabled)" }}>
        <span>Sentiment {sentimentPts}pts</span>
        <span>TVL {tvlPts}pts</span>
        <span className="font-semibold tabular-nums" style={{ color: "var(--color-fg-success)" }}>Total {total}/100</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ScoreBreakdown.tsx
git commit -m "feat(ui): add ScoreBreakdown split bar (sentiment vs TVL)"
```

---

### Task 5.3: Integrate RadialGauge + ScoreBreakdown into ApprovalQueue

**Files:**
- Modify: `src/components/ApprovalQueue.tsx` (score display block ~lines 106-119)

- [ ] **Step 1: Add gauge + breakdown to each approval item**

In `src/components/ApprovalQueue.tsx`:
- Add imports: `import { RadialGauge } from "./ui/RadialGauge";` and `import { ScoreBreakdown } from "./ui/ScoreBreakdown";` and `import { useDashboard } from "./DashboardContext";` (already imported).
- In the component, get config weights: `const { config } = useDashboard();` (add to existing destructure on line ~9: currently only `approvalQueue, handleApprove, handleReject`).
- Replace the score block (lines ~106-119, the `<div className="flex-shrink-0 text-right">` with amount + "Score: X/100") with:
```tsx
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <RadialGauge value={item.llmScore} size={48} />
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums" style={{ color: "var(--color-fg-warning)", fontFamily: "var(--font-serif)" }}>
                        ${item.amountUsd}
                      </p>
                    </div>
                  </div>
```
- After the reason paragraph (line ~128, the `{item.reason}` block), add:
```tsx
                <ScoreBreakdown
                  sentimentPct={config.agentA.sentimentWeight}
                  tvlPct={config.agentA.tvlWeight}
                  sentimentPts={Math.round(item.llmScore * config.agentA.sentimentWeight / 100)}
                  tvlPts={Math.round(item.llmScore * config.agentA.tvlWeight / 100)}
                  total={item.llmScore}
                />
```

- [ ] **Step 2: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: approval items show radial gauge (color-coded) + split bar.

- [ ] **Step 3: Commit**

```bash
git add src/components/ApprovalQueue.tsx
git commit -m "feat(approvals): add RadialGauge + ScoreBreakdown to each approval item"
```

---

## Phase 6 — Power-User Features

### Task 6.1: Create SegmentedControl component

**Files:**
- Create: `src/components/ui/SegmentedControl.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/SegmentedControl.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";

interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: LucideIcon;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}

export function SegmentedControl<T extends string>({
  options, value, onChange, size = "md", ariaLabel,
}: SegmentedControlProps<T>) {
  const pad = size === "sm" ? "px-1.5 py-1" : "px-2.5 py-1.5";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 p-1 rounded-xl"
      style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-default)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            title={opt.title ?? opt.label}
            className={`relative ${pad} rounded-lg text-xs font-medium transition-colors focus-ring flex items-center gap-1.5 ${active ? "" : "hover:bg-[var(--color-neutral-tertiary)]"}`}
            style={{ color: active ? "var(--color-heading)" : "var(--color-body-subtle)" }}
          >
            {active && (
              <motion.div
                layoutId={`seg-${ariaLabel}`}
                className="absolute inset-0 rounded-lg"
                style={{ background: "var(--color-brand-softer)", border: "1px solid var(--color-border-brand-subtle)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {Icon && <Icon className="w-3.5 h-3.5 relative z-10" />}
            {opt.label && <span className="relative z-10">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/SegmentedControl.tsx
git commit -m "feat(ui): add reusable SegmentedControl component"
```

---

### Task 6.2: Upgrade ThemeToggle to 3-mode SegmentedControl

**Files:**
- Modify: `src/components/ui/ThemeToggle.tsx` (full rewrite)

- [ ] **Step 1: Rewrite ThemeToggle**

Replace entire contents of `src/components/ui/ThemeToggle.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);

  // Compact icon button that expands into segmented control
  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 transition-colors hover:bg-[var(--color-neutral-secondary-medium)] focus-ring"
        aria-label={`Theme: ${mode}. Open theme options`}
      >
        {mode === 'light' ? <Sun className="w-5 h-5 text-[var(--color-body-subtle)]" /> : mode === 'system' ? <Monitor className="w-5 h-5 text-[var(--color-body-subtle)]" /> : <Moon className="w-5 h-5 text-[var(--color-body-subtle)]" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-2 z-50">
            <SegmentedControl
              ariaLabel="theme"
              size="sm"
              value={mode}
              onChange={(v: ThemeMode) => { setMode(v); setOpen(false); }}
              options={[
                { value: 'light', icon: Sun, title: 'Light' },
                { value: 'system', icon: Monitor, title: 'System' },
                { value: 'dark', icon: Moon, title: 'Dark' },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: clicking theme toggle opens 3-option segmented control; selecting each changes theme (system follows OS).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ThemeToggle.tsx
git commit -m "feat(theme): 3-mode toggle (light/system/dark) via SegmentedControl"
```

---

### Task 6.3: Density toggle in Settings

**Files:**
- Modify: `src/components/SettingsPanel.tsx` (add density section)

- [ ] **Step 1: Add density control**

In `src/components/SettingsPanel.tsx`:
- Add imports: `import { SegmentedControl } from "./ui/SegmentedControl";` and update `useDashboard` destructure (line ~10) to include `preferences, setPreferences`: `const { config, setConfig, preferences, setPreferences } = useDashboard();`
- Add `type Density` import: `import type { DashboardConfig, Density } from "./DashboardContext";`
- Before the Action Buttons section (line ~229, `<motion.div className="flex flex-col sm:flex-row gap-3 justify-end">`), add a density card:
```tsx
      <motion.div
        className="card p-5 space-y-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h4 className="font-serif" style={labelStyle}>Display Density</h4>
            <p className="text-xs" style={subtleStyle}>Adjust spacing across the dashboard.</p>
          </div>
          <SegmentedControl
            ariaLabel="density"
            value={preferences.density}
            onChange={(v: Density) => setPreferences({ density: v })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </div>
      </motion.div>
```

- [ ] **Step 2: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: Settings shows density segmented control; changing it sets `data-density` on `<html>` and adjusts spacing (note: full effect requires spacing consumers to use `--spacing-scale`; the toggle is wired and persists even if not every component reads the scale yet — that's acceptable for this phase; the foundation is in place).

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat(settings): add display density toggle (compact/comfortable/spacious)"
```

---

### Task 6.4: Create useKeyboardShortcut hook + KeyboardHelpOverlay

**Files:**
- Create: `src/hooks/useKeyboardShortcut.ts`
- Create: `src/components/ui/KeyboardHelpOverlay.tsx`
- Modify: `src/app/layout.tsx` (mount overlay)

- [ ] **Step 1: Create useKeyboardShortcut hook**

Create `src/hooks/useKeyboardShortcut.ts`:

```ts
'use client';
import { useEffect } from 'react';

interface Options {
  meta?: boolean; // require Cmd/Ctrl
  ctrl?: boolean;
  shift?: boolean;
  ignoreInputs?: boolean; // default true
}

export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  options: Options = {},
) {
  const { meta = false, ctrl = false, shift = false, ignoreInputs = true } = options;

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (ignoreInputs && target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (meta && !(e.metaKey || e.ctrlKey)) return;
      if (ctrl && !e.ctrlKey) return;
      if (shift && !e.shiftKey) return;
      if (meta || ctrl) { if (!(e.metaKey || e.ctrlKey)) return; }
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [key, handler, meta, ctrl, shift, ignoreInputs]);
}
```

- [ ] **Step 2: Create KeyboardHelpOverlay**

Create `src/components/ui/KeyboardHelpOverlay.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";

interface ShortcutGroup {
  category: string;
  items: { keys: string[]; desc: string }[];
}

const GROUPS: ShortcutGroup[] = [
  { category: "Navigation", items: [
    { keys: ["1"], desc: "Dashboard" },
    { keys: ["2"], desc: "Analytics" },
    { keys: ["3"], desc: "Vector Memory" },
    { keys: ["4"], desc: "Audit Trail" },
    { keys: ["5"], desc: "Settings" },
  ]},
  { category: "Actions", items: [
    { keys: ["⌘", "K"], desc: "Open command palette" },
    { keys: ["?"], desc: "Show this help" },
    { keys: ["Esc"], desc: "Close dialogs" },
  ]},
  { category: "Accessibility", items: [
    { keys: ["Tab"], desc: "Move focus forward" },
    { keys: ["Shift", "Tab"], desc: "Move focus backward" },
    { keys: ["Enter"], desc: "Activate focused element" },
  ]},
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md inline-flex items-center justify-center min-w-[20px]" style={{ background: "var(--color-neutral-secondary-medium)", color: "var(--color-body-subtle)", border: "1px solid var(--color-border-default)" }}>
      {children}
    </kbd>
  );
}

export function KeyboardHelpOverlay() {
  const [open, setOpen] = useState(false);
  useKeyboardShortcut("?", () => setOpen((o) => !o));

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div
            className="fixed top-1/2 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
          >
            <div className="rounded-2xl elevation-3 p-5" style={{ background: "var(--color-card)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-5 h-5" style={{ color: "var(--color-fg-brand-strong)" }} />
                  <h3 className="text-base font-semibold" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring">
                  <X className="w-4 h-4" style={{ color: "var(--color-body-subtle)" }} />
                </button>
              </div>
              <div className="space-y-4">
                {GROUPS.map((g) => (
                  <div key={g.category}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-body-subtle)" }}>{g.category}</p>
                    <div className="space-y-1.5">
                      {g.items.map((item) => (
                        <div key={item.desc} className="flex items-center justify-between gap-3">
                          <span className="text-xs" style={{ color: "var(--color-body)" }}>{item.desc}</span>
                          <div className="flex items-center gap-1">{item.keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
```

- [ ] **Step 3: Mount overlay in layout**

In `src/app/layout.tsx`:
- Add import: `import { KeyboardHelpOverlay } from "@/components/ui/KeyboardHelpOverlay";`
- Add `<KeyboardHelpOverlay />` inside `<KeyboardNavWrapper>` near `<CommandPalette />` (line ~77).

- [ ] **Step 4: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: pressing `?` opens the shortcuts overlay; Escape/click closes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useKeyboardShortcut.ts src/components/ui/KeyboardHelpOverlay.tsx src/app/layout.tsx
git commit -m "feat(a11y): keyboard shortcuts help overlay (press ?)"
```

---

## Phase 7 — Onboarding & Final Pass

### Task 7.1: Create OnboardingTour component

**Files:**
- Create: `src/components/ui/OnboardingTour.tsx`
- Modify: `src/app/layout.tsx` (mount)
- Modify: `src/components/ui/CommandPalette.tsx` (add "Restart onboarding" command)

- [ ] **Step 1: Create OnboardingTour**

Create `src/components/ui/OnboardingTour.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, ChevronRight, Check } from "lucide-react";
import { useDashboard } from "../DashboardContext";

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { title: "Welcome to Mission Control", body: "This is your live view of both autonomous agents operating on Base Network." },
  { title: "Agent status, always visible", body: "The sidebar shows Scout and Vault status, latency, and uptime at a glance." },
  { title: "Approvals need your input", body: "Transactions above the autonomous limit appear in the approval queue. Review and approve or reject each one." },
  { title: "Move fast with the command palette", body: "Press ⌘K (or Ctrl+K) to jump between pages and run actions. Press ? any time to see all shortcuts." },
];

export function OnboardingTour() {
  const { preferences, setPreferences } = useDashboard();
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;

  const open = !preferences.onboarded;
  if (!open) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finish = () => setPreferences({ onboarded: true });
  const next = () => (isLast ? finish() : setStep((s) => s + 1));

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9996] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog" aria-modal="true" aria-label="Onboarding tour"
      >
        <motion.div
          className="w-full max-w-md rounded-2xl elevation-3 p-6"
          style={{ background: "var(--color-card)" }}
          initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--color-brand-softer)", border: "1px solid var(--color-border-brand-subtle)" }}>
                <Sparkles className="w-5 h-5" style={{ color: "var(--color-fg-brand-strong)" }} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-body-subtle)" }}>
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <button onClick={finish} aria-label="Skip tour" className="p-1 rounded-lg hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring">
              <X className="w-4 h-4" style={{ color: "var(--color-body-subtle)" }} />
            </button>
          </div>

          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}>{current.title}</h3>
          <p className="text-sm mb-6" style={{ color: "var(--color-body-subtle)" }}>{current.body}</p>

          <div className="flex items-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <div key={i} className="h-1 rounded-full transition-all" style={{ width: i === step ? 24 : 8, background: i <= step ? "var(--color-fg-brand-strong)" : "var(--color-neutral-tertiary)" }} />
            ))}
          </div>

          <div className="flex justify-between">
            <button onClick={finish} className="text-sm font-medium hover:opacity-70 transition-opacity focus-ring rounded" style={{ color: "var(--color-body-subtle)" }}>Skip</button>
            <button onClick={next} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold btn-glint" style={{ background: "var(--color-brand)", color: "var(--color-heading)" }}>
              {isLast ? (<><Check className="w-4 h-4" /> Get started</>) : (<>Next <ChevronRight className="w-4 h-4" /></>)}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
```

- [ ] **Step 2: Mount in layout**

In `src/app/layout.tsx`:
- Add import: `import { OnboardingTour } from "@/components/ui/OnboardingTour";`
- Add `<OnboardingTour />` inside `<KeyboardNavWrapper>` near the other overlays.

- [ ] **Step 3: Add restart command to CommandPalette**

In `src/components/ui/CommandPalette.tsx`:
- Add import: `import { useDashboard } from "../DashboardContext";`
- In the component, add: `const { setPreferences } = useDashboard();`
- Add to the `commands` array (before clear-cache):
```ts
    { id: "restart-onboarding", label: "Restart Onboarding", description: "Show the intro tour again", icon: Sparkles, action: () => setPreferences({ onboarded: false }), category: "Actions" },
```
- Add `Sparkles` to the lucide-react import.

- [ ] **Step 4: Verify build + visual**

Run: `npm run lint && npm run build`
Expected: pass. Visual: clear localStorage `a2z-prefs` to retrigger; tour shows 4 steps; Skip/Next works; "Restart Onboarding" in ⌘K reopens it.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/OnboardingTour.tsx src/app/layout.tsx src/components/ui/CommandPalette.tsx
git commit -m "feat(onboarding): first-run guided tour + restart via command palette"
```

---

### Task 7.2: Empty/Loading consistency pass

**Files:**
- Modify: `src/components/VectorMemoryExplorer.tsx` (mobile empty state), `src/components/AuditTrail.tsx` (empty state styling), `src/components/TransactionList.tsx` (mobile empty)

- [ ] **Step 1: Use EmptyState in VectorMemoryExplorer mobile**

In `src/components/VectorMemoryExplorer.tsx`, the filtered empty check at the bottom (~line 247) already uses `EmptyState`. Verify the mobile branch also shows it (it renders the same `filtered.map` — when empty, the mobile loop renders nothing, then the trailing `EmptyState` shows). This is fine. No change needed unless the EmptyState renders outside the card on mobile — confirm visually.

- [ ] **Step 2: Improve AuditTrail empty state**

In `src/components/AuditTrail.tsx`, the `pageEntries.length === 0` block (~line 242) uses `EmptyState` inside the `.card`. Add `description` clarity: change to `"No entries match your current filters."` — already present as such. No change needed; confirm visually.

- [ ] **Step 3: Improve TransactionList mobile empty**

In `src/components/TransactionList.tsx`, the mobile empty (~line 285) uses a plain `<div>` instead of `EmptyState`. Replace it:
- Add import: `import { EmptyState } from "./ui/EmptyState";`
- Replace the mobile empty block:
```tsx
          {displayed.length === 0 ? (
            <EmptyState icon={Inbox} title="No transactions yet" description="Executed transactions will appear here." />
          ) : (
```
- Add `Inbox` to the lucide import.
- The desktop table empty (`<tbody><tr>...No transactions yet...</tr></tbody>` ~line 269) is acceptable for a table; leave it.

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/TransactionList.tsx
git commit -m "feat(consistency): use EmptyState component in TransactionList mobile"
```

---

### Task 7.3: Final a11y + focus-ring pass

**Files:**
- Modify: various components (add `focus-ring` class to interactive elements missing it)

- [ ] **Step 1: Audit + add focus-ring**

Search for buttons/links that have `hover:bg-` but lack `focus-ring`. Key spots to add `focus-ring` to className:
- `src/components/VectorMemoryExplorer.tsx`: the blacklist/cache `<button>` elements (~lines 171-186) — add `focus-ring`.
- `src/components/AuditTrail.tsx`: pagination buttons (~lines 258-299) — add `focus-ring`.
- `src/components/SettingsPanel.tsx`: the sources chips are non-interactive; action buttons already have it via existing classes; the range `<input>` elements add `focus-ring`.

Use Grep to find `hover:bg-` occurrences without nearby `focus-ring` and add the class.

Run search: `Grep pattern="hover:bg-" path="src/components"` then review each result for a missing `focus-ring` on the same element.

- [ ] **Step 2: Add aria-live to KPI value region**

In `src/components/KpiCard.tsx`, the value `<p>` (line ~104): add `aria-live="polite"` so screen readers announce updates.
```tsx
        <p
          className="text-2xl font-bold text-[var(--color-heading)] tabular-nums"
          style={{ fontFamily: "var(--font-serif)" }}
          aria-live="polite"
        >
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat(a11y): add focus-ring to interactive elements, aria-live to KPI values"
```

---

### Task 7.4: Final full verification

- [ ] **Step 1: Clean production build**

Run: `npm run lint && npm run build`
Expected: both pass with zero errors.

- [ ] **Step 2: Manual visual checklist**

Run `npm run dev` and verify each:
- `/` Dashboard: KPI sparklines animate, freshness pill live, circuit breaker confirm modal, approval radial gauges, notifications bell badge, comm panel copy updated
- `/analytics`: charts reflect theme colors, toggle theme → charts update
- `/agents` (new): two hero cards, metrics, pause/resume
- `/memory`: blacklist confirm modal, empty state
- `/history`: pagination, search, CSV export
- `/settings`: save/reset, density toggle works, sources chips
- Global: theme 3-mode toggle, `?` keyboard help, onboarding tour (clear localStorage to see), command palette "Restart Onboarding"
- Mobile width: navbar collapses, sidebar overlay, transaction cards

- [ ] **Step 3: Final commit (if any stragglers)**

```bash
git add -A
git commit -m "chore: final polish pass for visual evolution v3" --allow-empty
```

---

## Self-Review Notes

**Spec coverage check:**
- §3 Foundation (tokens, chart sync, system theme, density) → Tasks 1.1-1.4 ✅
- §4 Copy & Voice → Tasks 2.1-2.3 ✅
- §5.1 Agents page → Task 4.6 ✅
- §5.2 Notifications → Tasks 4.1, 4.5 ✅
- §5.3 ConfirmModal → Tasks 4.2, 4.3, 4.4 ✅
- §5.4 RadialGauge + ScoreBreakdown → Tasks 5.1-5.3 ✅
- §5.5 Data Freshness → Tasks 3.2-3.4 ✅
- §5.6 System Theme → Tasks 1.2, 6.2 ✅
- §5.7 Keyboard Help → Task 6.4 ✅
- §5.8 Onboarding → Task 7.1 ✅
- §5.9 Density Toggle → Tasks 1.1, 6.1, 6.3 ✅
- §5.10 Empty/Loading → Task 7.2 ✅
- §6 Component Polish (KPI sparkline, navbar, sidebar, responsive, a11y) → Tasks 3.1, 3.5, 3.6, 7.3 ✅

**Placeholder scan:** No TBD/TODO; all steps have concrete code or commands.

**Type consistency:** `useChartColors` keys match AnalyticsCharts usage; `AppNotification`/`AgentHealth`/`AppPreferences`/`Density`/`ThemeMode` types defined in Task 4.1 and referenced consistently in Tasks 4.5, 4.6, 6.3, 7.1. `SegmentedControl` generic `<T extends string>` used with `ThemeMode` and `Density`. ✅

**Known acceptable gaps (documented in tasks):**
- Density toggle is fully wired (state + `data-density` + persistence) but only components that opt into `--spacing-scale` will visually change. This lays the foundation; full propagation is a future enhancement, noted in Task 6.3 Step 2.
- `prefers-color-scheme` CSS-only fallback (Task 1.1 Step 4) re-declares a minimal token subset; the JS script (Task 1.2) handles the full resolution in practice, so the CSS fallback only matters if JS is disabled.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-19-visual-evolution-v3.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
