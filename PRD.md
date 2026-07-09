# Product Requirement Document (PRD)
## Project A2Z Agentz: Autonomous A2A Payment Agent on AMD

This Product Requirement Document (PRD) describes the complete specification, architecture, and functionality of the **A2Z Agentz** system, an autonomous multi-agent platform developed for the **AMD Developer Hackathon: ACT II** with the theme **Agent-to-Agent Payments**.

**Core differentiation:** A2Z Agentz uses a **100% AMD-native AI stack** — fine-tuning via **AMD AI Workbench**, deployment as an **vLLM model server**, serving via **vLLM** on **AMD Instinct™ MI300X** (ROCm), entirely on **AMD Developer Cloud**.

---

## 1. Introduction & Executive Summary

### 1.1 Background

In the Web3 ecosystem, opportunities such as airdrops and new DeFi protocol launches appear every day. Manual opportunity discovery is extremely time-consuming, and users frequently miss out because of limited initial capital (*gas fees*) on target networks or delayed information.

**A2Z Agentz** automates the full pipeline of discovery (*scraping*), sentiment analysis (AI), filtering, and on-chain payment execution — fully autonomous, agent-to-agent (*Agent-to-Agent Payment*) on the **Base** network.

> **Runtime note**: The system is architected for AMD vLLM / MI300X; **current live production and demo inference runs on Qwen/Qwen2.5-72B-Instruct via AMD vLLM**.

### 1.2 Core Concepts

The system uses an asynchronous **Multi-Agent** architecture orchestrated via **LangGraph**:

1. **Agent A (The Scout) — Intel Engine (AMD MI300X / vLLM translation layer)** — The intent-collection and scoring layer. It is **architected for AMD Instinct MI300X / vLLM via vLLM**, and designed to scrape Farcaster through the Neynar API plus on-chain signals, run sentiment/scoring logic, and forward high-confidence opportunities downstream. For current demo/runtime stability, the same Agent A flow can execute against a remote inference runtime when the live AMD cluster is not attached. Scans **Farcaster** and **on-chain** signals.
2. **Agent B (The Vault / Executor)** — A transaction execution vault that manages an EOA wallet with high-grade security (KMS, Multi-RPC, idempotency). Receives encrypted instructions from Agent A to transfer seed capital.

---

## 2. Integrated System Architecture

The system is orchestrated via **LangGraph** to manage workflow state and failure handling.

### 2.1 Architecture Diagram (End-to-End)

```mermaid
graph TD
 subgraph Data Sources
 F[Farcaster / Neynar API]
 O[On-Chain Block Explorer]
 end
    subgraph AMD Developer Cloud (Agent A - The Scout)
        AW[AMD AI Workbench<br/>Qwen/Qwen2.5-72B-Instruct Inference]
        VLL[vLLM model server<br/>A2Z-tuned model]
        SGL[vLLM Server<br/>ROCm / MI300X]
        VDB[(ChromaDB - Memory)]
        Sc[Scraper]
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
        API[JSON REST API + ECDSA Signature]
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

    subgraph User Interface
        UI[Next.js Web Dashboard]
    end

    Scoring -->|JSON Payload| API
    API --> VaultCore
    VaultCore -->|Execute Tx| RPC
    RPC --> SC
    SC -->|Tx Hash| DB
    VaultCore -->|Live Logs| UI
```

### 2.2 Core Technology Components

- **AMD AI Stack (ACT II mandatory)**:
  - **AMD Developer Cloud** — Primary deployment platform ($100 credits).
  - **AMD Instinct™ MI300X** — 192GB HBM3 GPU for training and inference.
  - **ROCm 6.x** — AMD GPU runtime.
  - **AMD AI Workbench** — No-code GUI for LLM fine-tuning.
  - **vLLM model server** — Standard deployment format for AMD fine-tuned models.
  - **vLLM** — AMD-recommended LLM serving framework (ROCm-native).
- **AI Model**: Qwen/Qwen2.5-72B-Instruct (via AMD vLLM) → **fine-tuned via AMD AI Workbench** on a Web3 sentiment dataset (output: "vLLM-served LLM" / "A2Z-tuned model").
- **Database**:
  - **ChromaDB** — Semantic memory vector DB for Agent A.
  - **PostgreSQL** — On-chain transaction logging + Agent B idempotency check.
- **Orchestration**: LangGraph Python Framework.
- **Blockchain**: Base Network (Ethereum L2).
- **Security**: AWS KMS / HashiCorp Vault for private-key encryption, ECDSA for communication signing.
- **Frontend**: Next.js 16, Tailwind CSS v4, TypeScript.

---

## 3. Functional Component Specifications

### 3.1 Agent A (The Scout) — Intelligence & Analysis

Agent A is the information-gathering, sentiment-analysis, and project-filtering brain.

