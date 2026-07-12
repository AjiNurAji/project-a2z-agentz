# 02. Agent A (The Scout)

**Agent A** is the intelligence brain of A2Z Agentz. Its job is to discover, classify, and filter Web3 opportunities (DeFi / Airdrop) that are capital-constrained (gas-fee poor) but still fundable.

## 1. Data Processing Pipeline

Agent A runs on a **1-hour Cron Job** to process batches, yet it completes an end-to-end pass in under **30 seconds** (target latency: < 30s on AMD Instinct MI300X).

- **Data Sources**: Farcaster (via Neynar API) + on-chain block explorers.
- **Anti-Bot Strategy**: Puppeteer / Selenium with a Stealth Plugin profile for lighter anti-bot airdrop pages.

## 2. AMD-Native AI Implementation

Agent A inference runs **100% on the AMD stack** — not a generic Llama/Llama2.5-72B-Instruct-AWQ, but a Web3-domain fine-tuned variant.

| Layer | Tooling |
|---|---|
| **Fine-tuning Platform** | **AMD AI Workbench** (no-code GUI, ROCm-backed) |
| **Base Model** | Llama/Llama-3.1-8B-Instruct-AWQ(pre-trained) |
| **Fine-tune Method** | LoRA / QLoRA adapter on a Web3 sentiment dataset |
| **Deployment Format** | **AMD Inference Microservice (vLLM)** — containerized |
| **Serving Engine** | **vLLM** on AMD Instinct MI300X (ROCm backend) |
| **Vector Cache** | ChromaDB (embedding-based de-duplication) |

### Fine-Tune Flow

1. **Dataset Curation**: Collect ~5,000–10,000 examples (Farcaster casts, on-chain announcements) labeled with sentiment (positive / neutral / negative) plus legit / scam labels.
2. **AMD AI Workbench**: Import dataset → select Llama/Llama-3.1-8B-Instruct-AWQbase → set hyperparameters (LoRA rank, learning rate) → launch the training job on AMD Instinct MI300X (allocated through AMD Developer Cloud credits).
3. **Export Weights**: Export the training result as a LoRA adapter or full weights (`.safetensors` format).
4. **Wrap for vLLM**: Build a new **AMD Inference Microservice** that loads the weights, tokenizer, and config. This vLLM service is what gets served.

### Inference Flow (per cron tick)

1. Agent A triggers the scraper -> collect raw text from Farcaster and on-chain sources.
2. ChromaDB check: compute a *similarity score* against previously analyzed projects. If it closely matches a project already paid or rejected, skip it (saves GPU compute).
3. **Inference request** to the vLLM endpoint (loading the vLLM-tuned LLM) on MI300X.
4. The vLLM-tuned LLM returns: sentiment score (0-100), key entities, risk flags, and summary.
5. Hybrid Scoring Engine combines 70% sentiment + 30% on-chain TVL.
6. If the total is > 85 -> sign the JSON payload with Agent A's *Private Key* -> forward it to Agent B.

## 3. Hybrid Scoring Engine

To keep the LLM from hallucinating, Agent A never decides 100% generatively:

- **70% LLM Sentiment** — the vLLM-tuned LLM analyzes language context, backers (KOLs / whale wallets), and project narrative.
- **30% On-chain Metrics** — verify the project's Smart Contract is deployed, verified on Basescan, and meets a minimum TVL (e.g., > $500,000).
- **Threshold** — when the Total Score > 85, Agent A assembles a *JSON Payload* and signs it with its *Private Key* before sending it to Agent B.

## 4. AMD Performance Advantage

Compared with running a generic Llama/Llama-3.1-8B-Instruct-AWQon CPU or non-ROCm GPU hardware:
- **Throughput**: vLLM on MI300X delivers > 2,000 tokens/s for batch inference — enough to process 50+ projects in parallel per cron tick.
- **Latency (TTFT)**: < 100ms time-to-first-token on a single request (critical for real-time UX in the Dashboard).
- **Cost**: $100 in AMD Developer Cloud credits equals roughly 50 hours of MI300X inference — enough for about 6 weeks of operation (longer than the 4-week hackathon window).
