# Project: A2Z Agent Dashboard Visual Evolution v3

## Architecture
- Module/package boundaries:
  - Frontend built with Next.js (App Router), Tailwind CSS, TypeScript, and React.
  - State management uses a global context `DashboardProvider` in `DashboardContext.tsx` providing mock simulation data.
  - Custom React Hooks are used under `src/hooks/` to modularize features (theme, preferences, keyboard shortcuts, etc.).
  - Components are divided into common elements directly under `src/components/` and shared primitive UI widgets under `src/components/ui/`.
- Data flow:
  - The simulation data updates periodically, triggering state updates in `DashboardContext.tsx`.
  - The theme setting resolves dynamically on load, applying light/dark/system themes via Tailwind classes on `document.documentElement` and writing properties to localStorage.
- Shared interfaces:
  - System themes and density are applied globally, reflecting via CSS custom properties on `document.documentElement`.
  - ConfirmModal triggers callbacks (e.g., `handleApprove`, `handleReject`, `handleBlacklist`) based on user confirmation.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Theme & Design Foundations | Global theme system, `useTheme.ts` refactoring, system theme media queries, Tailwind custom tokens, inline paint prevention. (R1, R2, R6 theme/density variables) | None | PLANNED |
| 2 | Reusable Components & Copy | Professional copy rewrite, reusable Sparkline component, RadialGauge, ScoreBreakdown, ConfirmModal. (R3, R4, R7, R8) | M1 | PLANNED |
| 3 | Dynamic State & Real-Time Panels | Data freshness system, useDataFreshness, FreshnessPill, DashboardContext simulation changes, NotificationsPanel. (R5, R9) | M2 | PLANNED |
| 4 | Help Overlay & Onboarding | KeyboardHelpOverlay, OnboardingTour, useKeyboardShortcut hook. (R10) | M3 | PLANNED |
| 5 | New Agents Page & Sidebar | /agents route, loading view, status cards, health metrics, manual controls, Sidebar link. (R11) | M4 | PLANNED |

## Interface Contracts
### `useTheme`
- Signature: `function useTheme(): { theme: 'light' | 'dark' | 'system', setTheme: (theme: 'light' | 'dark' | 'system') => void }`
- Behavior: Syncs with `localStorage` (key: `a2z-theme`). Updates class list on document element and adds/removes media query listener.

### `useChartColors`
- Signature: `function useChartColors(): { colors: { primary: string, secondary: string, glow: string, accent: string } }`
- Behavior: Automatically resolves standard Tailwind variables and custom glow effects from CSS custom properties.

### `useDataFreshness`
- Signature: `function useDataFreshness(lastSync: number): { relativeText: string }`
- Behavior: Recalculates time elapsed (e.g., "just now", "5s ago") using a 1s interval.

### `ConfirmModal`
- Signature:
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
- Signature:
  ```typescript
  interface RadialGaugeProps {
    score: number; // 0 to 100
    label?: string;
  }
  ```

### `ScoreBreakdown`
- Signature:
  ```typescript
  interface ScoreBreakdownProps {
    sentiment: number; // 0 to 100
    tvl: number; // 0 to 100
    sentimentWeight: number; // e.g. 0.5
    tvlWeight: number; // e.g. 0.5
  }
  ```

## Code Layout
- Custom Hooks: `dashboard/src/hooks/`
- Reusable UI Components: `dashboard/src/components/ui/`
- Standard Layout Components: `dashboard/src/components/`
- Routing Pages: `dashboard/src/app/`
