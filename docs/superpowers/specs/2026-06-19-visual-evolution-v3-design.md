# A2Z Agent Dashboard — Visual Evolution v3 (Maximal)

**Date:** 2026-06-19
**Status:** Design — pending user review
**Scope:** Visual refine + professional copy rewrite + 10 new features across all pages
**Stack:** Next.js 16, React 19, Tailwind v4, Motion (Framer), Recharts, Lucide
**Direction:** Refinement evolution (preserve the muted-purple identity, strengthen with strategic accents + depth layering)

---

## 1. Context & Motivation

The A2Z Agent dashboard (multi-agent autonomous airdrop scavenger + A2A payments on Base Network) has gone through a "visual overhaul v2" (50 tasks). Critical analysis found genuine gaps worth closing, not invented work:

- **Palet monokrom** — hampir semua ungu; accent teal/cyan/orange didefinisikan tapi underused.
- **Chart colors hardcoded** in `AnalyticsCharts.tsx` (two large hex constants) → not synced with CSS vars, duplicates the source of truth.
- **Copy inkonsisten/santai** — `"vs 72% avg"`, `"Kill Switch"`, `"All clear"`, `"awaiting approval"`.
- **Bell icon in Navbar is non-functional** — the notification panel does not exist yet.
- **No Agents page** — agent status is only tucked into the sidebar.
- **Destructive actions without confirmation** (pause, blacklist, high-value reject).
- **No score visualization** — the LLM score is just a number.
- **Manual theme only** — no auto/system option.
- **No discoverability** for the existing keyboard shortcuts (`1-5`, `⌘K`).
- **No onboarding** for the first-run user.

---

## 2. Design Decisions

### 2.1 Visual Direction: Evolusi Refine
Pertahankan estetika muted-purple sebagai identitas brand, tapi perkuat:
- Use accents (teal/cyan/orange) **semantically & strategically** for distinct data.
- Add depth: 3-tier elevation, subtle glassmorphism on floating panels, soft glow on interactive elements.
- Fix contrast, spacing, and radius consistency.

### 2.2 Scope: Maximal (all features)
Visual + copy + 10 new features (see §5).

---

## 3. Foundation: Color Tokens & Design System

### 3.1 Semantic color mapping (consistent app-wide)
| Warna | Penggunaan |
|---|---|
| 💜 Purple (brand) | Identity — active nav, headers, structure |
| 🟢 Green | success / online / approved / confirmed |
| 🟠 Amber | gas / warning / pending |
| 🔴 Red | danger / failed / rejected |
| 🩵 Cyan | Vault / Agent B |
| 💟 Teal | transactions / on-chain |
| 🟦 Sky/Blue | sentiment / scanning |

### 3.2 Chart color sync
- **Remove** the hardcoded `CHART_COLORS_DARK`/`CHART_COLORS_LIGHT` constants in `AnalyticsCharts.tsx`.
- **Add** the `useChartColors()` hook — read CSS vars via `getComputedStyle(document.documentElement)`, resolve to a color object. Re-read when the theme changes (subscribe to `useTheme()` + `window.matchMedia('(prefers-color-scheme: dark)')` for system mode).
- Fall back to default values before mount (SSR-safe); re-read in `useEffect` after mount.

### 3.3 New tokens (globals.css `:root` + light theme)
```
--color-accent-teal-bright
--color-accent-cyan-bright
--color-glow-brand          /* rgba, for hover glow */
--color-glow-danger
--spacing-scale             /* multiplier for the density toggle */
```

### 3.4 Depth / elevation system
3 tier via class utility:
- `.elevation-1` — flat (table rows, list items): subtle border, no shadow
- `.elevation-2` — card (default panels): card gradient + `--shadow-xs`
- `.elevation-3` — elevated (modals, dropdowns, portaled panels): `--shadow-xl` + blur backdrop

### 3.5 Theme: system option
- ThemeToggle jadi **SegmentedControl 3-ikon** (Sun / System / Moon).
- `system` → ikut `prefers-color-scheme` media query.
- Persist the choice in the localStorage key `a2z-theme` (reuse the existing key, new value `"system"`).
- The inline script in `<head>` (already present) is extended to resolve `"system"` → computed theme before paint.

---

## 4. Copy & Voice Guide (Professional English)

