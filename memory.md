# 📋 Memory — Dokumentasi Perubahan Proyek A2Z Agentz

Dokumen ini mencatat seluruh riwayat perubahan proyek secara kronologis, mencakup file yang ditambahkan, diubah, atau dihapus beserta alasan perubahannya.

---

## Sesi 1 — 2026-06-16 | Inisialisasi Dokumentasi & Arsitektur

### 📌 Ringkasan
Sesi pertama berfokus pada pembangunan fondasi dokumentasi proyek berdasarkan konsep awal "Autonomous Airdrop / Web3 Scavenger Agent" untuk **AMD Developer Hackathon Act II** dengan tema *Agent-to-Agent Payments*. Stack awal: **Llama 3 8B + vLLM ROCm** (stack generik, sebelum alignment ke tema ACT II).

### ✅ File yang DITAMBAHKAN

| File | Lokasi | Deskripsi |
|------|--------|-----------|
| `README.md` | `/` | Halaman muka repositori |
| `docs/01-architecture.md` | `/docs/` | Diagram arsitektur end-to-end Mermaid |
| `docs/02-agent-a-scout.md` | `/docs/` | Spesifikasi Agent A (Scout) — pipeline cron, OSINT, ChromaDB, Hybrid Scoring |
| `docs/03-agent-b-vault.md` | `/docs/` | Spesifikasi Agent B (Vault) — KMS, Gas Oracle, Multi-RPC, Circuit Breaker |
| `docs/04-communication-protocol.md` | `/docs/` | Protokol komunikasi: payload JSON, ECDSA, LangGraph |
| `docs/05-setup-guide.md` | `/docs/` | Panduan instalasi vLLM ROCm + Docker Compose + .env |

---

## Sesi 2 — 2026-06-16 | Pembangunan Frontend Phase 1 (Dashboard MVP)

### 📌 Ringkasan
Membangun antarmuka web dashboard **Next.js 16** + **Tailwind CSS v4** untuk visualisasi aktivitas Agent A & Agent B real-time. Tema desain: *Sleek Dark Mode* + glassmorphism.

### ✅ File yang DITAMBAHKAN

| File | Lokasi | Deskripsi |
|------|--------|-----------|
| `package.json` | `/dashboard/` | Next.js 16 + React 19 + Tailwind v4 |
| `globals.css` | `/dashboard/src/app/` | Design system: CSS variables, font tokens, `.glass`, `.glass-card`, custom keyframes |
| `layout.tsx` | `/dashboard/src/app/` | Root layout dengan Google Fonts (Inter, Outfit, Geist Mono) |
| `page.tsx` | `/dashboard/src/app/` | Halaman utama dashboard 3-kolom + ambient glow |
| `Navbar.tsx` | `/dashboard/src/components/` | Branding + ping indicator Agent A & B |
| `LiveLog.tsx` | `/dashboard/src/components/` | Terminal log real-time simulasi scraping |
| `TransactionList.tsx` | `/dashboard/src/components/` | Tabel tx on-chain + link Tx Hash ke Basescan |
| `ApprovalQueue.tsx` | `/dashboard/src/components/` | Antrean tx > $2 butuh persetujuan manual |
| `CircuitBreaker.tsx` | `/dashboard/src/components/` | Toggle darurat (Kill Switch) |

---

## Sesi 3 — 2026-06-16 | Peningkatan UI/UX Pro Max (Phase 1.5)

### 📌 Ringkasan
Refaktor semua komponen berdasarkan standar **UI/UX Pro Max Skill**: aksesibilitas WCAG AA, area sentuh minimum 44×44px, animasi mikro haptik, aria semantics.

### ✏️ File yang DIUBAH
- `CircuitBreaker.tsx` — `aria-pressed`, `aria-label`, `focus-visible:ring-2`, `role="alert"`, `active:scale-95`
- `ApprovalQueue.tsx` — Empty State, tombol Approve/Reject ≥ 44px, transisi fade
- `TransactionList.tsx` — Stagger entrance, `tabular-nums`, `focus-visible:ring`
- `LiveLog.tsx` — `aria-live="polite"`, `role="log"`, pause auto-scroll interaktif

### ✅ Verifikasi
- `npm run build` PASSED, 0 errors, 0 warnings
- 8/8 static pages generated

---

## Sesi 4 — 2026-06-16 | Pembuatan PRD.md

