# 01. Integrated System Architecture

This document explains the high-level architecture of **A2Z Agentz** (Autonomous A2A Payment Agent), built **100% on the AMD stack** for the AMD Developer Hackathon: ACT II.

## End-to-End Architecture Diagram

```mermaid
graph TD
 subgraph Data Sources
 F[Farcaster / Neynar API]
 O[On-Chain Block Explorer]
 end

 subgraph AMD Developer Cloud — Agent A (The Scout)
 AW[AMD AI Workbench<br/>Fine-Tune GUI]
 VLL[vLLM model server<br/>Web3-tuned LLM]
 SGL[vLLM Server<br/>ROCm backend]
 VDB[(ChromaDB - Memory)]
 Sc[Scraper / Headless Browser]
 Scoring[Hybrid Scoring Engine]

 AW -->|fine-tuned weights| VLL
 VLL --> API
 Data Sources --> Sc
 Sc -->|Raw Text| VDB
 VDB -->|Context| SGL
 SGL -->|70% Sentiment| Scoring
 O -->|30% TVL Metric| Scoring
 end

 subgraph Communication Layer
 API[JSON REST API + Signature Verification]
 DB[(PostgreSQL - Tx Logs)]
 end

 subgraph Blockchain Node (Agent B - The Vault)
 VaultCore[Vault Engine]
 KMS[AWS KMS / Key Rotation]
 RPC[Multi-RPC: Alchemy -> Infura]
 Oracle[Gas Station Oracle]

 VaultCore <--> KMS
 VaultCore -->|Check Tx| DB
 Oracle --> VaultCore
 end

 subgraph Base Network (On-Chain)
 SC[Custom Smart Contract w/ Pausable]
 end

 subgraph User Interface (TypeUI Design System)
 UI[Next.js Web Dashboard]
 PWA[PWA: Service Worker + Manifest]
 CMD[Command Palette ⌘+K]
 SKELETON[Loading Skeletons]
 A11Y[Skip-to-Content + Reduced Motion]
 AUTH[Auth System: Login / Register]
 MW[Middleware: JWT Cookie Protection]
 end

 Scoring -->|JSON Payload| API
 API --> VaultCore
 VaultCore -->|Execute Tx| RPC
 RPC --> SC
 SC -->|Tx Hash| DB
 VaultCore -->|Live Logs| UI
```

## Core Components

1. **AMD Instinct™ MI300X hardware** (192GB HBM3) — the AI compute core, available through **AMD Developer Cloud**. All LLM inference runs on this GPU through **vLLM** with a **ROCm** backend.
2. **AMD AI Workbench** — the no-code GUI used to fine-tune the base LLM (Llama/Llama2.5-72B-Instruct-AWQ) into a **vLLM-served LLM** specialized for Web3 sentiment analysis (Farcaster and on-chain narrative).
3. **vLLM model server** — the standard AMD deployment format for fine-tune outputs. The LLM is wrapped as a *microservice* callable over HTTP/gRPC by Agent A.
4. **vLLM (AMD-recommended)** — a *high-throughput* LLM *serving framework* running on ROCm. It receives inference *requests* from Agent A and returns structured *responses*.
5. **LangGraph Framework** — orchestrates inter-agent state graphs, handling *retry mechanisms* and *backpressure*.
6. **Relational & Vector Database**:
   - **ChromaDB** — Agent A's long-term memory so it does not re-analyze the same projects repeatedly.
   - **PostgreSQL** — Agent B transaction log to ensure *idempotency* status (preventing *double-spending*).
7. **Hybrid Approval Mode** — all transactions under $2 run autonomously. If above $2, the process is held on the *Next.js Dashboard* and requires a human "Approve" click.
8. **Auth System** — email/password auth with a JWT httpOnly cookie (7 days). Backend Starlette targets: `POST /api/auth/register`, `/login`, `GET /me`, `POST /logout`. `users` table in PostgreSQL (bcrypt hash). Frontend: `AuthProvider` React Context + Next.js middleware route protection. Optional wallet address at registration time.
9. **Route Protection** — Next.js middleware checks for the `a2z-token` cookie. Unauthenticated -> redirect `/login`. Authenticated on an auth page -> redirect `/dashboard`.

## AMD Pipeline Flow (Core)

```
Base Llama/Llama-3.1-8B-Instruct-AWQ(HuggingFace)
 │
 ▼
[AMD AI Workbench — fine-tune on Web3 sentiment dataset]
 │
 ▼
vLLM-served weights (.safetensors)
 │
 ▼
[vLLM model server — wrap as container]
 │
 ▼
[vLLM server — load vLLM on ROCm backend on MI300X]
 │
 ▼
Agent A Scout -> call vLLM via OpenAI-compatible API
```

The entire pipeline runs inside **AMD Developer Cloud**, with no dependency on an external cloud provider for its AI workload.

---

## Frontend Architecture (Dashboard)

### TypeUI Design System

The Dashboard uses an internal design system named **TypeUI** with the following tokens (defined in `globals.css` via CSS `:root` variables):

| Token | Purpose |
|-------|---------|
| `--color-brand` | Primary color (purple gradient) |
| `--color-brand-medium` | Medium brand variation |
| `--color-brand-soft` | Brand glow / shadow |
| `--color-heading` | Heading text color |
| `--color-body` | Body text color |
| `--color-body-subtle` | Secondary / muted text |
| `--color-border-default` | Standard border |
| `--color-neutral-secondary-medium` | Neutral background |
| `--font-heading` (Outfit) | Heading font |
| `--font-body` (Inter) | Body / data font |
| `--font-mono` (Geist Mono) | Log / code font |