### 4.1 Voice principles
- **Precision over jargon** — explain technical terms when first introduced.
- **Active voice, ringkas** — "Transactions executed" bukan "Transactions that completed successfully".
- **Status as a label** — "Active" not "All clear".
- **Danger clear, not melodramatic** — "Pause" not "Kill Switch".

### 4.2 Rewrite table (before → after)
| Lokasi | Sekarang | Setelah |
|---|---|---|
| KPI trend (TVL) | `"Live tracking"` | `"Above 30-day average"` |
| KPI trend (Success) | `"vs 72% avg"` | `"Above 30-day average"` |
| KPI trend (Gas) | `"+15% efficiency"` | `"+15% vs last cycle"` |
| KPI subValue (Gas) | `"via oracle optimization"` | `"Oracle-optimized gas"` |
| KPI subValue (Total Txs) | `"on Base Network"` | `"Base mainnet"` |
| KPI subValue (Alerts) | `"awaiting approval"` | `"Need review"` |
| Circuit Breaker desc | `"Emergency Kill Switch — halts all Agent B on-chain activity instantly."` | `"Pause all Agent B on-chain execution. Transactions queue but are not broadcast until resumed."` |
| Circuit status badge | `"PAUSED"` / `"ACTIVE"` | `"Paused"` / `"Running"` |
| Pause alert body | `"SYSTEM PAUSED: All automated payouts are blocked. Agent B will not broadcast any transactions until you resume operations."` | `"Execution paused. Agent B will not broadcast transactions. Queued items are preserved and can be resumed."` |
| Approval reason | `"TVL > $5M & KOL engagement detected. Exceeds $2 cap — requires manual approval."` | `"TVL exceeds $5M with strong KOL engagement. Amount is above the $2 autonomous limit and requires manual approval."` |
| Empty queue | `"All transactions are within the $2 autonomous limit. Agent B executes directly."` | `"No pending approvals. Transactions under $2 execute automatically."` |
| Page desc (Analytics) | `"Interactive visualization of agent performance, TVL trends, gas pricing, and transaction success metrics"` | `"Agent performance, TVL trends, gas pricing, and transaction outcomes."` |
| Page desc (Memory) | `"ChromaDB semantic cache — indexed embeddings, similarity scores, and Agent A project memory"` | `"Semantic memory cache. Indexed embeddings, similarity scores, and recognized project patterns."` |
| Page desc (History) | `"Complete paginated log of all agent transactions — approvals, rejections, and raw cryptographic payloads"` | `"Full transaction log — approvals, rejections, and signed payloads."` |
| Page desc (Settings) | `"Tune Agent A scoring parameters, Agent B execution limits, and RPC configuration"` | `"Configure Agent A scoring, Agent B execution limits, and RPC endpoints."` |
| Toast: Approved body | `"sent to Agent B"` | `"Forwarded to Agent B for execution"` |
| Bell aria | `"X pending approvals"` | `"X items need review — open notifications"` |
| Comm panel empty | `"Waiting for agents..."` | `"Connecting to agents"` |
| Comm panel empty sub | `"Agent A (Scout) and Agent B (Vault) will appear here"` | `"Scout and Vault messages will appear here"` |
| Dashboard hero desc | `"Real-time overview of all autonomous agent activity on Base Network"` | `"Live activity of both autonomous agents on Base Network."` |

### 4.3 Status label convention (global, consistent)
- **Agent status:** `Running` · `Scanning` · `Analyzing` · `Executing` · `Paused` · `Offline` (title case, not ALL CAPS)
- **Transaction status:** `Confirmed` · `Failed` · `Pending` (display labels; underlying data values unchanged)
- **Log level badge:** `SYS` · `WARN` · `OK` · `ERR` · `SCOUT` · `VAULT` (SCOUT/VAULT menggantikan SCT/VLT)

### 4.4 New microcopy (for §5 features)
- Data freshness: `"Last sync: 2s ago"`
- Onboarding step 1: `"This is Mission Control — your live view of both autonomous agents."`
- Destructive confirm: `"This will pause all on-chain activity. Are you sure?"`
- Keyboard help title: `"Keyboard Shortcuts"`

---

## 5. New Features (10)

