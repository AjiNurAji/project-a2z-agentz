# A2Z Agentz — Web Dashboard

Frontend dashboard untuk **A2Z Agentz** (Autonomous A2A Payment Agent) — submission untuk **AMD Developer Hackathon: ACT II**.

Dibangun dengan **Next.js 16** + **React 19** + **Tailwind CSS v4** + **TypeScript**.

> 🛠️ **Powered by AMD Instinct™ MI300X** — backend Agent A berjalan di GPU AMD via **SGLang** dengan **AMD Inference Microservice (AIM)** hasil fine-tune **AMD AI Workbench**.

## Getting Started (Local Dev)

Dashboard ini consume API dari Agent A & Agent B yang berjalan di AMD Developer Cloud. Untuk development lokal:

```bash
# 1. Install dependencies
npm install

# 2. (Opsional) Setup env untuk point ke AMD Cloud endpoint
echo "NEXT_PUBLIC_AGENT_A_API=https://your-amd-cloud/a2z-agent-a" > .env.local
echo "NEXT_PUBLIC_AGENT_B_API=https://your-amd-cloud/a2z-agent-b" >> .env.local

# 3. Run dev server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Stack

| Layer | Tools |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Animations | Motion (motion.dev) |
| Fonts | Inter (data), Outfit (heading), Geist Mono (logs) |
| PWA | Service Worker + Web App Manifest |
| Real-time | WebSocket (planned) / SSE (planned) |

## Halaman

- `/` — Dashboard utama: KPI, Circuit Breaker, Live Log, Approval Queue, Transaction List
- `/analytics` — Chart TVL, gas, success rate (Recharts)
- `/memory` — ChromaDB vector memory explorer
- `/settings` — Config Agent A (cron, weights) + Agent B (RPC, KMS, cap)
- `/history` — Audit trail paginated

## Aksesibilitas (a11y)

- WCAG AA compliance
- Focus rings, `aria-label`, semantic roles
- Touch target minimum 44×44px
- `aria-live="polite"` di LiveLog
- **Skip to Content** — `SkipToContent.tsx` (WCAG 2.1 skip link)
- **Reduced Motion** — `useReducedMotion.ts` (respects `prefers-reduced-motion`)
- **Error Boundaries** — `ErrorBoundary.tsx` (crash recovery w/ fallback UI)
- **Empty States** — `EmptyState.tsx` (icon + message + CTA)
- **Tooltips** — `Tooltip.tsx` (accessible hover/focus)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `1` | Navigate to Dashboard (`/`) |
| `2` | Navigate to Analytics (`/analytics`) |
| `3` | Navigate to Memory (`/memory`) |
| `4` | Navigate to Settings (`/settings`) |
| `5` | Navigate to History (`/history`) |
| `⌘+K` / `Ctrl+K` | Open Command Palette |
| `/` | Focus search (in Command Palette) |
| `Esc` | Close overlay / dismiss toast |

## 📱 PWA Support

- **Web App Manifest** — `public/manifest.json` (icons, theme_color, display: standalone)
- **Service Worker** — `public/sw.js` (offline cache-first strategy)
- **PWA Register** — `PWARegister.tsx` (auto-register SW on mount)
- **OG Image** — `opengraph-image.tsx` (1200×630 branded social preview)
- **SEO** — `robots.ts` + `sitemap.ts` (dynamic generation)

## 🎨 UI/UX Features (16 Fitur)

1. **Loading Skeletons** — `Skeleton.tsx` + 5× `loading.tsx` per-route
2. **Toast Notifications** — `Toast.tsx` (success/error/info, auto-dismiss)
3. **Error Boundaries** — `ErrorBoundary.tsx` (crash recovery)
4. **Empty States** — `EmptyState.tsx` (icon + message + CTA)
5. **Command Palette** — `CommandPalette.tsx` (⌘+K)
6. **Command Center** — `CommandCenter.tsx` (grouped actions)
7. **Keyboard Navigation** — `KeyboardNavWrapper.tsx` + `useKeyboardNav.ts`
8. **Animated Counters** — `AnimatedCounter.tsx` (tween morph)
9. **Tooltips** — `Tooltip.tsx` (accessible)
10. **Breadcrumbs** — `Breadcrumbs.tsx` (route-aware)
11. **Route Progress** — `RouteProgress.tsx` (top loading bar)
12. **Scroll to Top** — `ScrollToTop.tsx` (floating button)
13. **Skip to Content** — `SkipToContent.tsx` (a11y)
14. **PWA Support** — `PWARegister.tsx` + manifest + SW
15. **Export Utilities** — `exportUtils.ts` (CSV/JSON)
16. **Reduced Motion** — `useReducedMotion.ts`

## 📦 Komponen Inventori (30+)

### Core Components
- `DashboardContext.tsx` — Global state + real-time data simulator
- `Sidebar.tsx` — Collapsible sidebar navigation
- `Navbar.tsx` — Context-aware top bar + AMD badge
- `PageHeader.tsx` — Consistent page header
- `AgentCommPanel.tsx` — Agent communication panel

### Data Components
- `KpiCard.tsx` — Reusable metric card (5 color variants)
- `DashboardKpis.tsx` — 6 KPI cards (TVL, success rate, total tx, dll)
- `AnalyticsCharts.tsx` — 3 Recharts (TVL area, gas line, success/fail bar)
- `TransactionList.tsx` — Tx table + expandable rows + Basescan links
- `AuditTrail.tsx` — Paginated audit log (10/page) + search + filter

### Agent Components
- `LiveLog.tsx` — Terminal-style real-time log (aria-live)
- `ApprovalQueue.tsx` — Tx > $2 approval queue
- `CircuitBreaker.tsx` — Emergency kill switch toggle
- `VectorMemoryExplorer.tsx` — ChromaDB cache viewer
- `SettingsPanel.tsx` — Agent A & B config form

### TypeUI Design System (`ui/`)
- `Skeleton.tsx` — Loading skeleton placeholders
- `Toast.tsx` — Toast notification system
- `ErrorBoundary.tsx` — React error boundary
- `EmptyState.tsx` — Empty state component
- `CommandPalette.tsx` — ⌘+K command palette
- `CommandCenter.tsx` — Command center overlay
- `KeyboardNavWrapper.tsx` — Keyboard navigation provider
- `AnimatedCounter.tsx` — Animated number counters
- `Tooltip.tsx` — Hover/focus tooltips
- `Breadcrumbs.tsx` — Navigation breadcrumbs
- `RouteProgress.tsx` — Route transition progress bar
- `ScrollToTop.tsx` — Scroll-to-top button
- `SkipToContent.tsx` — Skip-to-content a11y link
- `PWARegister.tsx` — PWA service worker registration
- `exportUtils.ts` — CSV/JSON export utilities
- `useKeyboardNav.ts` — Keyboard navigation hook

### Hooks
- `useReducedMotion.ts` — `prefers-reduced-motion` detection

### SEO & Meta
- `opengraph-image.tsx` — OG image generator (1200×630)
- `robots.ts` — Dynamic robots.txt
- `sitemap.ts` — Dynamic sitemap.xml
- `not-found.tsx` — Custom 404 page

## Deployment

Untuk production, deploy ke Vercel atau platform Next.js-compatible lain. Set environment variables untuk point ke AMD Cloud Agent A & Agent B endpoints.

```bash
# Deploy ke Vercel
vercel deploy --prod

# Atau build static export
npm run build
```

Lihat dokumentasi lengkap di [`/docs/`](https://github.com/axzss/project-a2z-agentz/tree/develop/docs).

---

*Dibangun untuk AMD Developer Hackathon: ACT II.*
