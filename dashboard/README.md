# A2Z Agentz — Web Dashboard

Frontend dashboard untuk **A2Z Agentz** (Autonomous A2A Payment Agent) — submission untuk **AMD Developer Hackathon: ACT II**.

Dibangun dengan **Next.js 16** + **React 19** + **Tailwind CSS v4** + **TypeScript**.

> 🛠️ **Powered by AMD Instinct / Radeon Pro™ MI300X** — backend Agent A berjalan di GPU AMD via **vLLM** dengan **AMD Inference Microservice (vLLM)** hasil fine-tune **AMD AI Workbench**.

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
| Real-time | Agent A/B WebSocket + polling fallback |
| Wallet UX | EIP-1193 provider detection + frontend-only demo session |

## Halaman

- `/` — Landing page cinematic + A2A positioning
- `/login` — Email/password login + Connect Wallet modal
- `/register` — Register form + wallet connect autofill
- `/dashboard` — Dashboard utama: KPI, Identity Handshake Status, Circuit Breaker, Live Log, Approval Queue, Transaction List
- `/analytics` — Chart TVL, gas, success rate (Recharts)
- `/memory` — ChromaDB vector memory explorer
- `/settings` — Config Agent A (cron, weights) + Agent B (RPC, KMS, cap)
- `/history` — Audit trail paginated

## Wallet Connect & Demo Auth

Komponen wallet berada di:

- `src/lib/wallet.ts` — provider detection, session persistence, address formatting
- `src/hooks/useWalletConnect.ts` — connect flow + demo fallback when no wallet extension exists
- `src/components/WalletConnectModal.tsx` — modal selector with continue-to-dashboard action
- `src/components/A2AIdentityReadiness.tsx` — dashboard readiness card for wallet/backend/WebSocket state

Behavior saat ini:

1. Klik **Connect Wallet** di login/register.
2. Pilih MetaMask/Coinbase/Rabby/Browser Wallet.
3. Jika provider asli ada, browser memanggil `eth_requestAccounts`.
4. Jika provider tidak ada, app membuat **mock demo wallet session** agar demo tetap bisa lanjut.
5. Setelah session aktif, tombol **Continue to dashboard** muncul.
6. Middleware menerima cookie `a2z-wallet-session=1` sebagai akses demo frontend-only.

> Production note: wallet auth belum menggantikan backend JWT. Tambahkan SIWE challenge/verify endpoint untuk menerbitkan `a2z-token` httpOnly sebelum digunakan production.

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

## 🎨 UI/UX Features (22 Fitur)

1. **Loading Skeletons** — `Skeleton.tsx` + 5× `loading.tsx` per-route
2. **Toast Notifications** — `Toast.tsx` (success/error/info, auto-dismiss)
3. **Error Boundaries** — `ErrorBoundary.tsx` (crash recovery)
4. **Empty States** — `EmptyState.tsx` (icon + message + CTA) — 🟢 actively used in VectorMemoryExplorer + AuditTrail
5. **Command Palette** — `CommandPalette.tsx` (⌘+K) — 🟢 wired with real navigation & actions
6. **Command Center** — `CommandCenter.tsx` (grouped actions) — 🟢 data attributes fixed
7. **Keyboard Navigation** — `KeyboardNavWrapper.tsx` + `useKeyboardNav.ts`
8. **Animated Counters** — `AnimatedCounter.tsx` (tween morph) — 🟢 actively used in KpiCard
9. **Tooltips** — `Tooltip.tsx` (accessible) — 🟢 actively used on KpiCards & status badges
10. **Breadcrumbs** — `Breadcrumbs.tsx` (route-aware) — 🟢 import fixed (motion/react)
11. **Route Progress** — `RouteProgress.tsx` (top loading bar)
12. **Scroll to Top** — `ScrollToTop.tsx` (floating button)
13. **Skip to Content** — `SkipToContent.tsx` (a11y)
14. **PWA Support** — `PWARegister.tsx` + manifest + SW
15. **Export Utilities** — `exportUtils.ts` (CSV/JSON)
16. **Reduced Motion** — `useReducedMotion.ts`
17. **Page Transitions** — `motion.div` fade-slide-up wrapper on layout children
18. **Typing Indicator** — Animated "Agent is typing..." dots in AgentCommPanel
19. **Keyboard Shortcut Hints** — "⌘K" in search bar, "1-5" in sidebar footer
20. **CommandPalette Actions** — Real navigation & actions wired to command palette
21. **Design Tokens (LiveLog)** — All hardcoded hex replaced with CSS variables
22. **Design Tokens (AnalyticsCharts)** — Chart colors use CSS variables
23. **Wallet Connect Modal** — MetaMask/Coinbase/Rabby/Injected detection + demo fallback
24. **A2A Identity Readiness** — dashboard card for wallet session, backend auth, and WebSocket status

## 📦 Komponen Inventori (30+)

### Core Components
- `DashboardContext.tsx` — Global state + real-time data simulator
- `Sidebar.tsx` — Collapsible sidebar navigation
- `Navbar.tsx` — Context-aware top bar + AMD badge
- `PageHeader.tsx` — Consistent page header
- `AgentCommPanel.tsx` — Agent communication panel
- `WalletConnectModal.tsx` — Wallet selector modal with frontend-only/demo session flow
- `A2AIdentityReadiness.tsx` — Wallet/backend/WebSocket readiness panel on dashboard
- `ClientOnly.tsx` — Client-only rendering guard for extension-induced hydration mismatches

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

> **🟢 Actively Used:** `AnimatedCounter` (in KpiCard), `Tooltip` (KpiCard + status badges), `Skeleton` (SSR hydration loading), `EmptyState` (VectorMemoryExplorer + AuditTrail), `CommandPalette` (wired with real actions), `KeyboardNavWrapper` (with visible hints)

### Hooks
- `useReducedMotion.ts` — `prefers-reduced-motion` detection
- `useAgentWebSocket.ts` — Agent A/B WebSocket stream with reconnect/backoff
- `useWalletConnect.ts` — EIP-1193 wallet connect flow with demo fallback

### Library Helpers
- `api.ts` — typed API fetch wrapper with credentials and 401 handling
- `mappers.ts` — backend payload mapping for logs/transactions
- `wallet.ts` — wallet provider detection and session persistence
- `ws.ts` — WebSocket client factory

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
