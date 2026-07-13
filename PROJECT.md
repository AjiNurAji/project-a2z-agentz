# Project: A2Z Agentz — Autonomous A2A Web3 Trading Engine

**Current Version**: Production-ready with DEX swaps, take-profit, GoPlus security.

## Architecture

- **Backend**: Python 3.12, Starlette, PostgreSQL, asyncio daemons
  - Agent A: DexScreener scraper + data-driven LLM scoring (AMD MI300X via vLLM)
  - Agent B: GoPlus security gate + Uniswap V2 DEX swaps + take-profit automation
  - Multi-RPC resilience with exponential backoff
  - WebSocket real-time broadcast to dashboard

- **Frontend**: Next.js 16, React 19, Tailwind CSS v4, TypeScript
  - Dashboard: KPIs, agents page with vault holdings, live log, circuit breaker
  - API: `/api/holdings`, `/api/stats`, `/api/system-status` (all real checks)
  - Deployed on Vercel (`project-a2z-agentz-gamma.vercel.app`)

- **Data flow**:
  - DexScreener → Agent A scoring → PostgreSQL scraping_queue → Agent B GoPlus check → Uniswap swap → held_tokens → take-profit monitor → auto-sell
  - WebSocket broadcasts every inference, buy, sell, and take-profit event

- **Shared interfaces**:
  - System theme and density are broadcast globally through CSS custom properties.
  - `ConfirmModal` callbacks (`onConfirm`, `onCancel`) are wired to approval, blacklist, and circuit-breaker actions.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Theme & Design Foundations | Global theme system, `useTheme.ts` refactoring, system-theme media queries, Tailwind custom tokens, FOUC prevention | None | COMPLETED |
| 2 | Reusable Components & Copy | Professional copy, reusable `Sparkline`, `RadialGauge`, `ScoreBreakdown`, `ConfirmModal` | M1 | COMPLETED |
| 3 | Dynamic State & Real-Time Panels | Data freshness system, `useDataFreshness`, `FreshnessPill`, `DashboardContext` + WebSocket-driven updates, `NotificationsPanel` | M2 | COMPLETED |
| 4 | Help Overlay & Onboarding | `KeyboardHelpOverlay`, `OnboardingTour`, `useKeyboardShortcut` | M3 | COMPLETED |
| 5 | Agents Page & Sidebar | `/agents` route, status cards, health metrics, manual controls, Sidebar link | M4 | COMPLETED |

## Interface Contracts

### `useTheme`
- **Signature**: `function useTheme(): { theme: 'light' | 'dark' | 'system', setTheme: (theme: 'light' | 'dark' | 'system') => void }`
- **Behavior**: Syncs with `localStorage` using the key `a2z-theme`, updates class and attribute state on the document element, and listens for system-theme media-query changes.

### `useChartColors`
- **Signature**: `function useChartColors(): { colors: { primary: string, secondary: string, glow: string, accent: string } }`
- **Behavior**: Resolves Tailwind tokens and custom glow effects from CSS custom properties, keeping charts in sync with theme changes.

### `useDataFreshness`
- **Signature**: `function useDataFreshness(lastSync: number): { relativeText: string }`
- **Behavior**: Recalculates relative timestamps (e.g., "just now", "5s ago") on a 1-second interval.

### `ConfirmModal`
- **Signature**:
  ```typescript
  interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
  }
  ```

### `RadialGauge`
- **Signature**:
  ```typescript
  interface RadialGaugeProps {
    score: number; // 0 to 100
    label?: string;
  }
  ```

### `ScoreBreakdown`
- **Signature**:
  ```typescript
  interface ScoreBreakdownProps {
    sentiment: number; // 0 to 100
    tvl: number; // 0 to 100
    sentimentWeight: number; // e.g. 0.5
    tvlWeight: number; // e.g. 0.5
  }
  ```

## Code Layout
- **Custom hooks**: `dashboard/src/hooks/`
- **Reusable UI primitives**: `dashboard/src/components/ui/`
- **Layout and page components**: `dashboard/src/components/`
- **Routing pages**: `dashboard/src/app/(dashboard)/page.tsx` (active dashboard route)