### 📌 Ringkasan
Menganalisis semua file `docs/` + `dashboard/` untuk menyusun **PRD** komprehensif (298 baris): latar belakang, diagram Mermaid, spesifikasi Agent A/B, protokol ECDSA, dashboard UI, NFR, setup guide, roadmap 4 fase.

### ✅ File yang DITAMBAHKAN
- `PRD.md` — PRD lengkap

---

## Sesi 5 — 2026-06-16 | Perluasan Frontend Multi-Halaman (Phase 2)

### 📌 Ringkasan
Ekspansi dashboard single-page → multi-halaman. 9 komponen baru, 5 halaman baru, sistem state global via `DashboardContext`. Tambah `recharts` + `lucide-react`.

### 📦 Dependensi Baru
- `recharts` ^2.x — Library chart (TVL, gas, success rate)
- `lucide-react` ^0.x — Icon SVG konsisten

### ✅ File Baru (Komponen)
- `DashboardContext.tsx` — Global state + data simulator real-time
- `Sidebar.tsx` — Collapsible sidebar nav
- `KpiCard.tsx` — Reusable metric card (5 varian warna)
- `PageHeader.tsx` — Header halaman konsisten
- `DashboardKpis.tsx` — 6 KPI cards (TVL, success rate, total tx, dll)
- `AnalyticsCharts.tsx` — 3 Recharts (TVL area, gas line, success/fail bar)
- `VectorMemoryExplorer.tsx` — ChromaDB cache viewer
- `SettingsPanel.tsx` — Form config Agent A & B
- `AuditTrail.tsx` — Log audit paginated (10/page) + search + filter

### ✅ File Baru (Halaman)
- `analytics/page.tsx` — `/analytics`
- `memory/page.tsx` — `/memory`
- `settings/page.tsx` — `/settings`
- `history/page.tsx` — `/history`

### ✏️ File DIUBAH
- `Navbar.tsx` — Context-aware + AMD MI300X/ROCm badge
- `CircuitBreaker.tsx` — Lucide icons + status badge ACTIVE/PAUSED
- `LiveLog.tsx` — Color-coding 6 level log
- `ApprovalQueue.tsx` — Context-aware + Inbox empty state
- `TransactionList.tsx` — Expandable rows + Basescan link
- `layout.tsx` — DashboardProvider + Sidebar
- `page.tsx` — KPI + Circuit Breaker + grid 3-kolom

---

## Sesi 6 — 2026-06-17 | **AMD Stack Alignment — Migrasi ke Toolchain AMD-Native**

### 📌 Ringkasan
**CRITICAL REVISION.** Telaah mendalam terhadap tema ACT II + blog AMD menunjukkan bahwa stack sebelumnya (**Llama 3 8B + vLLM generik**) tidak optimal untuk ACT II. Hackathon eksplisit mendorong penggunaan:

- **AMD AI Workbench** (no-code fine-tune LLM, fitur unggulan AMD)
- **AMD Inference Microservice (AIM)** (format deployment hasil fine-tune)
- **SGLang** (serving framework AMD-recommended di ROCm, pengganti vLLM)
- **AMD Instinct MI300X** + **ROCm** di **AMD Developer Cloud**

Penyelarasan ini menjadikan A2Z Agentz **100%契合 (cocok) dengan tema wajib ACT II** dan memberi kami keunggulan vs submission lain yang masih pakai OpenAI API atau stack generik.

### ✏️ File yang DIUBAH (Major Revision)

| File | Perubahan |
|------|-----------|
| `README.md` | Tambah section "AMD-Native Tech Stack" (tabel pemetaan). Swap vLLM → SGLang, tambah AMD AI Workbench + AIM. Tagline update: "100% AMD stack" |
| `PRD.md` | Full rewrite. Section 2.2 ganti tech stack. Section 3.1 swap "Llama 3 8B via vLLM" → "AIM-tuned LLM via AMD AI Workbench → SGLang → MI300X". Tambah section 6.4 "AMD Stack Compliance". Update Fase 2-4 roadmap dengan milestone AMD |
| `docs/01-architecture.md` | Mermaid diagram update: tambah subgraph AMD Developer Cloud (AI Workbench → AIM → SGLang). Tambah section "Alur AMD Pipeline" |
| `docs/02-agent-a-scout.md` | Section 2 full rewrite: AMD AI Workbench fine-tune workflow + AIM packaging + SGLang serving. Tambah section "AMD Performance Advantage" (throughput, latency, cost) |
| `docs/03-agent-b-vault.md` | Minor: tambah catatan "Agent B tidak menjalankan LLM" + context deployment di AMD Cloud |
| `docs/04-communication-protocol.md` | Tambah section "Inference Endpoint Reference" — request format ke SGLang/AIM OpenAI-compatible |
| `docs/05-setup-guide.md` | Full rewrite Langkah 1-3: AMD AI Workbench workspace → fine-tune Llama 3 8B → export AIM → serve via SGLang ROCm di MI300X |
| `dashboard/README.md` | Minor: tambah badge AMD MI300X + ROCm |