### 5.1 Agents Page (`/agents`) — NEW
A unified panel for both agents (currently status is scattered across the sidebar/navbar).
- Per-agent hero: avatar, name (Scout/Vault), role, large status badge, uptime %, last active.
- Health metrics: latency (ms), inference time, success/fail count, queue depth.
- Mini charts: latency sparkline, throughput bar (7-day).
- Action buttons: per-agent Pause/Resume, View logs, View config (link to Settings).
- Live activity feed ringkas per agent.
- New Sidebar nav item, icon `Bot`, label "Agents".

### 5.2 Notifications Panel (Bell) — NEW
The Navbar bell icon is currently non-functional.
- Dropdown panel (elevation-3, glassmorphism) on click.
- Gabungan: approval alerts (priority), tx failures, agent state changes, threshold breaches.
- Each item: icon + title + relative time + action link.
- Footer: `"View all in Audit Trail"`.
- "Mark all as read" + badge count live.
- Data source: extend `DashboardContext` with `notifications[]`.

### 5.3 Destructive Action Confirmation Modal — NEW
Pause/blacklist/high-value reject currently run immediately — dangerous for DeFi.
- Reusable `<ConfirmModal>` component with variants: `danger`, `warning`, `info`.
- Content: icon, title, description, item details (project, amount), Cancel + Confirm buttons.
- Wiring: Circuit Breaker pause, Blacklist, Reject approval (when `amountUsd > $5`), Clear cache.
- Keyboard accessible (Enter=confirm, Escape=cancel, focus trap).

### 5.4 Score Breakdown Radial Gauge — NEW
The LLM score is currently just a number.
- Radial gauge (SVG arc) on the ApprovalQueue item + Agents page: score 0-100 with a color band.
- Breakdown split bar: Sentiment (purple) vs TVL (teal) — proportion from the Settings weights.
- Hover/expand: `"Sentiment 70pts · TVL 28pts · Total 98/100"`.
- Reuse the existing sparkline SVG pattern.

### 5.5 Data Freshness Indicator — NEW
- Global: pill in the Navbar `"Live · synced 2s ago"` (updates every second).
- Per-panel: small timestamp `"Updated Xs ago"` in the header card.
- Green <10s, amber <60s, red >60s + manual refresh button.

### 5.6 System Theme Option — NEW (lihat §3.5)

### 5.7 Keyboard Shortcuts Help (`?`) — NEW
- Overlay listing all shortcuts when `?` is pressed.
- Categories: Navigation, Actions, Accessibility.
- Discoverable via a Tooltip in CommandCenter.

### 5.8 Onboarding Tour — NEW
- First-visit (deteksi localStorage flag) → tour 4-langkah:
  1. Mission Control overview
  2. Agent status (sidebar)
  3. Approval Queue (how to approve/reject)
  4. Command palette (`⌘K`)
- Spotlight overlay + tooltip arah + Skip/Done.
- Re-trigger via Settings atau command palette.

### 5.9 Density Toggle — NEW
- Compact / Comfortable / Spacious (change `--spacing-scale` via the root class `data-density`).
- Persist preference via `usePreferences()`.
- Useful for data-dense views (Audit Trail, Memory) vs reading.

### 5.10 Empty/Loading consistency pass
- Audit all empty states using the existing `EmptyState` component.
- Ensure the `loading.tsx` skeleton matches the final layout of each page.

---

## 6. Component Polish (global)

### 6.1 KpiCard upgrade
- Add a mini sparkline (7-point) below the value for TVL, Success Rate, Total Txs.
- Data freshness badge `"Updated Xs ago"` in the card corner.
- Trend arrow + real percentage delta (computed from data), not a hardcoded string.

### 6.2 Navbar enhancement
- Agent status pills become compact & clickable → open the Agents page.
- Bell: badge count + hover/click dropdown (notification panel).
- Global data freshness indicator.
- At `<sm`: merge `Base Network` + `AMD MI300X` into one pill.

### 6.3 Sidebar polish
- Agent status panel: add uptime % & last inference time.
- When collapsed (72px), still show a status dot on each nav item.
- Extract Sparkline into a reusable component.

### 6.4 Responsif fixes
- Navbar `<sm`: hide agent status → move to the Agents page + bell badge.
- Approval Queue mobile: bottom sheet, not a narrow panel.
- TransactionList table mobile: horizontal scroll with a shadow edge indicator.
- Circuit Breaker mobile: stack vertical rapi.

