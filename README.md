# A2Z Agentz — Autonomous Agent-to-Agent Web3 Payment Engine on AMD

A2Z Agentz is an **autonomous Agent-to-Agent (A2A) Web3 payment engine** that discovers high-quality on-chain opportunities, scores them with an LLM, and settles transactions on the **Base** network (L2). It is built for **Track 3: Unicorn (Open Innovation)** of the AMD Developer Hackathon, with all LLM inference offloaded to **AMD Instinct™ GPUs** via ROCm + vLLM.

---

## Two-House Architecture

A2Z Agentz splits responsibility between two autonomous agents ("two houses") that communicate through a PostgreSQL-backed task queue. Both houses run on the same backend, but their intelligence is sourced from **different models on different hardware**:

```
┌─────────────────────────────────────────────┐      ┌──────────────────────────────────────────┐
│  HOUSE A — SCOUT (Signal Detection & Scoring) │      │  HOUSE B — VAULT (Secure On-Chain Execution) │
│                                                 │      │                                                │
│  • OSINT scraper (DexScreener + Neynar)        │ ───▶ │  • Pulls scored targets from scraping_queue     │
│  • LLM scoring + category + reasoning          │      │  • GoPlus token-security gate (rug/pull check)  │
│  • LLM: Qwen2.5-72B-Instruct-AWQ               │      │  • LLM: DeepSeek-V4-Flash via Fireworks AI       │
│  • Hardware: AMD Instinct™ MI300X (ROCm vLLM)  │      │  • Hardware: Fireworks cloud (DeepSeek V4 Flash) │
│  • Exposed as OpenAI-compatible /v1 endpoint    │      │  • Signs + broadcasts native transfers on Base   │
└─────────────────────────────────────────────┘      └──────────────────────────────────────────┘
                        │                                                  ▲
                        └────────── PostgreSQL scraping_queue ◀──────────┘
```

### House A — Scout (AMD MI300X)
- Scrapes live market + social signals (DexScreener liquidity/market-cap, Neynar social graph).
- Sends the normalized description to **`Qwen/Qwen2.5-72B-Instruct-AWQ`** served by **vLLM on ROCm** on an **AMD Instinct™ MI300X** GPU.
- Returns a strict JSON verdict: `score` (1–100), `category`, `reason`, `amount_usd`.
- Enqueues any target scoring ≥ 70 into the `scraping_queue` for House B.

### House B — Vault (DeepSeek V4 / Fireworks)
- Consumes pending tasks from `scraping_queue` via `SELECT ... FOR UPDATE SKIP LOCKED`.
- Runs a **GoPlus security gate** (honeypot / mint / ownership checks) before any execution.
- Uses **`accounts/fireworks/models/deepseek-v4-flash`** (Fireworks AI) as a strict guardrail LLM that confirms or rejects the Scout's verdict.
- On approval, signs an ECDSA payload with the vault key and broadcasts a native transfer on **Base L2**, capped by `MAX_GAS_PRICE_GWEI` and `MICRO_TX_ETH`.

Every inference round-trip is traced with an explicit log marker for jury verification:
```
[AMD MI300X COMPUTE] Executing payload to ROCm vLLM endpoint=... model=Qwen/Qwen2.5-72B-Instruct-AWQ
[AMD MI300X COMPUTE] vLLM returned | model=Qwen/Qwen2.5-72B-Instruct-AWQ latency=XXXms score=YY
```

---

## AMD Compute Requirement

All Agent A inference is executed on **AMD Instinct™ GPUs** through the ROCm software stack and vLLM. The AI Brain is isolated on a dedicated AMD GPU server and reached from the Command Center over a Cloudflare Quick Tunnel.

| Layer | Technology |
|---|---|
| Inference server | vLLM (`vllm.entrypoints.openai.api_server`) |
| GPU runtime | ROCm (AMD open compute stack) |
| Hardware | AMD Instinct™ MI300X (AMD AI Developer Program portal) |
| Tunnel | Cloudflare Quick Tunnel → `*.trycloudflare.com` |
| API contract | OpenAI-compatible `/v1/chat/completions` |

**Why AWQ 4-bit?** A single 48 GB GPU cannot hold a full-precision 72B model (~140 GB). AWQ quantization drops the 72B checkpoint to ~40 GB on VRAM while preserving reasoning quality, and FP8 KV-cache keeps long-context serving OOM-free on one node. This is a deliberate, hackathon-grade trade-off for single-node stability and low latency.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Inference (House A) | vLLM on ROCm, Qwen2.5-72B-Instruct-AWQ |
| AI Inference (House B) | Fireworks AI, DeepSeek-V4-Flash |
| Backend | Python 3.12, Starlette / FastAPI, APScheduler |
| Database | PostgreSQL 15 (FIFO queues, `SKIP LOCKED`) |
| Web3 | web3.py, Base L2 RPCs, ECDSA signing |
| Frontend | Next.js 16, React 19, Tailwind CSS v4, TypeScript |
| Deployment | Docker (`--platform linux/amd64`), Cloudflare Quick Tunnel |

---

## Quick Start

```bash
cp .env.example .env   # fill in real values (no secrets committed)
docker compose up --build
```

Open the dashboard at http://localhost:3000. The backend serves on http://localhost:8080.

Required environment variables: `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY`, `JUDGE_TOKEN`, `AI_ENDPOINT`, `AI_API_KEY`, `AI_MODEL`, `AGENT_B_ENDPOINT`, `AGENT_B_API_KEY`, `AGENT_B_MODEL`.

---

## Security

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY`, `JUDGE_TOKEN` are **required**.
- Guest / unauthenticated write paths are gated behind `API_KEY`.
- `JWT_SECRET` must be set; the backend refuses to start otherwise.
- The vault key (`PRIVATE_KEY`) is server-only and never bundled in the frontend build.

---

## Technical Disclaimer (Model Tagging)

> During the AMD Lablab registration, the submission form offered only rigid, pre-defined model tags. We were **forced to select the tags "Qwen3-Coder" and "DeepSeek V3"** because those were the closest available options in the form's dropdown.
>
> **This does not reflect the models our system actually runs.** In production, A2Z Agentz actively uses **`Qwen/Qwen2.5-72B-Instruct-AWQ`** (House A / Scout, served on AMD MI300X via vLLM) and **`accounts/fireworks/models/deepseek-v4-flash`** (House B / Vault, via Fireworks AI). We deliberately chose these models for **stable JSON-mode output** and **ultra-low latency** under autonomous agent load — priorities that the rigid form tags could not express. All inference is verifiable through the backend logs and the `AI_ENDPOINT` / `AGENT_B_ENDPOINT` configuration.

---

## License

MIT
