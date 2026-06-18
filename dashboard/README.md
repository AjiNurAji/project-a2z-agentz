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
| Fonts | Inter (data), Outfit (heading), Geist Mono (logs) |
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
- Reduced-motion support (planned)

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
