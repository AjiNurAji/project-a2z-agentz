# A2Z Agentz — AMD MI300X-Powered Autonomous Web3 Scavenger

**AMD Instinct™ MI300X GPU + ROCm + vLLM** drives all LLM inference for this autonomous
agent-to-agent (A2A) Web3 trading engine. Discovers tokens on **Base Network** via DexScreener,
scores them with data-driven AI on **AMD silicon**, validates with **GoPlus** security, and executes
**DEX swaps** via **Uniswap V2** — fully autonomous, end-to-end.

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
│  • Model: Llama-3.1-8B-Instruct-AWQ-INT4 on ROCm vLLM         │      │  • Vault holdings tracking + dashboard     │
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

### AMD Compute Verification

All Agent A inference is verifiable through backend logs:
```
[AMD MI300X COMPUTE] Executing payload to ROCm vLLM endpoint=... model=Llama-3.1-8B-AWQ
[AMD MI300X COMPUTE] vLLM returned | model=... latency=XXXms score=YY
```

**Live Execution Proof** (Base mainnet):
```
TX: 0x594831ed5cc0a154745a55b625615fe8218f8ae206c1a6cba5b18f4fc4d764d3
Vault: 0x9Bf220a384b757506A0892630D7FCaF60198605b (a2z-agentz.base.eth)
```

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
| Agent A fallback on inference failure (never score=0) | ✅ |
| GoPlus security gate (honeypot/tax/ownership) | ✅ |
| Uniswap V2 DEX buy (ETH → token) | ✅ |
| Take-profit auto-sell (token → ETH at +30%) | ✅ |
| Real-time P&L on vault holdings (live DexScreener price) | ✅ |
| Vault holdings dashboard (`/api/holdings`) | ✅ |
| Multi-RPC health with retry + exponential backoff (3x) | ✅ |
| Real-time WebSocket broadcasts to dashboard | ✅ |
| ChromaDB semantic deduplication | ✅ |
| Circuit breaker (pause/resume execution) | ✅ |
| Live execution proof (Base mainnet tx verified) | ✅ |

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
