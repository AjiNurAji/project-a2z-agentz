# Original User Request

## Initial Request — 2026-06-19T13:24:54Z

Implement the A2Z Agent Dashboard Visual Evolution v3, which includes a visual polish, rewrite of all copy to professional English, and the implementation of 10 new features (such as an Agents page, Notifications, ConfirmModal, RadialGauge, Data Freshness, System Theme, Keyboard Help, Onboarding, Density Toggle, and Empty/Loading consistency).

Working directory: `c:\Projects\project-a2z-agentz`

## Requirements

### R1. Theme & Design System Foundations
Implement new color tokens (accent, glow, spacing scale), an elevation system, and a system theme preference fallback (using media queries for prefers-color-scheme). Extend `useTheme.ts` and the root layout script to support 'system' mode dynamically with no flash of unstyled content (FOUC).
- Modified: `dashboard/src/app/globals.css`
- Modified: `dashboard/src/app/layout.tsx`
- Modified: `dashboard/src/hooks/useTheme.ts`

### R2. useChartColors Hook & Analytics Sync
Create a client-side hook `useChartColors.ts` to read Tailwind/CSS variable tokens and return them as chart colors. Update `AnalyticsCharts.tsx` to read colors from this hook instead of using hardcoded hex values, ensuring charts dynamically adapt to theme changes.
- New: `dashboard/src/hooks/useChartColors.ts`
- Modified: `dashboard/src/components/AnalyticsCharts.tsx`

### R3. Professional Copy & Voice Guidelines
Rewrite all copy, labels, descriptions, empty states, and toasts across all pages and components into professional English following the voice guidelines in the design spec (e.g., "Running"/"Paused" instead of "ACTIVE"/"PAUSED", "Pause" instead of "Kill Switch", etc.).
- Modified: All Page headers, KPI cards, Circuit Breaker, Approval Queue, Live Log, Comm Panel, Settings Panel, etc.

### R4. Reusable Sparkline & Uptime
Extract a reusable SVG `<Sparkline>` component from the sidebar and use it in the sidebar and other places. Add uptime indicators (99.8%) to the agent status panels.
- New: `dashboard/src/components/ui/Sparkline.tsx`
- Modified: `dashboard/src/components/Sidebar.tsx`

### R5. Data Freshness System (Indicator + Pill)
Implement a `useDataFreshness` hook and a `<FreshnessPill>` component. Add a global freshness pill in the Navbar showing last sync relative time (updated every second) and per-panel status indicators.
- New: `dashboard/src/hooks/useDataFreshness.ts`
- New: `dashboard/src/components/ui/FreshnessPill.tsx`
- Modified: `dashboard/src/components/DashboardContext.tsx` (expose `lastSync` and update on sim tick)
- Modified: `dashboard/src/components/Navbar.tsx`

### R6. Preferences & Keys (Density Toggle & SegmentedControl)
Create `usePreferences.ts` and `useKeyboardShortcut.ts` hooks. Implement `<SegmentedControl>` for 3-mode theme selection (Sun/System/Moon) and density selection (Compact/Comfortable/Spacious), applying variables dynamically to the root element.
- New: `dashboard/src/hooks/usePreferences.ts`
- New: `dashboard/src/hooks/useKeyboardShortcut.ts`
- New: `dashboard/src/components/ui/SegmentedControl.tsx`

### R7. ConfirmModal for Destructive Actions
Build a reusable `<ConfirmModal>` component (variants: danger, warning, info) with a focus trap and keyboard accessibility. Integrate it into Circuit Breaker (pausing), Blacklist actions, and Approval Queue (rejecting high-value items).
- New: `dashboard/src/components/ui/ConfirmModal.tsx`

### R8. Score Visualization (RadialGauge & ScoreBreakdown)
Create `<RadialGauge>` (SVG arc) and `<ScoreBreakdown>` components. Integrate them in `ApprovalQueue` and the new Agents page to visualize LLM scores and split sentiment vs. TVL weights.
- New: `dashboard/src/components/ui/RadialGauge.tsx`
- New: `dashboard/src/components/ui/ScoreBreakdown.tsx`

### R9. Notifications Panel
Create a `<NotificationsPanel>` dropdown component inside Navbar connected to the Bell icon. Expose notification events in `DashboardContext` (state transitions, TVL threshold breaches, transaction failures, manual approvals).
- New: `dashboard/src/components/ui/NotificationsPanel.tsx`

### R10. Keyboard Help & Onboarding Tour
Implement a keyboard shortcuts reference overlay (`?`) and a 4-step guided onboarding tour (`OnboardingTour`) for first-time visitors using Spotlight overlays.
- New: `dashboard/src/components/ui/KeyboardHelpOverlay.tsx`
- New: `dashboard/src/components/ui/OnboardingTour.tsx`

### R11. New Agents Overview Page (`/agents`)
Create a new page `/agents` with large status cards, health metrics (latency, inference time, success/fail counts), throughput bar charts, and pause/resume buttons. Link it in the Sidebar.
- New: `dashboard/src/app/agents/page.tsx`
- New: `dashboard/src/app/agents/loading.tsx`

## Acceptance Criteria

### Compilation & Types
- [ ] Running `npm run lint` inside the `dashboard/` directory passes with no errors.
- [ ] Running `npm run build` inside the `dashboard/` directory succeeds with zero TypeScript or Next.js build issues.

### Functional Requirements
- [ ] Theme switching works seamlessly between Light, Dark, and System modes with no FOUC.
- [ ] Changing the density toggle (Compact/Comfortable/Spacious) dynamically shrinks/expands spacing via Tailwind variables.
- [ ] ConfirmModal traps focus and handles Escape/Enter properly on all triggers.
- [ ] The global Sync pill in the Navbar updates dynamically and responds to the Circuit Breaker state.
- [ ] RadialGauge and ScoreBreakdown render correctly inside the Approval Queue and Agents page.
- [ ] Keyboard shortcut `?` opens the shortcuts help overlay successfully.
- [ ] Onboarding Tour triggers on first visit (using a localStorage flag) and can be replayed from settings.
- [ ] The Notifications Bell dropdown shows unread count badges and links correctly to the audit trail.
- [ ] The `/agents` page renders and integrates with the sidebar layout.