* **Processing Pipeline**: Hourly cron job, target < 30 seconds per cycle.
* **AMD-Native AI Stack**:
  * **Model**: vLLM-served LLM (Qwen/Qwen2.5-72B-Instruct (via AMD vLLM) via AMD AI Workbench on ~5,000–10,000 labeled examples from Farcaster and on-chain narrative).
  * **Deployment**: vLLM model server served via vLLM on AMD Instinct MI300X.
  * **Endpoint**: OpenAI-compatible (`POST /v1/chat/completions`) on vLLM.
* **OSINT & Scraping**:
  * Farcaster via Neynar API.
  * Airdrop pages via Puppeteer/Selenium with Stealth Plugin.
* **Vector DB (ChromaDB) Cache**: Projects are converted to embeddings; similarity check before inference (skip duplicates).
* **Hybrid Scoring Engine**:
  * **70% LLM Sentiment**: vLLM-served LLM analyzes language context, KOL signals, and project legitimacy.
  * **30% On-chain Metrics**: Smart-contract verification on Basescan, minimum TVL (e.g., > $500k).
  * **Threshold**: Combined score > 85 → Agent A signs JSON payload → forwards to Agent B.

### 3.2 Agent B (The Vault) — Guardrail Layer & On-Chain Executor (Base)

Agent B is the financial execution engine focused on capital reliability and security.

* **Key Management**:
  * EOA (Externally Owned Account) for hackathon speed.
  * Private key via **AWS KMS** or **HashiCorp Vault** — never stored as plaintext in `.env`.
* **RPC & Gas Reliability**:
  * **Gas Station Oracle**: Real-time estimation with +15% buffer.
  * **Multi-RPC Fallback**: Alchemy → Infura → Public Base RPC.
* **Double-Spending Prevention & Idempotency**:
  * Unique hash `(AgentA_ID, Project_Address, Timestamp)` is recorded in **PostgreSQL** before broadcast.
  * Duplicate payloads are rejected locally.
* **Circuit Breaker & Transaction Cap**:
  * Hard cap of $1–2 per autonomous transaction.
  * Amounts > $2 enter manual-approval queue in the Dashboard.
  * Emergency Pause (Kill Switch) via Web Dashboard.
* **Anti-Honeypot Validation**:
  * Dry-run simulation via **Foundry Anvil fork** or **Tenderly**.
  * Transactions that would revert or drain unexpected tokens are canceled.

---

## 4. Inter-Agent Communication Protocol

### 4.1 REST API Payload Specification

```json
POST /api/v1/vault/execute
{
  "timestamp": 1718500000,
  "project_target_address": "0x1234567890abcdef1234567890abcdef12345678",
  "amount_usd": 1.50,
  "reason": "High positive sentiment on Farcaster + Verified TVL > 500k",
  "signature": "0xabc123...def456"
}
```

### 4.2 Signature Verification
1. Agent A hashes the payload (excluding `signature`).
2. Agent A signs the hash with its private key (ECDSA).
3. Agent B verifies the signature using Agent A's public key (whitelist).
4. Check that `timestamp` is still fresh → process.

### 4.3 Inference Endpoint (Agent A → vLLM)

Agent A calls **vLLM**, which loads the **AMD Inference Microservice**:
```json
POST {AGENT_A_ENDPOINT}/v1/chat/completions
{
  "model": "a2z-web3-tuned",
  "messages": [...],
  "temperature": 0.1
}
```

### 4.4 LangGraph State Management
- **State Variable**: `current_step` (`"Scraping"` | `"Analyzing"` | `"Approval"` | `"Executing"`)
- **State Variable**: `transaction_status` (`"Pending"` | `"Success"` | `"Failed"`)
- **Retry Policy**: Exponential backoff (2s, 4s, 8s) if Agent B times out or fails.

---

## 5. Dashboard UI Specification (Next.js)

### 5.1 Visual Design & Accessibility
* Dark mode, glassmorphism, Purple & Cyan gradients, micro-animation `active:scale-95`.
* Fonts: Inter (data) + Outfit (heading).
* A11y: focus rings, `aria-label`, semantic roles, minimum 44×44px touch targets.

### 5.2 Main Page Components
1. **Navbar** — Branding + Agent A & Agent B ping indicators + **AMD MI300X + ROCm badge** + Base Network status.
2. **Circuit Breaker** — Global kill switch with blazing-red visual feedback when paused.
3. **Live Log Feed** — Real-time scraping logs, embeddings, vLLM inference, scoring, and transactions.
4. **Approval Queue** — Queue for transactions > $2 requiring human approval.
5. **Transaction List** — Successful transaction table + Basescan links.

### 5.3 Additional Pages
- `/analytics` — TVL, gas price, and success rate charts.
- `/memory` — ChromaDB vector memory explorer.
- `/settings` — Agent A config (cron, weights) + Agent B (RPC, KMS, cap).
- `/history` — Paginated audit trail.

