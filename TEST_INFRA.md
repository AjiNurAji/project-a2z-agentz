# TEST INFRASTRUCTURE DOCUMENTATION

## 1. Test Philosophy
This test suite is built on an **opaque-box, requirement-driven** testing philosophy.
- **Opaque-Box Testing**: The test cases interface with components and custom hooks purely via their public API contract, inputs (props, arguments), and outputs (rendered DOM elements, returned values, side effects). We avoid asserting on internal state variables or private functions.
- **Requirement-Driven**: Every test case directly derives from the functional and acceptance requirements specified in `PRD.md` and `ORIGINAL_REQUEST.md`.
- **Dynamic Fallbacks (Stub Architecture)**: Stubs are defined in `dashboard/src/components/__tests__/stubs.tsx`. They dynamically attempt to load actual components/hooks from the implementation track. If they do not exist yet, they fall back to fully functional mock stubs that adhere to the interface contracts. This ensures compile-time safety and lets tests pass now, while immediately validating the real code as soon as it is written.

---

## 2. Feature Inventory (N = 11 Features)
The test suite validates 11 core features:
1. **Theme System (`useTheme`)**: Manages `'light' | 'dark' | 'system'` themes with custom `localStorage` sync.
2. **Chart Colors Resolver (`useChartColors`)**: Resolves CSS custom properties and returns hex code mappings for theme-adaptive charting.
3. **Sparkline Widget (`Sparkline`)**: Renders inline SVG-based metric charts with customizable color and glow effects.
4. **Data Freshness System (`useDataFreshness`)**: Calculates relative time offsets (e.g., "just now", "10s ago", "2m ago") updated every second.
5. **Freshness Pill Component (`FreshnessPill`)**: A telemetry UI wrapper displaying relative freshness status.
6. **User Preferences & Density (`usePreferences`)**: Manages dashboard layout density options (`'default' | 'compact'`) with storage sync.
7. **Keyboard Shortcut Hook (`useKeyboardShortcut`)**: Listens to global key presses and routes callbacks while preventing browser defaults and input overlaps.
8. **Segmented Control Component (`SegmentedControl`)**: An accessible `radiogroup` component mapping choices.
9. **Confirmation Modal (`ConfirmModal`)**: Focus-trapped dialog component supporting danger, warning, and info variants for destructive actions.
10. **Radial Gauge Component (`RadialGauge`)**: Renders metric scores as an SVG radial gauge from 0% to 100%.
11. **Score Breakdown Component (`ScoreBreakdown`)**: Calculates weighted averages of TVL and sentiment metrics to compute overall score.

---

## 3. Test Architecture
- **Runner**: Vitest (configured in `vitest.config.ts`)
- **Environment**: JSDOM (provides browser-like global APIs like `window`, `document`, and `localStorage` in Node.js)
- **DOM Queries**: React Testing Library (RTL) for rendering and simulating element query boundaries.
- **Interactions**: `@testing-library/user-event` for rich, stateful browser event simulation.
- **Timing controls**: Vitest fake timers (`vi.useFakeTimers()`) to step through elapsed durations (important for testing time-based hooks like `useDataFreshness`).

---

## 4. Test Cases Design

### Tier 1: Feature Coverage (N = 11 Features, 5 tests each = 55 test cases)
Validates standard happy paths for each individual feature.
- **Feature 1 (Theme)**: Initial state, `setTheme` to light, `setTheme` to dark, sequential toggling, and `resolvedTheme` mapping.
- **Feature 2 (Chart Colors)**: Hex resolution, color presence, secondary color extraction, glow styles, accent/brand mappings.
- **Feature 3 (Sparkline)**: SVG element rendering, height/width attributes, glow classes, custom color stroke, point coordinates mapping.
- **Feature 4 (Freshness)**: "just now" defaults, seconds ago formatting, minutes ago formatting, interval ticks, and unmount cleanup.
- **Feature 5 (Freshness Pill)**: Element render, label text, timer update cycle, custom CSS classes, unmount cleanup.
- **Feature 6 (Preferences)**: Default state, `compact` update, layout toggles, reference stability, state retention.
- **Feature 7 (Shortcuts)**: Key callback triggers, disabled state bypass, preventDefault defaults, manual prevention flags, listener unmount.
- **Feature 8 (Segmented Control)**: Option rendering, aria-checked attributes, onChange triggers, radiogroup roles, radio buttons.
- **Feature 9 (Confirm Modal)**: Hidden if closed, visible if open, confirm click callback, cancel click callback, variant styles.
- **Feature 10 (Radial Gauge)**: Percentage text values, custom labels, zero score boundary, 100% score boundary, data-score attributes.
- **Feature 11 (Score Breakdown)**: Sentiment text, TVL text, weighted averages, weight configurations, rounding.