Glassmorphism: `.glass` and `.glass-card` utility classes for a transparent blur effect.

### Route & Layout Architecture

Next.js App Router is grouped into two main route groups to separate the visual landing page from the dashboard layout:

1. **`(landing)` Group** (`dashboard/src/app/(landing)/`):
   - **Routes**: `/` (Landing Page)
   - **Visual**: Interactive HTML5 2D `<canvas>` Particle Network background (`AgentScene.tsx`) that adapts to theme changes, with mouse parallax, HSL breathing grid, and cybernetic scanlines.
   - **Main Component**: Retro mockup terminal with an animated multi-agent `A2Z-animation.gif` (Agent A & Agent B).
2. **`(dashboard)` Group** (`dashboard/src/app/(dashboard)/`):
   - **Routes**: `/dashboard` (Main Dashboard) plus supporting pages (`/agents`, `/analytics`, `/memory`, `/settings`, `/history`).
   - **Layout**: Persistent Sidebar & Navbar, synchronized state management (`DashboardContext.tsx`), and global keybindings wrapper.

### Component Hierarchy

```
Root Layout (dashboard/src/app/layout.tsx)
├── PWARegister ← Service worker registration
├── ToastProvider & Toast ← Global toast notification system
├── RouteProgress ← Top transition loading bar
└── Route Group
 ├── (landing) Layout
 │ └── Landing Page (page.tsx)
 │ ├── AgentScene ← Interactive HTML5 2D Canvas Background
 │ └── Terminal UI ← Cyberpunk Mockup Terminal with A2Z-animation.gif
 └── (dashboard) Layout (layout.tsx)
 ├── SkipToContent ← WCAG 2.1 skip link
 ├── KeyboardNavWrapper ← Global keyboard shortcuts (1-5 routes, Esc, etc.)
 │ ├── KeyboardHelpOverlay
 │ ├── OnboardingTour
 │ ├── Sidebar ← Main Navigation
 │ └── Main Area
 │ ├── Navbar ← Top bar w/ AMD status indicators
 │ ├── Breadcrumbs← Route trail navigation
 │ ├── Page Content
 │ │ ├── PageHeader
 │ │ ├── CommandPalette ← ⌘+K overlay
 │ │ ├── CommandCenter ← Actions overlay
 │ │ └── Page Components (KpiCard, AnalyticsCharts, etc.)
 │ └── ScrollToTop
```

### Loading & Streaming Patterns

Every route under the `(dashboard)` group has a `loading.tsx` file that shows **Skeleton** components while data is being loaded asynchronously (Streaming SSR):

- `dashboard/src/app/(dashboard)/loading.tsx` — root dashboard skeleton (6 KPI cards + 3-column grid)
- `dashboard/src/app/(dashboard)/analytics/loading.tsx` — chart skeletons (area, line, bar)
- `dashboard/src/app/(dashboard)/memory/loading.tsx` — vector memory explorer skeleton
- `dashboard/src/app/(dashboard)/settings/loading.tsx` — settings form skeleton
- `dashboard/src/app/(dashboard)/history/loading.tsx` — audit trail table skeleton

Pattern: **Streaming SSR** via the Next.js App Router — simulated real-time data streams asynchronously from the server to client components, with `loading.tsx` acting as the Suspense boundary.

### Error Handling

- `ErrorBoundary.tsx` — each main section is wrapped in an error boundary with fallback UI for instant crash recovery.
- `not-found.tsx` — custom animated branded 404 page.
- `Toast.tsx` — global error/info/success notifications (ARIA live regions).

### Accessibility Stack

- `SkipToContent.tsx` — WCAG 2.1 skip navigation link.
- `useReducedMotion.ts` — detects the `prefers-reduced-motion` media query.
- `KeyboardNavWrapper.tsx` — full keyboard navigation (routes 1-5, ⌘+K, Esc).
- `aria-live="polite"` on all real-time updating areas (LiveLog, Toast).
- `role="log"`, `role="alert"`, `aria-label` on all interactive elements.
- Focus-visible rings on all interactive targets.
- Touch targets minimum 44×44px.

## Active Lane Separation

### Lane 1 — Active Inference Engine (Agent A)
- **Role**: Sentiment analysis and opportunity scoring
- **Runtime**: vLLM on ROCm / AMD Instinct MI300X
- **Model**: Llama/Llama-3.1-8B-Instruct-AWQ(via AMD vLLM)
- **Entrypoint**: `AGENT_A_ENDPOINT=https://[tunnel].trycloudflare.com/v1`

### Lane 2 — Active Security Gatekeeper (Agent B)
- **Role**: Anti-honeypot validation, risk scoring, transaction gating
- **Primary Runtime**: GoPlus API security check (chain-native risk data)
- **Backup Inference**: Fireworks AI DeepSeek-V4-Pro (via `AGENT_B_ENDPOINT`)
- **Key Mapping**: `FIREWORKS_API_KEY` is aliased to `AGENT_B_API_KEY` in backend code
- **Failure Mode**: If GoPlus returns 404, task is marked `FAILED` with no DB insert
