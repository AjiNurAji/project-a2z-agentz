# 05. Installation Guide

This document covers the *deployment* steps for A2Z Agentz on **AMD Developer Cloud** — *end-to-end* from AMD AI Workbench fine-tuning through to Agent B on the Base blockchain.

## Prerequisites

- **AMD Developer Program account** (sign up via [amd.com/en/developer/ai-dev-program](https://www.amd.com/en/developer/ai-dev-program.html)) -> claim **$100 in AMD Developer Cloud credits**.
- Access to **AMD Instinct™ MI300X** through the AMD Developer Cloud console.
- Docker & Docker Compose.
- Node.js (v18+) for the Web Dashboard.
- Python (3.10+) for LangGraph, Agent A, and Agent B.
- An EOA wallet on **Base Mainnet** (for Agent B) + Base Sepolia (for testing).

## Step 1: Set Up AMD AI Workbench

Access AMD AI Workbench from the AMD Developer Cloud console. This is the no-code GUI for fine-tuning.

```bash
# Log in to AMD Developer Cloud (from your browser)
# https://developer.amd.com/ -> AI Workbench -> New Workspace

# Choose environment:
# - GPU: AMD Instinct MI300X
# - Base Image: ROCm 6.2 + PyTorch 2.4
# - Storage: 200GB (for dataset + model)
```

## Step 2: Fine-Tune the Model with AMD AI Workbench

```bash
# Inside the AI Workbench GUI:
# 1. Import the Web3 sentiment dataset (JSONL format)
# 2. Select the base model: meta-llama/Meta-Llama-3-8B-Instruct
# 3. Set training config:
# - Method: LoRA (rank=16, alpha=32)
# - Learning rate: 2e-4
# - Epochs: 3
# - Batch size: 4
# - Max sequence length: 2048
# 4. Click "Start Training" -> runs on MI300X
# 5. Export the result as a vLLM model server
```

Output from this step: a **Qwen/Qwen2.5-72B-Instruct-AWQ** container image ready to serve.

## Step 3: Start vLLM on the AMD GPU Server

```bash
# Deploy Qwen/Llama-3.1-8B-Instruct-AWQvia vLLM on AMD Developer Cloud
# (vLLM is the AMD-recommended serving framework for ROCm)

docker run -d \
 --name a2z-vllm-server \
 --device=/dev/kfd --device=/dev/dri \
 --group-add video \
 --cap-add=SYS_PTRACE \
 --security-opt seccomp=unconfined \
 -p 8000:8000 \
 -v /opt/a2z/vllm-model:/model \
 rocm/vllm:latest \
 python3 -m vllm.entrypoints.openai.ai_server \
 --model-path /model \
 --port 8000 \
 --tensor-parallel-size 1 \
 --device rocm \
 --quantization fp8
```

Verify:
```bash
curl http://localhost:8000/v1/models
# Should return the model list: a2z-web3-tuned
```

## Step 4: Set Up Database & Backend

```bash
git clone https://github.com/axzss/project-a2z-agentz.git
cd project-a2z-agentz
docker-compose up -d
# Starts: PostgreSQL (5432) + ChromaDB (8000)
```

*(See `docker-compose.yml` at the repository root — added after the documentation session.)*

## Step 5: Configure Environment Variables

Create a `.env` file in both `agent-a/` and `agent-b/`:

```env
# === agent-a/.env ===
NEYNAR_API_KEY=your_neynar_key_here
AGENT_A_ENDPOINT=https://<tunnel>.trycloudflare.com/v1
AGENT_A_PRIVATE_KEY=signer_keypair

# === agent-b/.env ===
BASE_RPC_URL_PRIMARY=https://base-mainnet.g.alchemy.com/v2/YOUR_API
BASE_RPC_URL_FALLBACK=https://mainnet.base.org
KMS_REGION=us-east-1
POSTGRES_URI=postgresql://a2z_admin:***@localhost:5432/a2z_transactions
AGENT_A_PUBLIC_KEY=public_key_verification
```

## Step 6: Run the Orchestrator (LangGraph)

```bash
cd src/orchestrator
pip install -r requirements.txt
python main_graph.py
```

## Step 7: Launch the Next.js Web Dashboard

In a separate terminal:
```bash
cd dashboard
npm install
npm run dev
```

Open `http://localhost:3000` to view the interactive Landing Page (with a Particle Network visualization), then click the dashboard button or navigate directly to `http://localhost:3000/dashboard` to monitor **Live AI Logs** in real time — every event from Agent A (vLLM inference), Hybrid Scoring, and Agent B (transaction execution) appears here.

---

## Flow Summary

| # | Step | AMD Tooling |
|---|---|---|
| 1 | Workspace setup | AMD Developer Cloud |
| 2 | Fine-tune LLM | **AMD AI Workbench** (no-code) |
| 3 | Serve model | **vLLM** + **vLLM model server** on **MI300X** + **ROCm** |
| 4 | Database & backend | Docker Compose (PostgreSQL + Chroma) |
| 5 | Agent runtime | LangGraph + Python |
| 6 | Frontend | Next.js 16 + Tailwind v4 |
| 7 | Monitoring | Web Dashboard (real-time WebSocket) |

---

*For hackathon use only. Be sure to disable debug mode before presenting.*
