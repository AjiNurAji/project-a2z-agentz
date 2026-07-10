# 🤖 A2Z Agentz — Autonomous A2A Payment Agent on AMD

A2Z Agentz is an **autonomous multi-agent system** that identifies high-quality Web3 opportunities (DeFi / Airdrop), scores them via an LLM, and settles transactions on-chain on the **Base** network. It is built for **Track 3: Unicorn (Open Innovation)** of the AMD Developer Hackathon.

---

## 🏗️ Architecture & AMD Compute Layer

### Split Architecture Overview

A2Z Agentz uses a **Split Architecture** designed explicitly to satisfy the hackathon rule that **AMD compute must be demonstrated**.

```
┌─────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│  COMMAND CENTER (Local VPS)             │         │  AI BRAIN (AMD GPU Server)               │
│                                         │         │                                          │
│  • Backend API (FastAPI / Starlette)    │         │  • vLLM on ROCm                          │
│  • PostgreSQL database                   │────────▶│  • Qwen/Qwen2.5-72B-Instruct-AWQ             │
│  • Auth routing (JWT + API key)         │  HTTPS  │  • OpenAI-compatible API                 │
│  • Web3 RPC (Base mainnet)             │  Tunnel │  • Port 8080                             │
│  • Dashboard / UI                       │         │                                          │
│                                         │◀────────│  • Cloudflare Quick Tunnel (egress)     │
└─────────────────────────────────────────┘         └──────────────────────────────────────────┘
```

### Why split?

- **Command Center** = stable, auditable, stateful (database, wallet, auth).
- **AI Brain** = GPU-heavy inference only, isolated behind a secure tunnel.

This lets the team demo a deterministic, reproducible backend while the LLM calls are clearly traced back to **AMD hardware**.

### AI Brain stack (judges, look here)

> **All LLM inference is offloaded to a dedicated AMD GPU server running vLLM serving Qwen/Qwen2.5-72B-Instruct-AWQ on ROCm.**

| Layer | Technology |
|---|---|
| **Inference server** | vLLM (`vllm.entrypoints.openai.api_server`) |
| **GPU runtime** | ROCm (AMD open compute stack) |
| **Hardware** | AMD Instinct™ GPU (via AMD AI Developer Program portal) |
| **Tunnel** | Cloudflare Quick Tunnel → public `*.trycloudflare.com` |
| **Endpoint** | `https://[YOUR-TUNNEL].trycloudflare.com/v1` |
| **API contract** | OpenAI-compatible `/v1/chat/completions` |

### Connection flow

1. AMD Jupyter terminal runs vLLM on ROCm, bound to `127.0.0.1:8080`.
2. A Cloudflare Quick Tunnel forwards public HTTPS → local port 8080.
3. The Command Center sets:
   - `AGENT_A_ENDPOINT=https://[YOUR-TUNNEL].trycloudflare.com/v1`
   - `AGENT_B_ENDPOINT=https://[YOUR-TUNNEL].trycloudflare.com/v1` (optional, if Agent B also streams through the same brain).
4. Every inference round-trip is logged:
   ```
   INFO a2z.agent_a.inference: AI endpoint OK | model=Qwen/Qwen2.5-72B-Instruct-AWQ latency=XXXms score=...
   ```

### What judges should see

- `rocm-smi` output showing an active AMD GPU (VRAM, temperature, utilization).
- Startup logs proving the OpenAI-compatible endpoint is hit over the tunnel.
- README + Slide Deck both showing the words **vLLM**, **ROCm**, and **AMD** side by side.

---

## 🧠 Engineering Decision: AWQ 4-bit Quantization for the AI Brain

**Decision:** The AI Brain serves **`Qwen/Qwen2.5-72B-Instruct-AWQ`** instead of the
full-precision `Qwen/Qwen2.5-72B-Instruct` checkpoint.

**Rationale.** A single consumer-grade GPU node exposes at most **48 GB of VRAM**.
A full-precision (BF16/FP16) 72B-parameter model requires well over 140 GB of weights
alone, forcing a multi-GPU shard and blowing past a single-node budget — and even a
naively sharded layout leaves no headroom for the KV-Cache once the context window grows.

To fit a **32K context** comfortably on **one 48 GB GPU** without triggering
**Out-of-Memory (OOM)** exceptions, we apply:

- **AWQ (Activation-aware Weight Quantization) — 4-bit.** Activations are preserved at
  higher precision while weights are quantized, so the 72B model drops from ~140 GB to
  ~40 GB on disk/VRAM while retaining the bulk of its reasoning quality.
- **FP8 KV-Cache.** The transformer KV-Cache is stored in FP8 rather than FP16, roughly
  halving the per-token memory cost of long context. At 32K tokens this is the difference
  between OOM and a stable serve.

**Net effect.** The quantized + FP8-KV layout fits the 72B model and a 32K context inside
a single 48 GB VRAM envelope with margin to spare, eliminating OOM risk while keeping
latency low for real-time Agent-A scoring over the Cloudflare tunnel.

**Trade-off.** 4-bit weights trade a small amount of raw accuracy for a massive gain in
deployability (single-node, no OOM, fast cold start) — an acceptable and deliberate
choice for a hackathon-grade autonomous agent.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI Inference** | vLLM on ROCm |
| **Backend** | Python 3.12, Starlette / FastAPI |
| **Database** | PostgreSQL 15 (FIFO queues, SKIP LOCKED) |
| **Web3** | web3.py, Base Mainnet RPCs, ECDSA signing |
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, TypeScript |
| **Deployment** | Docker Compose, Cloudflare Quick Tunnel |

---

## 🚀 Quick Start

```bash
cp .env.example .env   # fill real values
docker compose up --build
```

Open the dashboard at http://localhost:3000.

---

## 🔐 Security

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY`, `JUDGE_TOKEN` are **required** environment variables.
- `POSTGRES_URI` is built dynamically from `POSTGRES_PASSWORD`.
- Guest / unauthenticated write paths are gated behind `API_KEY`.
- `JWT_SECRET` must be set; the backend refuses to start otherwise.

---

## 📄 License

MIT
