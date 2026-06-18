# Product Requirement Document (PRD)
## Project A2Z Agentz: Autonomous A2A Payment Agent on AMD

Dokumen Persyaratan Produk (PRD) ini menjelaskan spesifikasi lengkap, arsitektur, dan fungsionalitas dari sistem **A2Z Agentz**, platform *multi-agent* otonom yang dikembangkan untuk **AMD Developer Hackathon: ACT II** dengan tema **Agent-to-Agent Payments**.

**Diferensiasi utama:** A2Z Agentz menggunakan **100% AMD-native AI stack** — fine-tune via **AMD AI Workbench**, deploy sebagai **AMD Inference Microservice (AIM)**, serve via **SGLang** di **AMD Instinct™ MI300X** (ROCm), semuanya di **AMD Developer Cloud**.

---

## 1. Pendahuluan & Ringkasan Eksekutif

### 1.1 Latar Belakang
Dalam ekosistem Web3, peluang seperti Airdrop dan peluncuran protokol DeFi baru bermunculan setiap hari. Pencarian peluang secara manual sangat memakan waktu, dan pengguna sering ketinggalan karena keterbatasan modal awal (*gas fee*) di jaringan tujuan atau keterlambatan informasi.

**A2Z Agentz** mengotomatisasi seluruh proses pencarian (*scraping*), analisis sentimen (AI), penyaringan, hingga eksekusi pembayaran on-chain secara otonom dari agen ke agen (*Agent-to-Agent Payment*) di jaringan **Base**.

### 1.2 Konsep Utama
Sistem ini menggunakan arsitektur *Multi-Agent* yang berjalan secara asinkron via **LangGraph**:

1. **Agent A (The Scout)** — Berjalan di **AMD Instinct MI300X** (ROCm), menggunakan model **AIM-tuned LLM** (hasil fine-tune AMD AI Workbench dari Llama 3 8B Instruct). Memindai Farcaster, Twitter/X, dan data on-chain via Neynar API.
2. **Agent B (The Vault/Executor)** — Brankas eksekutor transaksi yang mengelola wallet (EOA) dengan keamanan tinggi (KMS, Multi-RPC, Idempotency), menerima instruksi terenkripsi dari Agent A untuk mentransfer dana modal awal.

---

## 2. Arsitektur Sistem Terintegrasi

Sistem diatur via orkestrasi **LangGraph** untuk mengelola status alur kerja dan penanganan kegagalan.

### 2.1 Diagram Arsitektur (End-to-End)

