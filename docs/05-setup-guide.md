# 05. Panduan Instalasi (Setup Guide)

Dokumen ini menjelaskan langkah-langkah *deployment* A2Z Agentz di **AMD Developer Cloud** — *end-to-end* dari AMD AI Workbench fine-tune hingga Agent B di blockchain Base.

## Prasyarat (Prerequisites)

- **Akun AMD Developer Program** (sign-up via [amd.com/en/developer/ai-dev-program](https://www.amd.com/en/developer/ai-dev-program.html)) → klaim **$100 AMD Developer Cloud credits**.
- Akses ke **AMD Instinct™ MI300X** via AMD Developer Cloud console.
- Docker & Docker Compose.
- Node.js (v18+) untuk Web Dashboard.
- Python (3.10+) untuk LangGraph, Agent A, dan Agent B.
- Wallet EOA di **Base Mainnet** (untuk Agent B) + Base Sepolia (untuk testing).

## Langkah 1: Setup AMD AI Workbench

Akses AMD AI Workbench via AMD Developer Cloud console. GUI no-code untuk fine-tune.

```bash
# Login ke AMD Developer Cloud (dari browser)
# https://developer.amd.com/  → AI Workbench → New Workspace

# Pilih environment:
#   - GPU: AMD Instinct MI300X
#   - Base Image: ROCm 6.2 + PyTorch 2.4
#   - Storage: 200GB (untuk dataset + model)
```

## Langkah 2: Fine-Tune Model dengan AMD AI Workbench

```bash
# Di dalam AI Workbench GUI:
# 1. Import dataset Web3 sentiment (format JSONL)
# 2. Pilih base model: meta-llama/Meta-Llama-3-8B-Instruct
# 3. Set training config:
#    - Method: LoRA (rank=16, alpha=32)
#    - Learning rate: 2e-4
#    - Epochs: 3
#    - Batch size: 4
#    - Max seq length: 2048
# 4. Klik "Start Training" — berjalan di MI300X
# 5. Export hasil sebagai vLLM model server
```

Output dari step ini: container image **Qwen/Qwen2.5-72B-Instruct** yang siap di-serve.

## Step 3: Start vLLM on the AMD GPU Server

```bash
# Deploy Qwen/Qwen2.5-72B-Instruct via vLLM di AMD Developer Cloud
# (vLLM adalah serving framework AMD-recommended untuk ROCm)

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

Verifikasi:
```bash
curl http://localhost:8000/v1/models
# Harus return list model: a2z-web3-tuned
```

## Langkah 4: Setup Database & Backend

```bash
git clone https://github.com/axzss/project-a2z-agentz.git
cd project-a2z-agentz
docker-compose up -d
# Spins up: PostgreSQL (5432) + ChromaDB (8000)
```

*(Lihat `docker-compose.yml` di root repository — file ini ditambahkan setelah Sesi dokumentasi.)*

## Langkah 5: Konfigurasi Environment Variables

Buat file `.env` di direktori `agent-a/` dan `agent-b/`:

```env
# === agent-a/.env ===
NEYNAR_API_KEY=your_neynar_key_here
AGENT_A_ENDPOINT=https://<tunnel>.trycloudflare.com/v1
AGENT_A_PRIVATE_KEY=private_key_penandatangan_payload

# === agent-b/.env ===
BASE_RPC_URL_PRIMARY=https://base-mainnet.g.alchemy.com/v2/YOUR_API
BASE_RPC_URL_FALLBACK=https://mainnet.base.org
KMS_REGION=us-east-1
POSTGRES_URI=postgresql://a2z_admin:***@localhost:5432/a2z_transactions
AGENT_A_PUBLIC_KEY=public_key_verifikasi_whitelist
```

## Langkah 6: Jalankan Orchestrator (LangGraph)

```bash
cd src/orchestrator
pip install -r requirements.txt
python main_graph.py
```

## Langkah 7: Jalankan Next.js Web Dashboard

Di terminal terpisah:
```bash
cd dashboard
npm install
npm run dev
```

Buka `http://localhost:3000` untuk melihat Landing Page interaktif (dengan visualisasi Particle Network), lalu klik tombol dashboard atau navigasikan langsung ke `http://localhost:3000/dashboard` untuk memantau **Live Log** AI secara real-time — semua event dari Agent A (vLLM inference), Hybrid Scoring, dan Agent B (transaction execution) muncul di sini.

---

## Ringkasan Alur

| # | Step | Tools AMD |
|---|---|---|
| 1 | Workspace setup | AMD Developer Cloud |
| 2 | Fine-tune LLM | **AMD AI Workbench** (no-code) |
| 3 | Serve model | **vLLM** + **vLLM model server** di **MI300X** + **ROCm** |
| 4 | Database & backend | Docker Compose (PG + Chroma) |
| 5 | Agent runtime | LangGraph + Python |
| 6 | Frontend | Next.js 16 + Tailwind v4 |
| 7 | Monitoring | Web Dashboard (real-time WebSocket) |

---

*Hanya untuk tujuan hackathon. Pastikan untuk menonaktifkan debug mode sebelum pitching.*