### 6.5 Accessibility hardening
- Consistent focus ring (`focus-ring` class) on ALL interactive elements.
- `aria-live` for KPI value changes.
- Color contrast: ensure `--color-fg-disabled` on a dark background meets AA (4.5:1 minimum).
- ConfirmModal, NotificationsPanel, OnboardingTour: focus trap + return focus.

---

## 7. Architecture & Data Flow

### 7.1 DashboardContext extension (additive only)
```
+ notifications: Notification[]
+ addNotification(type, title, body, link?)
+ markNotificationsRead()
+ unreadCount: number
+ agentHealth: { a: AgentHealth; b: AgentHealth }
+ preferences: { theme, density, onboarded }
+ setPreferences(partial)
+ lastSync: number
```
All fields are **additive** — they do not change the existing signature. The existing simulation generator is extended to populate `notifications` & `agentHealth` from the same events (no duplicated logic).

### 7.2 New hooks (isolated, testable)
- `useChartColors()` — read CSS vars via `getComputedStyle` + `useTheme`, resolve to a chart color object. Single source of truth. Fallback pre-mount.
- `useDataFreshness(lastSync)` — compute `secondsAgo`, expose `{ seconds, label, status: 'fresh'|'stale'|'dead', color }`. Throttled to 1s.
- `usePreferences()` — wrapper localStorage + state sync (theme, density, onboarded).
- `useKeyboardShortcut(key, handler, opts)` — generalize the pattern already in CommandPalette/useKeyboardNav.

### 7.3 New UI components (`src/components/ui/`)
- `ConfirmModal.tsx` (5.3)
- `RadialGauge.tsx` (5.4)
- `FreshnessPill.tsx` (5.5)
- `SegmentedControl.tsx` (5.6, 5.9)
- `KeyboardHelpOverlay.tsx` (5.7)
- `OnboardingTour.tsx` (5.8)
- `ScoreBreakdown.tsx` (5.4)
- `NotificationsPanel.tsx` (5.2)
- `Sparkline.tsx` (extracted from Sidebar, 5.2/6.1)

### 7.4 Data flow
- Simulation tick events (existing) → side-effect `addNotification()` when: tx failed, new approval, agent state change, threshold breach. Dedupe by type+key within a 10s window.
- `agentHealth` updated incrementally every tick (rolling avg latency, count, uptime).
- Preferences flow: `usePreferences()` → root `<html>` class toggle (`data-density`, `data-theme`) → CSS vars handle sisanya.

### 7.5 CSS additions (globals.css)
- New tokens (§3.3).
- Density: `html[data-density="compact"] { --spacing-scale: 0.85 }` applied to padding/gap via `calc(var(--spacing-scale) * ...)`.
- Elevation utilities: `.elevation-1/2/3`.
- `prefers-color-scheme` media query for auto-theme fallback.

### 7.6 No new dependencies
All use the existing motion + lucide + recharts.

---

## 8. Testing, Phasing & Rollout

### 8.1 Testing strategy
- **Unit**: hooks pure logic (`useDataFreshness`, `usePreferences` localStorage, score breakdown math).
- **Component**: ConfirmModal focus trap, RadialGauge value→arc, NotificationsPanel empty/populated.
- **Integration**: simulation tick → notification appears → bell badge updates.
- **Gate minimum**: ESLint pass + `next build` clean per phase.

### 8.2 Phase breakdown (7 phase, sequential, tiap phase independently shippable)
| Phase | Konten | Output |
|---|---|---|
| **P1 — Foundation** | New color tokens, `useChartColors`, AnalyticsCharts sync, `prefers-color-scheme`, density token | Chart & theme auto-sync, base ready |
| **P2 — Copy & Voice** | Rewrite all copy per §4, standardize status labels | Professional language app-wide |
| **P3 — Component Polish** | Depth/elevation system, KpiCard sparkline+freshness, Navbar reorg, Sidebar dot+uptime, responsive fixes, a11y focus-ring pass | Visual consistency across pages |
| **P4 — New Pages & Panels** | Agents page, NotificationsPanel wiring Bell, ConfirmModal + destructive wiring | Core functional gaps closed |
| **P5 — Data Viz** | RadialGauge + ScoreBreakdown in ApprovalQueue & Agents, global+per-panel data freshness | Score & sync-status visualization |
| **P6 — Power-user Features** | System theme (SegmentedControl), Keyboard help `?`, Density toggle | Preference control & discoverability |
| **P7 — Onboarding & Final Pass** | Onboarding tour, empty/loading consistency, final a11y audit, edge-case polish | First-run experience + thorough |