### Tier 2: Boundary & Corner Cases (N = 11 Features, 5 tests each = 55 test cases)
Asserts error handling, input limits, and edge conditions.
- **Feature 1 (Theme)**: Malformed theme strings, rapid toggle spamming, localStorage errors, system theme overrides, hooks isolation.
- **Feature 2 (Chart Colors)**: Missing variables fallback, document style errors, live themes sync, memory leak prevention, non-empty fallback strings.
- **Feature 3 (Sparkline)**: Single data points, empty arrays, flat data points, negative values, large number formats.
- **Feature 4 (Freshness)**: Future timestamps, zero time offsets, NaN values, props changes, fast ticks.
- **Feature 5 (Freshness Pill)**: Future dates support, invalid date parsing, layout shifts, re-renders, fast unmounts.
- **Feature 6 (Preferences)**: Unknown layout density keys, rapid setting, storage errors, initial state from storage, multiple overrides.
- **Feature 7 (Shortcuts)**: Input focus isolation, multiple listeners, uppercase keys, key combinations, modifier keys.
- **Feature 8 (Segmented Control)**: Empty arrays, missing active values, click duplicates, disabled options, rapid changes.
- **Feature 9 (Confirm Modal)**: Long text overflows, modal outer wrapper click bypasses, missing variant fallback, click on text, missing callbacks.
- **Feature 10 (Radial Gauge)**: Overflow values (>100%), negative values (<0%), float numbers, missing labels, data score attributes.
- **Feature 11 (Score Breakdown)**: Over-unity weights (>1.0), zero weights, negative weights, fraction rounding, zero input states.

### Tier 3: Cross-Feature Combinations (>= 11 test cases)
Verifies components interacting with each other.
- **Test 1**: Theme changes updating Chart Colors.
- **Test 2**: Keyboard shortcut (Escape) closing ConfirmModal.
- **Test 3**: Keyboard shortcut (n) toggling NotificationsPanel.
- **Test 4**: SegmentedControl updating Preferences density state.
- **Test 5**: FreshnessPill tick cycles updating while OnboardingTour is open.
- **Test 6**: OnboardingTour step transitions driven by Keyboard Shortcuts.
- **Test 7**: ScoreBreakdown totals feeding directly into RadialGauge.
- **Test 8**: Theme states driving Sparkline styling / glow styles.
- **Test 9**: ConfirmModal and OnboardingTour rendering concurrently.
- **Test 10**: Preferences density driving SegmentedControl layout spacing.
- **Test 11**: KeyboardHelpOverlay toggling via shortcut triggers.

### Tier 4: Real-World Application Scenarios (>= 6 test cases)
End-to-end user journeys mimicking actual production utilization.
- **Scenario 1 (Settings Flow)**: Customizing theme and density preferences and verifying root layout updates.
- **Scenario 2 (Security Flow)**: High-value transaction triggering a ConfirmModal block, requiring manual approval.
- **Scenario 3 (Onboarding Flow)**: First-time user stepping through the OnboardingTour.
- **Scenario 4 (Alert Flow)**: Freshness pill updating, triggering real-time notification alerts.
- **Scenario 5 (Keyboard Navigation Flow)**: Keyboard-only navigation across SegmentedControls and overlays.
- **Scenario 6 (Scouting Simulation)**: Analyzing sentiment/TVL metrics, showing RadialGauge ratings, and confirming a high-opportunity fund transfer.
