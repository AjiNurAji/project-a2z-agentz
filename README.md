# 🤖 Autonomous Airdrop / Web3 Scavenger Agent (A2Z Agent)

Selamat datang di repositori **A2Z Agent**, sebuah proyek inovatif yang dibangun untuk **AMD Developer Hackathon Act II** dengan tema *Agent-to-Agent Payments*.

Proyek ini mendemonstrasikan sistem *multi-agent* yang sepenuhnya otonom, berjalan di atas infrastruktur GPU **AMD MI300X** (dengan `vLLM` dan ROCm), dirancang untuk mencari peluang Web3 (Airdrop/DeFi) dan mengeksekusi pembayaran *gas fee* atau modal awal (Agent-to-Agent Payment) secara on-chain di jaringan **Base**.

## 🌟 Konsep Utama
Sistem ini terdiri dari dua agen utama yang bekerja secara asinkron menggunakan *framework* **LangGraph**:
1. **Agent A (The Scout)**: Menggunakan model Llama 3 8B. Bertugas memindai (*scraping*) Farcaster, Twitter, dan data on-chain setiap 1 jam untuk mencari proyek Web3 berkualitas tinggi.
2. **Agent B (The Vault)**: Eksekutor *smart contract* yang mengelola *wallet* (EOA) dengan sistem keamanan *Multi-RPC*, KMS, dan *Circuit Breaker*. Menerima instruksi terenkripsi dari Agent A untuk melakukan pembayaran.

## 📚 Dokumentasi
Seluruh arsitektur, spesifikasi teknis, dan panduan instalasi telah kami dokumentasikan secara rapi di dalam folder `docs/`. Silakan baca secara berurutan untuk pemahaman maksimal:

- [01. Arsitektur Sistem](docs/01-architecture.md) - Diagram Mermaid dan penjelasan *End-to-End*
- [02. Agent A (The Scout)](docs/02-agent-a-scout.md) - OSINT, vLLM di AMD MI300X, dan Vector DB (Chroma)
- [03. Agent B (The Vault)](docs/03-agent-b-vault.md) - Keamanan on-chain, Gas Oracle, dan Idempotensi
- [04. Protokol Komunikasi](docs/04-communication-protocol.md) - Payload JSON, Signature, dan LangGraph
- [05. Setup Guide](docs/05-setup-guide.md) - Panduan instalasi dan deployment

## 🚀 Fitur Unggulan (Hackathon Highlights)
- **Ultra-Low Latency**: Proses *Scraping* -> *Llama 3 Inference* -> *On-chain Tx* selesai dalam < 30 detik.
- **Hardware Optimized**: Menjalankan Llama 3 8B menggunakan backend ROCm AMD di atas MI300X.
- **Bulletproof Security**: Verifikasi tanda tangan kriptografi, deteksi *double-spending* via PostgreSQL, dan *Emergency Pause* (Circuit Breaker).
- **Web Dashboard**: Antarmuka Next.js + TailwindCSS untuk memantau aktivitas agen dan *Live Tx Hash*.

---
*Dibuat untuk AMD Developer Hackathon Act II.*
