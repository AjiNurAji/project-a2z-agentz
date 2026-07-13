# A2Z Agentz — Autonomous Agent-to-Agent Web3 Trading Engine on AMD

A2Z Agentz is an **autonomous Agent-to-Agent (A2A) Web3 trading engine** that discovers tokens on **Base Network** via DexScreener, scores them with data-driven LLM inference on **AMD Instinct™ GPUs**, performs security checks via **GoPlus**, and executes **DEX swaps** (buy & sell) via **Uniswap V2** — all autonomous, end-to-end.

Built for **Track 3: Unicorn (Open Innovation)** of the AMD Developer Hackathon.

---

## Two-House Architecture

```
┌──────────────────────────────────────────────────┐      ┌──────────────────────────────────────────┐
│  HOUSE A — SCOUT (AMD MI300X)                    │      │  HOUSE B — VAULT (Base On-Chain)           │
│                                                  │      │                                           │
│  • DexScreener scraper (Base tokens)             │ ───▶ │  • GoPlus security gate (honeypot/tax)    │
│  • Data-driven LLM scoring (liquidity/vol/age)   │      │  • Uniswap V2 DEX swap (ETH→token buy)     │
│  • Red flag detection (scam/rug/honeypot)        │      │  • Take-profit sell (token→ETH at +30%)    │
│  • Model: Llama-3.1-8B-AWQ on ROCm vLLM         │      │  • Vault holdings tracking + dashboard     │
│  • Score ≥60 → enqueue for Agent B               │      │  • Model: DeepSeek-V4-Pro (Fireworks)      │
└──────────────────────────────────────────────────┘      └──────────────────────────────────────────┘
                   │                                                       ▲
                   └──────────── PostgreSQL scraping_queue ───────────────┘
```

### House A — Scout (Data-Driven, Not Random)
- Scrapes DexScreener for Base Network tokens: **liquidity, volume, pair age, price, market cap**.
- **Data-driven scoring** based on real on-chain metrics:
  - Liquidity >$500K → +25, <$10K → -20 (rug risk)
  - 24h Volume >$100K → +15 (active community), <$1K → -10 (dead)
  - Pair age >7 days → +10, <1 hour → -15 (honeypot risk)
  - Scam/rug/honeypot keywords → cap score at 20
- Inference on **AMD Instinct™ MI300X** via ROCm + vLLM with `Llama-3.1-8B-Instruct-AWQ-INT4`.
- Score ≥60 → eligible for execution. Score ≥85 + strong liquidity → full $2.00.

### House B — Vault (DEX Swaps + Security)
- **GoPlus Security Gate**: blocks tokens with honeypot, tax >10%, hidden owner risks.
- **Trusts Agent A's data-driven score** (max of both agents).
- **Uniswap V2 DEX swap**: buys token with `swapExactETHForTokensSupportingFeeOnTransferTokens`.
- **Take-profit automation**: monitors held tokens via DexScreener. Profit ≥30% → auto-sell.
- **Full audit trail**: every inference, security check, buy, and sell is logged.

---

## AMD Compute Requirement

All Agent A inference runs on **AMD Instinct™ GPUs** via ROCm + vLLM.

| Layer | Technology |
|---|---|
| Inference server | vLLM (`vllm.entrypoints.openai.api_server`) |
| GPU runtime | ROCm (AMD open compute stack) |
| Hardware | AMD Instinct™ MI300X |
| Tunnel | Cloudflare Quick Tunnel → `*.trycloudflare.com` |
| Model | `hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Inference (House A) | vLLM on ROCm, Llama-3.1-8B-AWQ |
| AI Inference (House B) | Fireworks AI, DeepSeek-V4-Pro |
| Security | GoPlus Token Security API |
| DEX | Uniswap V2 on Base (swap, approve, take-profit) |
| Backend | Python 3.12, Starlette, asyncio daemons |
| Database | PostgreSQL 15 (scraping_queue, held_tokens, execution_logs) |
| Web3 | eth_account, EIP-1559, MultiRpcProvider |
| Frontend | Next.js 16, React 19, Tailwind CSS v4 |
| Deployment | Railway (backend) + Vercel (frontend) |

---

## Key Features

| Feature | Status |
|---|---|
| Data-driven token scoring (DexScreener metrics) | ✅ |
| GoPlus security gate (honeypot/tax/ownership) | ✅ |
| Uniswap V2 DEX buy (ETH → token) | ✅ |
| Take-profit auto-sell (token → ETH at +30%) | ✅ |
| Vault holdings dashboard (`/api/holdings`) | ✅ |
| Multi-RPC health with retry + exponential backoff | ✅ |
| Real-time WebSocket broadcasts to dashboard | ✅ |
| ChromaDB semantic deduplication | ✅ |
| Circuit breaker (pause/resume execution) | ✅ |

---

## Quick Start

```bash
cp .env.example .env   # fill in real values
docker compose up --build
```

Required env: `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY`, `AI_ENDPOINT`, `AI_API_KEY`, `AGENT_B_ENDPOINT`, `AGENT_B_API_KEY`, `BASE_RPC_1/2/3`, `PRIVATE_KEY`, `VAULT_ADDRESS`, `AGENT_B_REAL_EXECUTION`.

---

## License

MIT
