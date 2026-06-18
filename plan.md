# 🚀 A2Z Agent Dashboard — Frontend Overhaul Plan

> Generated: 2026-06-19 | Status: EXECUTING
> Current: 48 files, 5,125 lines, 29 components | Rating: 7.5/10 → Target: 9.5/10

---

## 📊 Audit Findings Summary

| Category | Issues Found | Severity |
|---|---|---|
| Critical Bugs | 3 | 🔴 Demo-breakers |
| Dead/Unused Code | 4 | 🟡 Wasted potential |
| Visual Gaps | 6 | 🟡 Impression loss |
| Polish Items | 5 | 🟢 Nice-to-have |

---

## Phase 1: 🔴 Critical Bug Fixes (Demo-Breakers)

### 1.1 Fix Breadcrumbs Import
- **File:** `components/ui/Breadcrumbs.tsx`
- **Bug:** `import { motion } from "framer-motion"` — should be `"motion/react"`
- **Impact:** Runtime error if framer-motion not installed separately

### 1.2 Fix CommandCenter Data Attributes
- **File:** `components/ui/CommandCenter.tsx`
- **Bug:** Queries `document.querySelector("[data-sidebar]")` and `"[data-navbar]"` but those attributes don't exist
- **Fix:** Add `data-sidebar` to Sidebar's `<aside>`, `data-navbar` to Navbar's `<header>`

### 1.3 Fix AgentCommPanel Stagger Animation
- **File:** `components/AgentCommPanel.tsx`
- **Bug:** `index={0}` hardcoded — all messages animate simultaneously
- **Fix:** Pass `index={i}` from `.map()` callback

---

## Phase 2: 🟡 Wire Up Built-But-Unused Components

### 2.1 AnimatedCounter → KpiCard
- **Current:** Static `{value}` display
- **Fix:** Replace with `<AnimatedCounter value={...} prefix="$" />` for TVL, success rate, transaction counts
- **Impact:** HUGE demo wow-factor — numbers spring-animate on mount

### 2.2 Tooltip → KpiCard + Status Indicators
- **Current:** Zero tooltips anywhere
- **Fix:** Wrap KpiCard icons, gas values, status badges with `<Tooltip>`
- **Impact:** Shows attention to detail, better UX

### 2.3 Skeleton → Loading States
- **Current:** DashboardContext returns `null` before mounted
- **Fix:** Show skeleton grid on mount, skeleton charts on analytics, skeleton bubbles on agent comm
- **Impact:** Professional loading experience

### 2.4 EmptyState → VectorMemoryExplorer + AuditTrail
- **Current:** Inline "no data" text
- **Fix:** Use shared `<EmptyState>` with icon + CTA
- **Impact:** Consistent empty states across all components

---

## Phase 3: 🎨 Visual Impact Boosters

### 3.1 Page Transition Animations
- **Current:** Pages pop in instantly on navigation
- **Fix:** Wrap page children in `motion.div` with fade-slide-up
- **File:** `app/layout.tsx` — add transition wrapper around `{children}`

### 3.2 Fix LiveLog Hardcoded Colors
- **File:** `components/LiveLog.tsx`
- **Current:** `text-[#7F94AD]`, `bg-[#7F94AD]/10` etc.
- **Fix:** Replace with `var(--color-body-subtle)`, `var(--color-neutral-tertiary-soft)` etc.

### 3.3 Fix AnalyticsCharts Hardcoded Colors
- **File:** `components/AnalyticsCharts.tsx`
- **Current:** Hardcoded chart hex colors
- **Fix:** Use CSS variables for chart colors

### 3.4 Keyboard Shortcut Hints
- **Current:** KeyboardNav exists but user doesn't know about it
- **Fix:** Add subtle "⌘K" hint in search bar, "1-5" hint in sidebar footer

### 3.5 Mobile Sidebar Default State
- **Current:** `sidebarOpen: true` on mount = overlay on mobile
- **Fix:** Default to `false`, detect mobile via `window.innerWidth < 1024`

### 3.6 AgentCommPanel Typing Indicator
- **Current:** New messages just appear
- **Fix:** Show "Agent is typing..." with animated dots before new message appears
- **Impact:** Feels like real chat — very impressive for demo

---

## Phase 4: 🧹 Code Quality

### 4.1 Fix handleBlacklist
- **File:** `DashboardContext.tsx`
- **Current:** Only console.log, doesn't update state
- **Fix:** Actually update `vectorMemory` status to "blacklisted"

### 4.2 Delete Dead ExpandableDetail
- **File:** `TransactionList.tsx`
- **Current:** `ExpandableDetail` component defined but never rendered
- **Fix:** Remove dead code

### 4.3 Update Documentation
- **Files:** `memory.md`, `README.md`, `dashboard/README.md`
- **Fix:** Document all new features, bugs fixed, component integration

---

## Execution Order

```
Phase 1 (3 fixes) → Phase 2 (4 integrations) → Phase 3 (6 polish) → Phase 4 (3 cleanup)
Total: 16 items, ~15 files modified, estimated +300/-100 lines
```

**Constraints:**
- Chunked write protocol (max 300 lines per write)
- No heavy builds on T440
- TypeScript verification after each phase
- Single commit per phase
- User tests on laptop utama

---

## Success Criteria

- [ ] Zero TypeScript errors
- [ ] All 3 UI utils (AnimatedCounter, Tooltip, Skeleton) actively used
- [ ] All 3 critical bugs fixed
- [ ] Page transitions smooth
- [ ] Agent comm feels like real chat
- [ ] KPI numbers animate on mount
- [ ] Consistent design tokens everywhere (no hardcoded hex)
- [ ] Mobile sidebar doesn't overlay on mount
