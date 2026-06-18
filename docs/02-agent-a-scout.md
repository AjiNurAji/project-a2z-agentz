# 02. Agent A (The Scout)

**Agent A** adalah otak intelijen A2Z Agentz. Tugasnya: mencari, mengklasifikasi, dan menyaring proyek Web3 (DeFi/Airdrop) yang kekurangan modal (*gas fee*) dan layak didanai.

## 1. Pipeline Pemrosesan Data

Agent A berjalan via *Cron Job* setiap 1 jam untuk mengumpulkan *batch* data, namun mampu menyelesaikan eksekusi *End-to-End* di bawah 30 detik (latency target: < 30s di AMD Instinct MI300X).

- **Sumber Data**: Farcaster (via Neynar API), Twitter/X, dan On-chain explorer.
- **Anti-Bot Strategy**: Puppeteer/Selenium dengan mode *Stealth Plugin* (untuk data airdrop yang punya anti-bot ringan).

## 2. AMD-Native AI Implementation

Inferensi Agent A **100% berjalan di atas AMD stack** — bukan Llama 3 8B generik, tapi versi yang sudah di-*fine-tune* khusus untuk domain Web3.

| Layer | Tools |
|---|---|
| **Fine-Tuning Platform** | **AMD AI Workbench** (GUI no-code, berbasis ROCm) |
| **Base Model** | Llama 3 8B Instruct (pre-trained) |
| **Fine-Tune Method** | LoRA / QLoRA adapter pada dataset Web3 sentiment |
| **Deployment Format** | **AMD Inference Microservice (AIM)** — containerized |
| **Serving Engine** | **SGLang** di AMD Instinct MI300X (ROCm backend) |
| **Vector Cache** | ChromaDB (embedding-based de-duplication) |

### Alur Fine-Tune

1. **Dataset Curation**: Kumpulkan ~5.000–10.000 contoh (Farcaster casts, tweet, on-chain announcement) yang sudah dilabeli sentimen (positive/neutral/negative) + label legit/scam.
2. **AMD AI Workbench**: Import dataset → pilih base Llama 3 8B → atur hyperparameter (LoRA rank, learning rate) → jalankan training job di AMD Instinct MI300X (dialokasikan via AMD Developer Cloud credits).
3. **Export Weights**: Hasil training diekspor sebagai adapter LoRA atau full weights (format `.safetensors`).
4. **Wrap ke AIM**: Buat **AMD Inference Microservice** baru yang memuat weights + tokenizer + konfigurasi. AIM ini yang nanti di-serve.

### Alur Inference (per cron tick)

1. Agent A trigger scraper → kumpulkan raw text dari Farcaster/Twitter/on-chain.
2. Cek ChromaDB: hitung *similarity score* dengan proyek yang sudah pernah dianalisis. Jika sangat mirip dengan proyek yang sudah dibayar/ditolak, lewati (hemat GPU compute).
3. **Request inference** ke endpoint SGLang (yang me-load AIM-tuned LLM) di MI300X.
4. AIM-tuned LLM mengembalikan: sentiment score (0-100), key entities, risk flags, summary.
5. Hybrid Scoring Engine gabungkan 70% sentiment + 30% on-chain TVL.
6. Jika total > 85 → tandatangani JSON payload dengan *Private Key* Agent A → kirim ke Agent B.

## 3. Hybrid Scoring Engine

Untuk menghindari halusinasi LLM, Agent A tidak mengambil keputusan 100% secara generatif:

- **70% LLM Sentiment** — AIM-tuned LLM menganalisis konteks bahasa, pendukung (KOL/Wallet besar), dan narasi proyek.
- **30% On-chain Metrics** — Verifikasi bahwa *Smart Contract* project sudah di-deploy, terverifikasi di Basescan, dan memiliki TVL minimum (misal: > $500,000).
- **Threshold** — Jika Total Score > 85, Agent A menyusun *JSON Payload* dan menandatanganinya dengan *Private Key* untuk dikirim ke Agent B.

## 4. AMD Performance Advantage

Dibandingkan menjalankan Llama 3 8B generik di CPU atau GPU non-ROCm:
- **Throughput**: SGLang di MI300X delivers > 2000 tokens/s untuk batch inference — cukup untuk memproses 50+ proyek paralel per cron tick.
- **Latency TTFT**: < 100ms time-to-first-token pada single request (kritikal untuk UX real-time di Dashboard).
- **Cost**: $100 AMD Developer Cloud credits ≈ ~50 jam inference MI300X — cukup untuk 6 minggu operasional (lebih dari durasi hackathon 4 minggu).
