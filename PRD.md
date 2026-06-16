# Product Requirement Document (PRD)
## Project A2Z Agent: Autonomous Airdrop / Web3 Scavenger Agent

Dokumen Persyaratan Produk (PRD) ini menjelaskan spesifikasi lengkap, arsitektur, dan fungsionalitas dari sistem **A2Z Agent**, sebuah platform *multi-agent* otonom yang dikembangkan untuk **AMD Developer Hackathon Act II** dengan fokus pada tema **Agent-to-Agent Payments**.

---

## 1. Pendahuluan & Ringkasan Eksekutif

### 1.1 Latar Belakang
Dalam ekosistem Web3, peluang seperti Airdrop dan peluncuran protokol DeFi baru bermunculan setiap hari. Namun, mencari peluang ini secara manual sangat memakan waktu, dan sering kali pengguna ketinggalan karena keterbatasan modal awal (*gas fee*) di jaringan tujuan atau keterlambatan informasi. 

**A2Z Agent** memecahkan masalah ini dengan mengotomatisasi seluruh proses pencarian (*scraping*), analisis sentimen (AI), penyaringan, hingga eksekusi pembayaran on-chain secara otonom dari agen ke agen (Agent-to-Agent Payment) di jaringan **Base**.

### 1.2 Konsep Utama
Sistem ini menggunakan arsitektur *Multi-Agent* yang berjalan secara asinkron menggunakan *framework* **LangGraph**:
1. **Agent A (The Scout)**: Berjalan di server **AMD MI300X** berbasis **ROCm**, memindai media sosial terdesentralisasi (Farcaster via Neynar, Twitter/X) dan data on-chain untuk menganalisis proyek berkualitas tinggi dengan model **Llama 3 8B**.
2. **Agent B (The Vault/Executor)**: Brankas eksekutor transaksi yang mengelola wallet (EOA) dengan tingkat keamanan tinggi (*KMS*, *Multi-RPC*, *Idempotency*), menerima instruksi terenkripsi dari Agent A untuk mentransfer dana modal awal (*gas fee*) ke *smart contract* target.

---

## 2. Arsitektur Sistem Terintegrasi

Sistem diatur menggunakan orkestrasi graf dari **LangGraph** untuk mengelola status alur kerja (*state*) dan penanganan kegagalan (*retry mechanism*).

### 2.1 Diagram Arsitektur (End-to-End)

