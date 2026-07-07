# 🤖 A2Z Agentz — Autonomous A2A Payment Agent on AMD

Welcome to **A2Z Agentz**, an **AMD Developer Hackathon: ACT II** project themed *Agent-to-Agent Payments*.

An autonomous multi-agent system built entirely on **AMD** infrastructure — from **LLM fine-tuning** in **AMD AI Workbench**, deployment through **AMD Inference Microservice (AIM)**, to inference served by **SGLang** on **AMD Instinct™ MI300X** with **ROCm** runtime, all running on **AMD Developer Cloud**.

The agents identify high-quality Web3 opportunities (DeFi / Airdrop), execute gas-fee or seed-capital payments, and settle transactions on-chain on the **Base** network — fully autonomous, agent-to-agent (*Agent-to-Agent Payment*).

## 🌟 Core Concepts

The system is composed of two primary agents operating asynchronously via **LangGraph**:

1. **Agent A (The Scout)** — The designed-for-AMD cloud intel engine for scrape→sentiment→score. It uses the **AMD AI Workbench / AIM workflow** and is built to run on **SGLang (AMD Instinct MI300X / ROCm)**; for demo/runtime stability it can execute against a remote inference runtime when the live AMD cluster is unreachable. Scans **Farcaster** and **on-chain** signals.

> **Runtime note**: The system is architected to run on AMD AIM / MI300X, but the **current live demo and production inference executes on DeepSeek v4 via Fireworks AI** for hackathon stability.
2. **Agent B (The Vault)** — A smart-contract executor that manages an EOA wallet with **Multi-RPC** failover, KMS-backed key security, and a **Circuit Breaker**. Receives signed instructions from Agent A to authorize payments.

## 🛠️ AMD-Native Tech Stack (Hackathon Requirement)

| Layer | AMD Technology |
|---|---|
| **Cloud Platform** | AMD Developer Cloud ($100 credits) |
| **GPU** | AMD Instinct™ MI300X (192GB HBM3) |
| **GPU Runtime** | AMD ROCm 6.x |
| **Fine-Tuning** | **AMD AI Workbench** (no-code GUI) |
| **Model Deployment** | **AMD Inference Microservice (AIM)** |
| **Inference Server** | **SGLang** (AMD-recommended) |
| **Compute Marketplace** | Akash Systems (co-sponsor) |
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, TypeScript |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Animations** | Motion (motion.dev) |
| **PWA** | Service Worker, Web App Manifest (offline-capable) |
| **Wallet UX** | EIP-1193 provider detection (MetaMask, Coinbase Wallet, Rabby, Injected) + frontend-only demo session |

## 📚 Documentation

Read sequentially for maximum understanding:

- [01. System Architecture](docs/01-architecture.md) — End-to-end Mermaid diagram + AMD stack integration
- [02. Agent A (The Scout)](docs/02-agent-a-scout.md) — AMD AI Workbench fine-tune pipeline + AIM + SGLang inference
- [03. Agent B (The Vault)](docs/03-agent-b-vault.md) — On-chain security, Gas Oracle, Idempotency
- [04. Communication Protocol](docs/04-communication-protocol.md) — JSON Payload, Signature, LangGraph
- [05. Setup Guide](docs/05-setup-guide.md) — End-to-end install guide for AMD Developer Cloud
- [06. AMD Stack Alignment](docs/06-amd-stack.md) — Detailed mapping to ACT II theme and required tooling

## 🚀 Key Features (Hackathon Highlights)

- **AMD-Native Pipeline**: Fine-tune LLM in AMD AI Workbench → deploy as AMD Inference Microservice (AIM) → serve via SGLang on MI300X. Fully on AMD Developer Cloud.
- **Ultra-Low Latency**: Scraping → AIM inference (SGLang-served) → on-chain Tx completed in < 30 seconds on MI300X.
- **Bulletproof Security**: Cryptographic signature verification, double-spending detection via PostgreSQL, and Emergency Pause (Circuit Breaker).

### 🎨 Dashboard UI/UX (16 Production-Grade Features)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Loading Skeletons** | Per-route skeleton states (card, list, chart) |
| 2 | **Toast Notifications** | Success/error/info toast (auto-dismiss, ARIA live) |
| 3 | **Error Boundaries** | Crash recovery with fallback UI |
| 4 | **Empty States** | Icon + message + CTA button |
| 5 | **Command Palette** | ⌘+K keyboard-driven command palette |
| 6 | **Command Center** | Grouped action overlay |
| 7 | **Keyboard Navigation** | 1-5 routes, `/` search, `Esc` close |
| 8 | **Animated Counters** | Tween morph number animations |
| 9 | **Tooltips** | Accessible hover/focus tooltips |
| 10 | **Breadcrumbs** | Route-aware navigation trail |
| 11 | **Route Progress** | Top loading bar on page transitions |
| 12 | **Scroll to Top** | Floating scroll button |
| 13 | **Skip to Content** | WCAG 2.1 skip-to-content link |
| 14 | **PWA Support** | Service worker + manifest (offline-capable) |
| 15 | **Export Utilities** | CSV/JSON data export |
| 16 | **Reduced Motion** | Respects `prefers-reduced-motion` |

**Accessibility**: WCAG AA, focus rings, ARIA semantics, 44×44px touch targets, `aria-live` regions, skip-to-content, reduced-motion support.

---

## 🔐 Authentication Setup

### Backend

1. Set environment variables in `backend/.env`:
   ```
   JWT_SECRET=your-random-string-of-at-least-32-chars
   FRONTEND_ORIGIN=http://localhost:3000
   ```

2. Run user table migrations:
   ```bash
   psql $POSTGRES_URI -f backend/database_schema_patch_users.sql
   ```

3. Install dependencies:
   ```bash
   cd backend && pip install -r requirements.txt
   ```

### Frontend

Set the backend URL in `dashboard/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Authentication Flow

1. Landing page → click "Launch App" / "Log In" → redirect to `/login`
2. User registers at `/register` (email + password + optional wallet) → auto-login → redirect to `/dashboard`
3. User logs in at `/login` → JWT httpOnly cookie is set → redirect to `/dashboard`
4. Middleware protects all `/dashboard/*` routes → redirect to `/login` if not authenticated
5. Navbar displays user email + Logout button
6. Logout → clear cookie → redirect to landing page

### Wallet Connect Demo Mode

The frontend also provides a **Connect Wallet** button on `/login` and `/register`:

- Detects EIP-1193 providers: **MetaMask**, **Coinbase Wallet**, **Rabby**, and generic injected wallets.
- If a wallet extension is available, the frontend requests `eth_requestAccounts` and reads `eth_chainId`.
- If no wallet extension is available, the frontend falls back to a **demo session** so the hackathon/demo flow can continue without interruption.
- Wallet session is stored locally as `a2z-wallet-session` and a non-httpOnly cookie to unlock demo access to the dashboard.
- The dashboard displays **Identity Handshake Status**: wallet session, backend auth readiness, and A2A WebSocket status.

> **Security note**: Wallet login is currently **frontend-only**. Production backend still needs SIWE endpoints (`challenge` + `verify`) to issue an `a2z-token` JWT cookie equivalent to email/password login.

---

*Built for AMD Developer Hackathon: ACT II — using a 100% AMD stack (AI Workbench → AIM → SGLang → MI300X → ROCm).*
