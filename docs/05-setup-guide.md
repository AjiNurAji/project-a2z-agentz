# 05. Panduan Instalasi (Setup Guide)

Dokumen ini menjelaskan langkah-langkah *deployment* proyek di mesin lokal maupun server *cloud* AMD MI300X.

## Prasyarat (*Prerequisites*)
- Ubuntu 22.04 LTS (Direkomendasikan untuk Server MI300X).
- Driver AMD ROCm terbaru (>= v5.7).
- Docker & Docker Compose.
- Node.js (v18+) untuk Web Dashboard.
- Python (3.10+) untuk LangGraph dan Scraper.

## Langkah 1: Setup LLM (AMD vLLM)
Pastikan AMD ROCm sudah berjalan. Instalasi `vLLM` khusus untuk backend AMD:
```bash
# Instal custom vLLM build untuk ROCm
pip install vllm-rocm

# Jalankan server Llama 3 8B
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-8B-Instruct \
  --tensor-parallel-size 1 \
  --device rocm
```

## Langkah 2: Setup Database
Kita menggunakan `docker-compose` untuk menjalankan PostgreSQL (penyimpan state transaksi) dan ChromaDB (Vector DB memori).
```bash
docker-compose up -d
```
*(Lihat file `docker-compose.yml` di root repository).*

## Langkah 3: Konfigurasi Environment Variables
Buat file `.env` di direktori `agent-b/` dan `agent-a/`:
```env
# API Keys Agent A
NEYNAR_API_KEY=your_neynar_key_here
VLLM_ENDPOINT=http://localhost:8000/v1

# Setup Agent B
BASE_RPC_URL_PRIMARY=https://base-mainnet.g.alchemy.com/v2/YOUR_API
BASE_RPC_URL_FALLBACK=https://mainnet.base.org
KMS_REGION=us-east-1
```

## Langkah 4: Jalankan LangGraph Agent
Jalankan orkestrasi python utama:
```bash
cd src/orchestrator
python main_graph.py
```

## Langkah 5: Jalankan Next.js Web Dashboard
Di terminal terpisah, jalankan *dashboard* UI:
```bash
cd dashboard
npm install
npm run dev
```
Buka `http://localhost:3000` untuk memantau aktivitas **Live Log** AI secara real-time!

---

*Hanya untuk tujuan hackathon. Pastikan untuk menonaktifkan debug mode sebelum pitching.*
