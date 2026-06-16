# 02. Agent A (The Scout)

**Agent A** berfungsi sebagai otak intelijen. Tugasnya adalah mencari, mengklasifikasi, dan menyaring proyek Web3 (seperti *Airdrop* atau protokol DeFi baru) yang kekurangan modal (*gas fee*) dan layak untuk didanai.

## 1. Pipeline Pemrosesan Data
Agent A berjalan menggunakan *Cron Job* setiap 1 jam untuk mengumpulkan *batch* data, namun mampu menyelesaikan eksekusinya (*End-to-End Latency*) di bawah 30 detik.

- **Sumber Data**: Farcaster (via Neynar API), Twitter/X, dan On-chain explorer.
- **Anti-Bot Strategy**: Menggunakan Puppeteer/Selenium dengan mode *Stealth Plugin* untuk mengambil data dari situs *airdrop* yang memiliki perlindungan anti-bot ringan tanpa perlu membakar biaya CAPTCHA solver.

## 2. Implementasi AI di AMD MI300X
Kecepatan Agent A bergantung sepenuhnya pada hardware **AMD MI300X**:
- **Model**: Llama 3 8B.
- **Backend**: Di-hosting secara lokal menggunakan `vLLM` dengan eksekusi kernel berbasis **ROCm (Radeon Open Compute)**.
- **Vector DB (ChromaDB)**: Setiap cuitan/postingan diubah menjadi *embeddings*. Sebelum Llama 3 memproses data, Agent A mengecek ke ChromaDB. Jika *similarity score* sangat tinggi dengan project yang sudah dibayar, *pipeline* langsung dihentikan (hemat GPU compute).

## 3. Hybrid Scoring Engine
Untuk menghindari halusinasi LLM, Agent A tidak mengambil keputusan 100% secara generatif.
Agent A menggunakan rasio *Scoring* hibrida:
- **70% LLM Sentiment**: Llama 3 menganalisis konteks bahasa, pendukung (KOL/Wallet besar), dan narasi.
- **30% On-chain Metrics**: Agent melakukan verifikasi bahwa *Smart Contract* project tersebut sudah di-deploy, diverifikasi di Basescan, dan memiliki TVL minimal tertentu.

Jika Total Score > 85, Agent A menyusun *JSON Payload* dan menandatanganinya dengan *Private Key* untuk dikirim ke Agent B.