---

## 6. Non-Functional Requirements

### 6.1 Performance & Latency
* End-to-end (scraping → tx broadcast) < 30 seconds on MI300X.
* vLLM inference via vLLM: minimum 100 tokens/s for single requests, > 2000 tokens/s batched.

### 6.2 Security & Integrity
* Private key is **never** stored as plaintext in `.env` — must use KMS.
* All payloads are ECDSA-verified before execution.
* Foundry Anvil dry-run is mandatory before broadcasting to the mempool.

### 6.3 Scalability & Reliability
* PostgreSQL must support millions of transaction-log entries without degradation.
* Minimum 3-provider RPC failover.

### 6.4 AMD Stack Compliance (ACT II specific)
* 100% AI workload on AMD Developer Cloud (MI300X).
* Fine-tuning via AMD AI Workbench (no custom training loop).
* Deployment via vLLM model server.
* Serving via vLLM ROCm backend.
* No fallback to non-AMD cloud for inference.

---

## 7. Setup & Installation Guide

### 7.1 Docker Services (docker-compose.yml)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: a2z_admin
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: a2z_transactions
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chromadata:/chroma/data

volumes:
  pgdata:
  chromadata:
```

### 7.2 Fine-Tune in AMD AI Workbench
Access AI Workbench via the AMD Developer Cloud console:
1. Select the base model: `deepseek-ai/DeepSeek-v4 (via AMD vLLM)`
2. Import the Web3 sentiment dataset (JSONL)
3. Set: LoRA rank=16, alpha=32, lr=2e-4, epochs=3
4. Train on MI300X → export as vLLM model

### 7.3 Serve vLLM
```bash
docker run -d \
  --name a2z-vllm-server \
  --device=/dev/kfd --device=/dev/dri \
  --group-add video --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  -p 8000:8000 \
  -v /opt/a2z/vllm-model:/model \
  rocm/vLLM:latest \
  python -m vLLM.launch_server \
  --model-path /model --port 8000 \
  --tensor-parallel-size 1 --device rocm --quantization fp8
```

### 7.4 Environment Configuration (.env)
```env
# agent-a/.env
NEYNAR_API_KEY=your_key
AGENT_A_ENDPOINT=http://a2z-vllm-server:8000/v1
AGENT_A_PRIVATE_KEY=signer_keypair

# agent-b/.env
BASE_RPC_URL_PRIMARY=https://base-mainnet.g.alchemy.com/v2/your_key
BASE_RPC_URL_FALLBACK=https://mainnet.base.org
KMS_REGION=us-east-1
POSTGRES_URI=postgresql://a2z_admin:***@localhost:5432/a2z_transactions
AGENT_A_PUBLIC_KEY=public_key_verification
```

---

## 8. Implementation Plan & Roadmap

### Phase 1: Frontend & UI Prototype (Complete)
- [x] Next.js 16 + Tailwind v4 initialization
- [x] Components: Navbar, LiveLog, TransactionList, ApprovalQueue, CircuitBreaker
- [x] Premium UI/UX: animations, transitions, accessibility
- [x] Static Next.js build verified
- [x] Multi-page dashboard (analytics, memory, settings, history)

### Phase 2: Backend & AI Engine (In Progress) — AMD Stack Focus
- [ ] Configure **AMD AI Workbench** workspace in AMD Developer Cloud
- [ ] Prepare Web3 sentiment dataset (~5,000–10,000 examples)
- [ ] Fine-tune Qwen/Qwen2.5-72B-Instruct on **MI300X** (vLLM target); live demo runs via **AMD vLLM** via AMD AI Workbench
- [ ] Export as **vLLM model server**
- [ ] Deploy & serve vLLM on MI300X (ROCm)
- [ ] Implement Farcaster scraper (Neynar API) + ChromaDB integration
- [ ] LangGraph state + retry policy

### Phase 3: Transaction Execution & Security (Upcoming)
- [ ] Solidity smart contract (Pausable + onlyOwner) deployed on Base Sepolia
- [ ] Agent B: KMS abstraction, multi-RPC manager, signer
- [ ] End-to-end ECDSA signature verification
- [ ] PostgreSQL idempotency check
- [ ] Foundry Anvil dry-run for honeypot detection
- [ ] On-chain Circuit Breaker + transaction cap

### Phase 4: End-to-End Integration & Testing (Upcoming)
- [ ] WebSocket / SSE: Agent B → Dashboard live logs
- [ ] E2E happy-path + honeypot + RPC failure tests
- [ ] Public demo URL deployed on AMD Developer Cloud
- [ ] Pitch video (3 minutes) for ACT II submission
- [ ] Slide deck + cover image
- [ ] Submit to lablab.ai ACT II

---

*This is a living document — it will be updated as sprint progress continues.*
