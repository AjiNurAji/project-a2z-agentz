# 02. Agent A (The Scout)

**Agent A** is the intelligence layer of A2Z Agentz. It discovers tokens on Base Network via DexScreener, enriches them with on-chain metrics, and scores them using a data-driven scoring engine running on **AMD Instinct™ MI300X**.

## 1. Data Pipeline

Agent A runs as an **APScheduler cron job** (every 60s), scraping DexScreener for newly created and trending tokens on Base.

```
DexScreener API → Strict Alpha Filter → ChromaDB semantic dedup → vLLM inference → scraping_queue
```

### Data Sources
- **DexScreener**: token profiles, pair stats (liquidity, volume, price, FDV, age)
- **Farcaster / Neynar**: social signals (optional, for Farcaster-native tokens)

### Strict Alpha Filter
Tokens must pass minimum thresholds before reaching the LLM:
- `AGENT_A_MIN_LIQUIDITY_USD` (default: $5,000)
- `AGENT_A_MIN_VOLUME_24H` (default: $1,000)
- `AGENT_A_MIN_FDV` (default: $50,000)

## 2. Data-Driven Scoring (Not Random)

Agent A's scoring is **deterministic and data-driven**, using real DexScreener metrics parsed from `DEX_ALPHA_SIGNAL` format:

| Metric | Tier | Score Impact |
|---|---|---|
| **Liquidity** | >$500K / >$200K / >$50K / <$10K | +25 / +15 / +10 / -20 |
| **24h Volume** | >$100K / >$10K / <$1K | +15 / +5 / -10 |
| **Pair Age** | >7 days / 1-7 days / <1 hour | +10 / +5 / -15 |
| **Price Change** | Positive / >500% pump | +5 / -10 |
| **Market Cap** | >$1M / <$50K | +10 / -5 |
| **TX Count 24h** | >1000 / <50 | +10 / -5 |
| **Red Flags** | scam/rug/honeypot keywords | cap score ≤20 |

**Base score**: 30. Max: 100.

### Execution Thresholds
- **Score ≥ 60**: eligible for micro-execution ($0.50 via Agent B)
- **Score ≥ 85 + liquidity >$200K + volume >$10K**: full execution ($2.00)
- **Score < 60 or red flags**: rejected (amount = $0)

## 3. AMD-Native AI Implementation

Agent A inference runs on **AMD Instinct™ MI300X** via ROCm + vLLM:

| Layer | Technology |
|---|---|
| **GPU** | AMD Instinct™ MI300X (AMD Developer Program) |
| **Runtime** | ROCm 7.2 |
| **Serving Engine** | vLLM (OpenAI-compatible API) |
| **Model** | `hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4` |
| **Quantization** | AWQ INT4 (fits on single 48GB GPU) |
| **Tunnel** | Cloudflare Quick Tunnel → `*.trycloudflare.com` |

### Inference Verification
Every inference call is logged with AMD provenance:
```
[AMD MI300X COMPUTE] Executing payload to ROCm vLLM endpoint=... model=Llama-3.1-8B-AWQ
[AMD MI300X COMPUTE] vLLM returned | model=... latency=XXXms score=YY
```

## 4. ChromaDB Semantic Dedup

Prevents re-processing the same token across cycles:
- **Collection**: `project_embeddings` (cosine space)
- **Threshold**: 0.85 similarity
- **Fail-open**: ChromaDB errors never block ingestion
- **Persistent**: survives service restarts (PersistentClient)

## 5. LLM Prompt (Data-Driven)

The system prompt instructs the Llama model to score based on DexScreener metrics:
```
SCORING RULES (use real data, not guesses):
- Liquidity USD: >$500K → +25, >$200K → +15, >$50K → +10, <$10K → -20
- 24h Volume: >$100K → +15, >$10K → +5, <$1K → -10
- Pair Age: >7 days → +10, 1-7 days → +5, <1 hour → -15
- Base score starts at 30
- If description contains scam/rug/honeypot keywords → score ≤ 20
```

## 6. Fallback Strategy

If vLLM is unreachable or returns unparseable JSON:
- **Mock inference**: uses the same data-driven scoring rules (no randomness)
- **Agent B fallback**: Agent B trusts Agent A's score via `max(agent_a_score, agent_b_score)`