```mermaid
graph TD
    subgraph Data Sources
        F[Farcaster / Neynar API]
        T[Twitter / X]
        O[On-Chain Block Explorer]
    end

    subgraph AMD Developer Cloud (Agent A - The Scout)
        AW[AMD AI Workbench<br/>Fine-Tune Llama 3 8B]
        AIM[AMD Inference Microservice<br/>A2Z-tuned model]
        SGL[SGLang Server<br/>ROCm / MI300X]
        VDB[(ChromaDB - Memory)]
        Sc[Scraper]
        Scoring[Hybrid Scoring Engine]

        AW -->|fine-tuned weights| AIM
        AIM --> SGL
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
        RPC[Multi-RPC: Alchemy → Infura]
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

### 2.2 Komponen Teknologi Utama

- **AMD AI Stack (wajib ACT II)**:
  - **AMD Developer Cloud** — Platform deployment utama ($100 credits).
  - **AMD Instinct™ MI300X** — GPU 192GB HBM3 untuk training & inference.
  - **ROCm 6.x** — Runtime GPU AMD.
  - **AMD AI Workbench** — GUI no-code untuk fine-tune LLM.
  - **AMD Inference Microservice (AIM)** — Format standar deployment hasil fine-tune AMD.
  - **SGLang** — Serving framework LLM AMD-recommended (ROCm-native).
- **AI Model**: Llama 3 8B Instruct (base) → **fine-tuned via AMD AI Workbench** pada dataset Web3 sentiment (output: "AIM-tuned LLM" / "A2Z-tuned model").
- **Database**:
  - **ChromaDB** — Vector DB memori semantik Agent A.
  - **PostgreSQL** — Log transaksi on-chain + idempotency check Agent B.
- **Orkestrasi**: LangGraph Python Framework.
- **Blockchain**: Base Network (L2 Ethereum).
- **Keamanan**: AWS KMS / HashiCorp Vault untuk enkripsi private key, ECDSA untuk signing komunikasi.
- **Frontend**: Next.js 16, Tailwind CSS v4, TypeScript.

---

## 3. Spesifikasi Fungsional Komponen

### 3.1 Agent A (The Scout) — Intelijen & Analisis

Agent A adalah otak pengumpul informasi, analisis sentimen, dan penyaringan proyek.

*   **Pipeline Pemrosesan**: Cron job setiap 1 jam, target < 30 detik per siklus.
*   **AMD-Native AI Stack**:
    *   **Model**: AIM-tuned LLM (Llama 3 8B base, fine-tuned via AMD AI Workbench pada ~5.000–10.000 labeled examples dari Farcaster/Twitter/on-chain narrative).
    *   **Deployment**: AMD Inference Microservice (AIM) di-serve via SGLang di AMD Instinct MI300X.
    *   **Endpoint**: OpenAI-compatible (`POST /v1/chat/completions`) di SGLang.
*   **OSINT & Scraping**:
    *   Farcaster via Neynar API.
    *   Twitter/X via API scraper.
    *   Airdrop pages via Puppeteer/Selenium dengan Stealth Plugin.
*   **Vector DB (ChromaDB) Cache**: Proyek diubah ke embeddings; similarity check sebelum inference (skip duplikat).
*   **Hybrid Scoring Engine**:
    *   **70% LLM Sentiment**: AIM-tuned LLM analisis konteks bahasa, KOL, keaslian proyek.
    *   **30% On-chain Metrics**: Verifikasi smart contract di Basescan, TVL minimum (misal > $500k).
    *   **Threshold**: Total > 85 → Agent A tanda tangani JSON payload → kirim ke Agent B.

### 3.2 Agent B (The Vault) — Keamanan & Eksekusi On-Chain

Agent B adalah eksekutor keuangan yang fokus pada keandalan & keamanan dana.

*   **Manajemen Kunci**:
    *   EOA (Externally Owned Account) untuk kecepatan hackathon.
    *   Private key via **AWS KMS** atau **HashiCorp Vault** — tidak pernah di `.env` plaintext.
*   **Keandalan RPC & Gas**:
    *   **Gas Station Oracle**: Real-time estimation +15% buffer.
    *   **Multi-RPC Fallback**: Alchemy → Infura → Public Base RPC.
*   **Pencegahan Double-Spending & Idempotensi**:
    *   Hash unik `(AgentA_ID, Project_Address, Timestamp)` dicatat ke **PostgreSQL** sebelum broadcast.
    *   Payload duplikat di-reject lokal.
*   **Circuit Breaker & Transaksi Cap**:
    *   Hard-cap $1-2 per transaksi otonom.
    *   > $2 → masuk antrean manual approval di Dashboard.
    *   Emergency Pause (Kill Switch) via Web Dashboard.
*   **Validasi Anti-Honeypot**:
    *   Dry-run simulasi via **Foundry Anvil fork** atau **Tenderly**.
    *   Transaksi yang akan *revert* atau drain token di luar ekspektasi → dibatalkan.

---

## 4. Protokol Komunikasi Antar Agen

### 4.1 Spesifikasi Payload REST API

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

### 4.2 Verifikasi Tanda Tangan
1. Agent A hash payload (tanpa `signature`).
2. Agent A sign hash dengan private key-nya (ECDSA).
3. Agent B verify signature dengan public key Agent A (whitelist).
4. Cek `timestamp` masih fresh → proses.

### 4.3 Inference Endpoint (Agent A → AIM)
Agent A panggil **SGLang** yang me-load **AMD Inference Microservice**:
```json
POST {SGLANG_MI300X_ENDPOINT}/v1/chat/completions
{
  "model": "a2z-web3-tuned",
  "messages": [...],
  "temperature": 0.1
}
```

### 4.4 Manajemen State LangGraph
- **State Variable**: `current_step` (`"Scraping"` | `"Analyzing"` | `"Approval"` | `"Executing"`)
- **State Variable**: `transaction_status` (`"Pending"` | `"Success"` | `"Failed"`)
- **Retry Policy**: Exponential backoff (2s, 4s, 8s) jika Agent B timeout/fail.

---

## 5. Spesifikasi Dashboard UI (Next.js)

### 5.1 Desain Visual & Aksesibilitas
*   Dark mode, glassmorphism, gradient Purple & Cyan, micro-animation `active:scale-95`.
*   Font Inter (data) + Outfit (heading).
*   A11y: focus rings, `aria-label`, semantic roles, touch target min 44×44px.

### 5.2 Komponen Halaman Utama
1. **Navbar** — Branding + ping indicator Agent A & Agent B + **badge AMD MI300X + ROCm** + Base Network status.
2. **Circuit Breaker** — Kill switch global dengan feedback visual merah membara saat paused.
3. **Live Log Feed** — Real-time log scraping, embeddings, AIM inference, scoring, tx.
4. **Approval Queue** — Antrean tx > $2 yang butuh approval manusia.
5. **Transaction List** — Tabel tx sukses + link ke Basescan.

### 5.3 Halaman Tambahan
- `/analytics` — Chart TVL, gas price, success rate.
- `/memory` — ChromaDB vector memory explorer.
- `/settings` — Config Agent A (cron, weights) + Agent B (RPC, KMS, cap).
- `/history` — Audit trail paginated.

---

## 6. Persyaratan Non-Fungsional

### 6.1 Performa & Latensi
*   End-to-end (scraping → tx broadcast) < 30 detik di MI300X.
*   AIM inference via SGLang: minimal 100 tokens/s untuk single request, > 2000 tokens/s batched.

### 6.2 Keamanan & Integritas
*   Private key **tidak pernah** di `.env` plaintext — wajib via KMS.
*   Semua payload diverifikasi ECDSA sebelum execution.
*   Dry-run Foundry Anvil wajib sebelum broadcast ke mempool.

### 6.3 Skalabilitas & Keandalan
*   PostgreSQL support jutaan entri tx log tanpa degradasi.
*   RPC fail-over minimal 3 provider.

### 6.4 AMD Stack Compliance (khusus ACT II)
*   100% workload AI di AMD Developer Cloud (MI300X).
*   Fine-tune via AMD AI Workbench (no custom training loop).
*   Deploy via AMD Inference Microservice (AIM).
*   Serve via SGLang ROCm backend.
*   Tidak ada fallback ke non-AMD cloud untuk inference.

---

## 7. Panduan Setup & Instalasi

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

### 7.2 Fine-Tune di AMD AI Workbench
Akses AI Workbench via AMD Developer Cloud console:
1. Pilih base: `meta-llama/Meta-Llama-3-8B-Instruct`
2. Import dataset Web3 sentiment (JSONL)
3. Set: LoRA rank=16, alpha=32, lr=2e-4, epochs=3
4. Train di MI300X → export sebagai AIM

### 7.3 Serve AIM via SGLang
```bash
docker run -d \
  --name a2z-aim-server \
  --device=/dev/kfd --device=/dev/dri \
  --group-add video --cap-add=SYS_PTRACE \
  --security-opt seccomp=unconfined \
  -p 8000:8000 \
  -v /opt/a2z/aim-model:/model \
  rocm/sglang:latest \
  python -m sglang.launch_server \
    --model-path /model --port 8000 \
    --tensor-parallel-size 1 --device rocm --quantization fp8