```mermaid
graph TD
    subgraph Data Sources
        F[Farcaster / Neynar API]
        T[Twitter / X]
        O[On-Chain Block Explorer]
    end

    subgraph AMD MI300X Server (Agent A - The Scout)
        Sc[Scraper / Headless Browser]
        VDB[(ChromaDB - Memory)]
        LLM[Llama 3 8B via vLLM ROCm]
        Scoring[Hybrid Scoring Engine]
        
        Data Sources --> Sc
        Sc -->|Raw Text| VDB
        VDB -->|Context| LLM
        LLM -->|70% Sentiment| Scoring
        O -->|30% TVL Metric| Scoring
    end

    subgraph Communication Layer
        API[JSON REST API + Signature Verification]
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

### 2.2 Komponen Teknologi Utama
*   **Infrastruktur AI**: GPU AMD MI300X dengan ROCm runtime dan vLLM server.
*   **AI Model**: Llama 3 8B Instruct (dioptimalkan untuk instruksi terstruktur).
*   **Database**: 
    *   *ChromaDB*: Sebagai Vector DB untuk penyimpanan memori semantik jangka panjang Agent A.
    *   *PostgreSQL*: Untuk mencatat transaksi on-chain dan memastikan idempotensi transaksi Agent B.
*   **Orkestrasi**: LangGraph Python Framework.
*   **Blockchain**: Base Network (L2 Ethereum) untuk biaya transaksi yang murah dan finalitas yang cepat.
*   **Keamanan**: AWS KMS / HashiCorp Vault untuk enkripsi private key, tanda tangan kriptografis (ECDSA) untuk komunikasi antar-agen.
*   **Frontend**: Next.js 16, Tailwind CSS v4, TypeScript.

---

## 3. Spesifikasi Fungsional Komponen

### 3.1 Agent A (The Scout) - Intelijen & Analisis

Agent A bertindak sebagai otak yang mengumpulkan informasi, melakukan analisis sentimen, menyaring proyek, dan memutuskan kelayakan proyek.

*   **Pipeline Pemrosesan**: Berjalan otomatis menggunakan *cron job* setiap 1 jam, namun harus menyelesaikan satu siklus pemrosesan di bawah 30 detik (*low latency*).
*   **OSINT & Scraping**:
    *   Mengambil postingan dari Farcaster menggunakan Neynar API.
    *   Mengambil postingan dari Twitter/X menggunakan API scraper.
    *   Mengekstrak data dari web airdrop menggunakan Puppeteer/Selenium dengan *Stealth Plugin* untuk menghindari proteksi anti-bot dasar.
*   **Vector DB (ChromaDB) Cache**:
    *   Setiap proyek yang ditemukan diubah menjadi representasi embeddings.
    *   Sebelum diproses oleh Llama 3, skor kemiripan (*similarity score*) dihitung terhadap data ChromaDB.
    *   Jika kemiripan tinggi dengan proyek yang sudah didanai/ditolak sebelumnya, proses dihentikan (menghemat komputasi LLM).
*   **Hybrid Scoring Engine**:
    *   **70% LLM Sentiment**: Llama 3 menganalisis konteks bahasa, keaktifan komunitas, kehadiran Key Opinion Leaders (KOL), dan keaslian proyek.
    *   **30% On-chain Metrics**: Memverifikasi keberadaan Smart Contract di Basescan, status verifikasi source code, serta TVL minimum (misal: > $500,000).
    *   **Threshold**: Jika total nilai > 85, Agent A menghasilkan *JSON Payload* transaksi, menandatanganinya menggunakan *Private Key* Agent A, lalu mengirimkannya ke Agent B.

### 3.2 Agent B (The Vault) - Keamanan & Eksekusi On-Chain

Agent B adalah eksekutor keuangan yang mengeksekusi transfer modal ke proyek yang disetujui. Fokus utamanya adalah keandalan transaksi dan keamanan dana.

*   **Manajemen Kunci (Key Management)**:
    *   Menggunakan EOA (Externally Owned Account) untuk fungsionalitas cepat di hackathon.
    *   Private key disimpan dan diproses secara aman menggunakan **AWS KMS** atau **HashiCorp Vault**. Private key tidak boleh disimpan secara plaintext di dalam `.env`.
*   **Keandalan RPC & Gas**:
    *   **Gas Station Oracle**: Melakukan estimasi biaya gas real-time (+15% dari rata-rata pasar) untuk menghindari transaksi menggantung (*stuck*).
    *   **Multi-RPC Fallback**: Eksekusi utama dikirim via Alchemy. Jika gagal/timeout, sistem otomatis berpindah ke Infura atau RPC Publik Base.
*   **Pencegahan Double-Spending & Idempotensi**:
    *   Sebelum mengirimkan transaksi, hash unik yang berasal dari kombinasi `(AgentA_ID, Project_Address, Timestamp)` dicatat ke database **PostgreSQL**.
    *   Jika Agent A mengirim payload ganda akibat retry jaringan, Agent B akan menolak transaksi tersebut secara lokal berdasarkan catatan unik di database PostgreSQL.
*   **Circuit Breaker & Transaksi Cap**:
    *   **Limit Otomatis**: Batas transaksi otonom (tanpa campur tangan manusia) dibatasi keras antara $1 hingga $2 USD per transaksi.
    *   **Manual Approval Queue**: Jika kebutuhan dana transaksi > $2 USD, status transaksi masuk ke antrean persetujuan manual di Next.js Web Dashboard.
    *   **Emergency Pause (Kill Switch)**: Tombol darurat global yang dapat diaktifkan melalui Web Dashboard untuk membekukan semua transaksi jika terdeteksi anomali pada LLM.
*   **Validasi Anti-Honeypot**:
    *   Sebelum transaksi sesungguhnya di-broadcast ke mempool, Agent B menjalankan simulasi lokal (*dry-run*) melalui Tenderly atau *forge script* (mem-fork state Base). Jika simulasi mendeteksi transaksi akan gagal (*revert*) atau menguras dana di luar batas aman, transaksi dibatalkan seketika.

---

## 4. Protokol Komunikasi Antar Agen

Komunikasi antar-agen harus aman dari serangan *Man-in-the-Middle* (MitM) dan manipulasi data.

### 4.1 Spesifikasi Payload REST API
Agen berkomunikasi menggunakan payload JSON yang ditandatangani secara kriptografis menggunakan skema tanda tangan ECDSA.

*   **Endpoint**: `POST /api/v1/vault/execute`
*   **Payload Schema**:
    ```json
    {
      "timestamp": 1718500000,
      "project_target_address": "0x1234567890abcdef1234567890abcdef12345678",
      "amount_usd": 1.50,
      "reason": "High positive sentiment on Farcaster + Verified TVL > 500k",
      "signature": "0xabc123...def456"
    }
    ```
*   **Verifikasi Tanda Tangan**:
    1. Agent A membuat hash dari string JSON payload (tanpa kolom `signature`).
    2. Agent A menandatangani hash tersebut menggunakan private key miliknya.
    3. Agent B menerima payload, mendekripsinya, memverifikasi tanda tangan menggunakan public key Agent A yang terdaftar di whitelist.
    4. Jika valid dan nilai `timestamp` masih berlaku (dalam rentang waktu aman), transaksi diproses.

### 4.2 Manajemen State LangGraph
Alur koordinasi antar agen dikelola dalam LangGraph State:
*   **State Variable**: `current_step` (`"Scraping"` | `"Analyzing"` | `"Approval"` | `"Executing"`)
*   **State Variable**: `transaction_status` (`"Pending"` | `"Success"` | `"Failed"`)
*   **Retry Policy**: Jika Agent B mengalami timeout atau kesalahan konektivitas RPC, LangGraph memicu **Exponential Backoff** retry (2s, 4s, 8s) sebelum akhirnya menandai transaksi sebagai `"Failed"`.

---

## 5. Spesifikasi Dashboard UI (Next.js)

Web Dashboard berfungsi sebagai pusat kendali visual bagi pengguna dan tim penilai untuk mengamati operasional otonom secara *real-time*.

### 5.1 Desain Visual & Aksesibilitas
*   **Aesthetics**: Menggunakan desain bernuansa gelap (*sleek dark mode*), efek kaca (*glassmorphism*), gradasi warna modern (Purple & Cyan Accent), dan animasi mikro haptik (`active:scale-95`).
*   **Typography**: Menggunakan font *Inter* untuk keterbacaan data numerik/tabel dan *Outfit* untuk heading.
*   **Accessibility (a11y)**: Setiap elemen interaktif dilengkapi dengan indikator fokus keyboard (*focus rings*), atribut `aria-label`, peran semantik, dan area sentuh minimal 44x44 piksel untuk kemudahan penggunaan di perangkat seluler.

### 5.2 Komponen Halaman Utama
1.  **Navbar**:
    *   Logo & Branding Proyek.
    *   Indikator status koneksi (ping) real-time untuk **Agent A (The Scout)** dan **Agent B (The Vault)**.
2.  **Circuit Breaker (Emergency Switch)**:
    *   Sakelar kontrol global untuk menangguhkan seluruh eksekusi transaksi secara instan jika terdeteksi perilaku abnormal.
    *   Dilengkapi dengan feedback visual yang mencolok saat berstatus paused (warna merah membara).
3.  **Live Log Feed (Terminal AI)**:
    *   Streaming log real-time dari aktivitas scraping, embeddings, pemrosesan Llama 3, dan keputusan scoring dari Agent A.
    *   Dilengkapi dengan fitur auto-scroll otomatis yang dapat dinonaktifkan secara interaktif dan area `aria-live` untuk pembaca layar.
4.  **Approval Queue (Antrean Persetujuan)**:
    *   Daftar transaksi yang membutuhkan otorisasi manual karena nominalnya melebihi batas otonom ($2 USD).
    *   Menampilkan detail target, alasan penilaian LLM, jumlah nominal, dan tombol "Approve" atau "Reject" yang responsif.
5.  **Transaction List (Riwayat Transaksi)**:
    *   Tabel interaktif yang menampilkan transaksi yang sukses dieksekusi oleh Agent B.
    *   Informasi kolom: Target Project, Amount (USD), Timestamp, Status (Success/Failed), dan link eksternal Tx Hash ke Basescan Explorer.

---

## 6. Persyaratan Non-Fungsional (Non-Functional Requirements)

### 6.1 Performa & Latensi
*   Siklus lengkap dari deteksi media sosial hingga pengiriman transaksi ke blockchain harus diselesaikan dalam waktu kurang dari 30 detik pada server AMD MI300X.
*   Kecepatan inferensi model Llama 3 8B menggunakan vLLM-ROCm minimal harus mencapai 50 tokens per detik.

### 6.2 Keamanan & Integritas
*   Kunci privat (Private key) eksekusi transaksi tidak boleh bocor ke internet atau disimpan dalam kode sumber.
*   Semua data payload eksekusi wajib divalidasi tanda tangannya sebelum memicu pengiriman dana.
*   Simulasi Tenderly/forge harus dijalankan untuk mendeteksi *honeypot contract* yang sengaja dibuat untuk menguras dana agen.

### 6.3 Skalabilitas & Keandalan
*   Database relasional PostgreSQL harus mendukung pencatatan transaksi unik hingga jutaan entri tanpa hambatan performa.
*   Penanganan kegagalan RPC wajib mendukung fail-over otomatis ke minimal 3 RPC provider yang berbeda.

---

## 7. Panduan Setup & Instalasi (Setup & Installation)

### 7.1 Docker Services (docker-compose.yml)
Menjalankan PostgreSQL dan ChromaDB secara kontainerisasi di server.
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

### 7.2 Menjalankan vLLM pada AMD MI300X
Perintah untuk menginstalisasi pustaka ROCm dan menjalankan model Llama 3:
```bash
# Instalasi vLLM khusus AMD ROCm
pip install vllm-rocm