### 8.3 Manual validation checklist (per page)
- **Dashboard**: KPI sparkline animate, freshness live, circuit breaker confirm modal, comm panel auto-scroll.
- **Analytics**: chart colors sync theme switch, tooltip readable, legend a11y.
- **Memory**: filter works, blacklist confirm, empty state, mobile cards.
- **History**: pagination, search filter, CSV export, expand detail.
- **Settings**: save/reset, range sliders, sources chips, density effect live.
- **Agents (new)**: health metrics render, per-agent pause, charts.
- **Global**: 3-mode theme toggle, density toggle, keyboard help, onboarding skip/replay, notifications read/unread.

### 8.4 Rollout & risk
- Each phase = 1 commit/PR boundary, can be reverted in isolation.
- Risk tertinggi: P1 (token) & P4 (context mutation) — diuji paling teliti.
- No breaking change to API/data — all additive.
- PWA/SW not affected (does not touch `sw.js`/manifest).

---

## 9. Out of Scope (YAGNI)
- Large refactor of `DashboardContext.tsx` (475 lines) — only extend it, do not split it.
- Backend/API integration — stays client-side simulation.
- i18n/multi-language — professional English copy only, per request.
- New chart types beyond existing (radar, heatmap) — reuse area/bar/sparkline.
- Mobile native app / total responsive redesign.
- Dark/light theme palette overhaul radikal — refine only.

---

## 10. Files Touched (estimasi)

**Modified:**
- `src/app/globals.css` — new tokens, elevation, density, prefers-color-scheme
- `src/app/layout.tsx` — density class, theme resolve script
- `src/app/page.tsx`, `analytics/page.tsx`, `memory/page.tsx`, `history/page.tsx`, `settings/page.tsx` — copy + minor layout
- `src/components/DashboardContext.tsx` — additive state (notifications, agentHealth, preferences, lastSync)
- `src/components/AnalyticsCharts.tsx` — uses `useChartColors()`
- `src/components/KpiCard.tsx` — sparkline + freshness + delta
- `src/components/DashboardKpis.tsx` — copy rewrite
- `src/components/Navbar.tsx` — reorg + freshness + notifications
- `src/components/Sidebar.tsx` — status dot, uptime, extract Sparkline, copy
- `src/components/CircuitBreaker.tsx` — copy + ConfirmModal wiring
- `src/components/ApprovalQueue.tsx` — copy + ConfirmModal + RadialGauge
- `src/components/AgentCommPanel.tsx` — copy
- `src/components/LiveLog.tsx` — badge labels
- `src/components/TransactionList.tsx` — status labels + mobile scroll
- `src/components/VectorMemoryExplorer.tsx` — blacklist confirm + empty state
- `src/components/AuditTrail.tsx` — copy + empty state
- `src/components/SettingsPanel.tsx` — copy + density + onboarding replay
- `src/components/PageHeader.tsx` — copy consistency
- `src/components/ui/ThemeToggle.tsx` — SegmentedControl 3-mode
- `src/components/ui/CommandPalette.tsx` — onboarding + help commands
- `src/app/agents/page.tsx` — NEW
- `src/app/agents/loading.tsx` — NEW

**New files:**
- `src/components/ui/ConfirmModal.tsx`
- `src/components/ui/RadialGauge.tsx`
- `src/components/ui/ScoreBreakdown.tsx`
- `src/components/ui/FreshnessPill.tsx`
- `src/components/ui/SegmentedControl.tsx`
- `src/components/ui/KeyboardHelpOverlay.tsx`
- `src/components/ui/OnboardingTour.tsx`
- `src/components/ui/NotificationsPanel.tsx`
- `src/components/ui/Sparkline.tsx`
- `src/hooks/useChartColors.ts`
- `src/hooks/useDataFreshness.ts`
- `src/hooks/usePreferences.ts`
- `src/hooks/useKeyboardShortcut.ts`