```

### 7.4 Konfigurasi Environment (.env)
```env
# agent-a/.env
NEYNAR_API_KEY=your_key
SGLANG_MI300X_ENDPOINT=http://a2z-aim-server:8000/v1
AGENT_A_PRIVATE_KEY=signer_keypair

# agent-b/.env
BASE_RPC_URL_PRIMARY=https://base-mainnet.g.alchemy.com/v2/your_key
BASE_RPC_URL_FALLBACK=https://mainnet.base.org
KMS_REGION=us-east-1
POSTGRES_URI=postgresql://a2z_admin:***@localhost:5432/a2z_transactions
AGENT_A_PUBLIC_KEY=public_key_verifikasi
```

---

## 8. Rencana Implementasi & Roadmap

### Fase 1: Frontend & Prototipe UI (Selesai)
- [x] Next.js 16 + Tailwind v4 init
- [x] Komponen: Navbar, LiveLog, TransactionList, ApprovalQueue, CircuitBreaker
- [x] UI/UX premium: animasi, transisi, a11y
- [x] Build statis Next.js verified
- [x] Multi-page dashboard (analytics, memory, settings, history)

### Fase 2: Backend & AI Engine (Sedang Berjalan) — AMD Stack Focus
- [ ] Konfigurasi **AMD AI Workbench** workspace di AMD Developer Cloud
- [ ] Persiapan dataset Web3 sentiment (~5.000-10.000 examples)
- [ ] Fine-tune Llama 3 8B di **MI300X** via AMD AI Workbench
- [ ] Export sebagai **AMD Inference Microservice (AIM)**
- [ ] Deploy & serve AIM via **SGLang** di MI300X (ROCm)
- [ ] Implementasi scraper Farcaster (Neynar API) + ChromaDB integration
- [ ] LangGraph state + retry policy

### Fase 3: Eksekusi Transaksi & Keamanan (Segera)
- [ ] Smart contract Solidity (Pausable + onlyOwner) deploy di Base Sepolia
- [ ] Agent B: KMS abstraction, multi-RPC manager, signer
- [ ] ECDSA signature verification end-to-end
- [ ] PostgreSQL idempotency check
- [ ] Foundry Anvil dry-run untuk honeypot detection
- [ ] Circuit Breaker on-chain + transaction cap

### Fase 4: Integrasi End-to-End & Uji Coba (Segera)
- [ ] WebSocket/SSE: Agent B → Dashboard live logs
- [ ] E2E test happy path + honeypot + RPC failure
- [ ] Deploy public demo URL di AMD Developer Cloud
- [ ] Pitching video (3 menit) untuk ACT II submission
- [ ] Slide deck + cover image
- [ ] Submit ke lablab.ai ACT II

---

*Dokumen ini living document — akan di-update seiring progress sprint.*