# Menjalankan server Llama 3 8B
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3-8B-Instruct \
  --tensor-parallel-size 1 \
  --device rocm
```

### 7.3 Konfigurasi File Lingkungan (.env)
*   **agent-a/.env**:
    ```env
    NEYNAR_API_KEY=api_key_farcaster_anda
    VLLM_ENDPOINT=http://localhost:8000/v1
    AGENT_A_PRIVATE_KEY=kunci_privat_penandatangan_payload
    ```
*   **agent-b/.env**:
    ```env
    BASE_RPC_URL_PRIMARY=https://base-mainnet.g.alchemy.com/v2/your_alchemy_key
    BASE_RPC_URL_FALLBACK=https://mainnet.base.org
    KMS_REGION=us-east-1
    POSTGRES_URI=postgresql://a2z_admin:secure_password@localhost:5432/a2z_transactions
    AGENT_A_PUBLIC_KEY=kunci_publik_verifikasi_whitelist
    ```

---

## 8. Rencana Implementasi & Roadmap

### Fase 1: Frontend & Prototipe UI (Selesai)
*   [x] Inisialisasi proyek Next.js & konfigurasi Tailwind CSS v4.
*   [x] Pembuatan komponen visual `Navbar`, `LiveLog`, `TransactionList`, `ApprovalQueue`, dan `CircuitBreaker`.
*   [x] Optimalisasi UI/UX kelas premium (animasi mikro, transisi mulus, keramahan keyboard, target klik).
*   [x] Verifikasi build statis Next.js.

### Fase 2: Backend & AI Engine (Sedang Berjalan)
*   [ ] Konfigurasi backend Python dengan `LangGraph` untuk orkestrasi graf kerja.
*   [ ] Penyetelan server `vLLM` pada hardware AMD MI300X dengan framework ROCm.
*   [ ] Implementasi scraper Puppeteer/Selenium Stealth dan integrasi Neynar API.
*   [ ] Integrasi ChromaDB untuk *caching* embeddings sentimen proyek.

### Fase 3: Eksekusi Transaksi & Keamanan (Segera)
*   [ ] Pembuatan modul transaksi web3 dengan integrasi AWS KMS.
*   [ ] Penyusunan skema verifikasi tanda tangan kriptografi antar agen.
*   [ ] Integrasi pengecekan idempotensi pada PostgreSQL dan simulasi Tenderly *dry-run*.
*   [ ] Implementasi sistem *Circuit Breaker* on-chain dan pembatasan nominal transaksi.

### Fase 4: Integrasi End-to-End & Uji Coba (Segera)
*   [ ] Menghubungkan log server Python real-time ke Dashboard UI via WebSockets/SSE.
*   [ ] Pengujian menyeluruh skenario kegagalan RPC dan penanganan retry otomatis.
*   [ ] Pitching video dan demo produk akhir untuk AMD Developer Hackathon Act II.
