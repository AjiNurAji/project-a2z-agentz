# Project: A2Z Agent Dashboard Visual Evolution v3

## Architecture

- **Module / package boundaries**:
  - Frontend built with Next.js (App Router), Tailwind CSS, TypeScript, and React.
  - State management is centralized in `DashboardProvider` from `DashboardContext.tsx`. Live data is fed through `useAgentWebSocket.ts`, which connects to the backend WebSocket and normalizes events into context state. The context also exposes periodic simulation updates as a fallback when the live connection is unavailable.
  - Custom React hooks under `dashboard/src/hooks/` modularize behavior (theme, preferences, keyboard shortcuts, data freshness, WebSocket connectivity).
  - Page-level and layout components live under `dashboard/src/components/`, while shared UI primitives live under `dashboard/src/components/ui/`.
  - Routes are organized as route groups: active dashboard pages under `dashboard/src/app/(dashboard)/` and authentication pages under `dashboard/src/app/(auth)/`.

- **Current active dashboard route**: `dashboard/src/app/(dashboard)/page.tsx`
- **Live WebSocket client**: `dashboard/src/hooks/useAgentWebSocket.ts`

- **Data flow**:
  - `useAgentWebSocket.ts` opens a WebSocket connection, listens for `AGENT_LOG`, `SYSTEM_LOG`, and `TX_UPDATE` events, and pushes normalized payloads into `DashboardContext.tsx`.
  - Theme and density settings resolve at runtime via CSS custom properties on `document.documentElement`, persisted to `localStorage`.
  - All consumer components (`DashboardKpis`, `CircuitBreaker`, `AgentCommPanel`, `LiveLog`, `ApprovalQueue`, `TransactionList`) read exclusively from context — zero direct backend coupling.

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