### ✅ File yang DITAMBAHKAN (Baru)

| File | Lokasi | Deskripsi |
|------|--------|-----------|
| `docs/06-amd-stack.md` | `/docs/` | **Dokumen alignment khusus untuk juri hackathon** — pemetaan detail ke tema ACT II, demo flow 8-step, referensi eksternal AMD blogs |
| `LICENSE` | `/` | MIT License (IP clarity untuk submission) |
| `.gitignore` | `/` | Root .gitignore (sebelumnya hanya di `dashboard/`) |
| `SUBMISSION.md` | `/` | Submission checklist untuk lablab.ai ACT II |

### 📊 Ringkasan Sesi 6
- **8 file markdown** di-update ke stack AMD-native
- **4 file baru** ditambahkan (dokumen alignment + repo hygiene)
- **0 file dihapus**
- **Konsep & frontend tetap sama** — hanya stack AI yang dimigrasi

---

## 📊 Ringkasan Total Perubahan (Semua Sesi)

| Kategori | Jumlah |
|----------|--------|
| File baru ditambahkan | **29 file** |
| File yang diubah/direfaktor | **11 file** |
| File dihapus | **0 file** |
| Dependensi baru | **2 paket** (`recharts`, `lucide-react`) |
| Route/halaman baru | **4 route** |
| Komponen baru | **9 komponen** |
| Komponen direfaktor | **5 komponen** |
| **Dokumen alignment** | **1 file khusus juri** (`docs/06-amd-stack.md`) |
| **Stack migrasi** | **1 sesi** (Sesi 6 — vLLM → AMD AI Workbench + AIM + SGLang) |

---

## 🔍 Status Build Terakhir

```
npm run build — 2026-06-16T15:16:59Z

▲ Next.js 16.2.9 (Turbopack)
✓ Compiled successfully in 8.5s
✓ TypeScript passed in 6.7s
✓ Static pages generated: 8/8

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /analytics
├ ○ /history
├ ○ /memory
└ ○ /settings
```

**Status: ✅ PASSED — 0 errors, 0 warnings**

---

## 🗂️ Struktur Direktori Akhir

```
project-a2z-agentz/
├── README.md                          # AMD-stack branding
├── PRD.md                             # Full PRD w/ AMD alignment
├── memory.md                          # File ini
├── SUBMISSION.md                      # Checklist lablab.ai ACT II
├── LICENSE                            # MIT
├── .gitignore                         # Root gitignore
├── docs/
│   ├── 01-architecture.md             # Mermaid + AMD pipeline
│   ├── 02-agent-a-scout.md            # AMD AI Workbench + AIM + SGLang
│   ├── 03-agent-b-vault.md            # KMS, Gas, Multi-RPC
│   ├── 04-communication-protocol.md   # ECDSA + SGLang endpoint
│   ├── 05-setup-guide.md              # End-to-end AMD Cloud setup
│   └── 06-amd-stack.md                # [BARU] Alignment khusus juri
└── dashboard/
    ├── package.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx
        │   ├── globals.css
        │   ├── analytics/page.tsx
        │   ├── memory/page.tsx
        │   ├── settings/page.tsx
        │   └── history/page.tsx
        └── components/
            ├── DashboardContext.tsx
            ├── Sidebar.tsx
            ├── KpiCard.tsx
            ├── PageHeader.tsx
            ├── DashboardKpis.tsx
            ├── AnalyticsCharts.tsx
            ├── VectorMemoryExplorer.tsx
            ├── SettingsPanel.tsx
            ├── AuditTrail.tsx
            ├── Navbar.tsx
            ├── CircuitBreaker.tsx
            ├── LiveLog.tsx
            ├── ApprovalQueue.tsx
            └── TransactionList.tsx
```
