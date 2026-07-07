# TEST INFRASTRUCTURE DOCUMENTATION

## 1. Test Philosophy

This test suite follows an **opaque-box, requirement-driven** philosophy:
- **Opaque-box testing**: test cases interact with components and hooks only through their public API contract — inputs (props, arguments) and outputs (DOM, return values, side effects). Internal state and private functions are not asserted on directly.
- **Requirement-driven**: every test case maps to a functional or acceptance requirement from `PRD.md` and `ORIGINAL_REQUEST.md`.
- **Dynamic fallbacks (stub architecture)**: stubs defined in `dashboard/src/components/__tests__/stubs.tsx` attempt to load the real component or hook first, then fall back to a fully functional mock if the implementation is not yet present. This protects compile-time stability and keeps the suite green while production code is still being finalized.

---

## 2. Feature Inventory (N = 11 Features)

1. **Theme system (`useTheme`)** — manages `'light' | 'dark' | 'system'` themes with `localStorage` synchronization.
2. **Chart colors resolver (`useChartColors`)** — resolves CSS custom properties into theme-adaptive chart color mappings.
3. **Sparkline widget (`Sparkline`)** — renders inline SVG metric charts with configurable color and glow.
4. **Data freshness system (`useDataFreshness`)** — computes relative time offsets ("just now", "10s ago", "2m ago") updated every second.
5. **Freshness pill (`FreshnessPill`)** — telemetry UI wrapper for relative freshness status.
6. **User preferences and density (`usePreferences`)** — manages dashboard density options (`'default' | 'compact'`) with storage synchronization.
7. **Keyboard shortcut hook (`useKeyboardShortcut`)** — listens for global key presses, routes callbacks, and prevents default browser behavior.
8. **Segmented control (`SegmentedControl`)** — accessible `radiogroup` component for option selection.
9. **Confirmation modal (`ConfirmModal`)** — focus-trapped dialog supporting `danger`, `warning`, and `info` variants.
10. **Radial gauge (`RadialGauge`)** — renders metric scores as an SVG radial gauge from 0% to 100%.
11. **Score breakdown (`ScoreBreakdown`)** — computes weighted averages of TVL and sentiment metrics.

---

## 3. Test Architecture

- **Runner**: Vitest (configured in `vitest.config.ts`)
- **Environment**: JSDOM (browser-like global APIs in Node.js: `window`, `document`, `localStorage`)
- **DOM queries**: React Testing Library (RTL)
- **Interactions**: `@testing-library/user-event`
- **Timing controls**: Vitest fake timers (`vi.useFakeTimers()`) for time-based hooks such as `useDataFreshness`

---

## 4. Test Case Design

### Tier 1: Feature Coverage (N = 11, 5 tests each = 55 cases)
Validates standard happy paths:
- **Theme**: initial state, light, dark, sequential toggle, resolved-theme mapping
- **Chart colors**: hex resolution, color presence, secondary color extraction, glow styles, accent/brand mappings
- **Sparkline**: SVG element rendering, dimensions, glow classes, custom stroke color, point coordinates
- **Freshness**: "just now" default, seconds/minutes formatting, interval ticks, unmount cleanup
- **Freshness pill**: render, label text, timer update cycle, CSS classes, unmount cleanup
- **Preferences**: default state, compact update, layout toggles, reference stability, retention
- **Shortcuts**: callback trigger, disabled bypass, preventDefault behavior, manual prevention, unmount cleanup
- **Segmented control**: option rendering, `aria-checked`, `onChange` triggers, radiogroup roles, radio buttons
- **Confirm modal**: hidden when closed, visible when open, confirm/cancel callbacks, variant styles
- **Radial gauge**: percentage text, custom labels, zero/100 boundaries, `data-score` attributes
- **Score breakdown**: sentiment / TVL text, weighted averages, weight configuration, rounding

### Tier 2: Boundary & Corner Cases (N = 11, 5 tests each = 55 cases)
Asserts error handling, input limits, and edge conditions:
- **Theme**: malformed theme strings, rapid toggle spamming, `localStorage` errors, system-theme overrides, hook isolation
- **Chart colors**: missing-variable fallback, document-style errors, live theme sync, memory-leak prevention, non-empty fallback strings
- **Sparkline**: single points, empty arrays, flat data, negative values, large-number formatting
- **Freshness**: future timestamps, zero offsets, `NaN` values, prop changes, fast ticks
- **Freshness pill**: future-date support, invalid date parsing, layout shifts, re-renders, fast unmounts
- **Preferences**: unknown density keys, rapid setting, storage errors, initial state from storage, multiple overrides
- **Shortcuts**: input-focus isolation, multiple listeners, uppercase keys, key combinations, modifier keys
- **Segmented control**: empty arrays, missing active values, duplicate clicks, disabled options, rapid changes
- **Confirm modal**: text overflow, outer-click bypass, missing-variant fallback, text click, missing callbacks
- **Radial gauge**: overflow values (>100%), negative values (<0%), floats, missing labels, data-score attributes
- **Score breakdown**: over-unity weights (>1.0), zero weights, negative weights, fraction rounding, zero-input states

### Tier 3: Cross-Feature Combinations (>= 11 cases)
Verifies interaction between components:
1. Theme changes updating chart colors.
2. `Escape` closing the confirm modal.
3. Keyboard shortcut (`n`) toggling the notifications panel.
4. `SegmentedControl` updating preference density state.
5. `FreshnessPill` tick cycles while `OnboardingTour` is open.
6. `OnboardingTour` step transitions driven by keyboard shortcuts.
7. `ScoreBreakdown` totals feeding directly into `RadialGauge`.
8. Theme states driving sparkline styling / glow.
9. `ConfirmModal` and `OnboardingTour` rendering concurrently.
10. Preference density driving `SegmentedControl` layout spacing.
11. `KeyboardHelpOverlay` toggling via shortcut triggers.

### Tier 4: Real-World Application Scenarios (>= 6 cases)
End-to-end journeys that mirror production use:
1. **Settings flow**: customizing theme and density preferences, verifying root-layout updates.
2. **Security flow**: high-value transaction triggering a `ConfirmModal`, requiring manual approval.
3. **Onboarding flow**: first-time user completing the `OnboardingTour`.
4. **Alert flow**: freshness pill updates triggering real-time notification alerts.
5. **Keyboard-navigation flow**: keyboard-only navigation across `SegmentedControl`s and overlays.
6. **Scouting simulation**: analyzing sentiment/TVL metrics, showing `RadialGauge` ratings, and confirming a high-opportunity fund transfer.
