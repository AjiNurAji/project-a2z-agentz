# 🤖 A2Z Agentz — Autonomous A2A Payment Agent on AMD

Selamat datang di repositori **A2Z Agentz**, proyek **AMD Developer Hackathon: ACT II** dengan tema *Agent-to-Agent Payments*.

Sistem *multi-agent* otonom yang berjalan 100% di atas infrastruktur **AMD** — dari *fine-tuning* model LLM di **AMD AI Workbench**, *deployment* via **AMD Inference Microservice (AIM)**, hingga *inference* di-**serve** oleh **SGLang** di atas GPU **AMD Instinct™ MI300X** dengan **ROCm** runtime, semuanya di **AMD Developer Cloud**.

Agen ini mencari peluang Web3 (DeFi/Airdrop) berkualitas, mengeksekusi pembayaran *gas fee* atau modal awal, dan meng-*settle* transaksi on-chain di jaringan **Base** — sepenuhnya otonom antar-agen (*Agent-to-Agent Payment*).

## 🌟 Konsep Utama

Sistem ini terdiri dari dua agen utama yang bekerja secara asinkron menggunakan *framework* **LangGraph**:

1. **Agent A (The Scout)** — Otak intelijen. Model **AIM-tuned LLM** (fine-tuned via **AMD AI Workbench** dari base Llama 3 8B untuk domain Web3 sentiment), di-serve via **SGLang** di **AMD Instinct MI300X**. Memindai Farcaster, Twitter/X, dan data on-chain setiap 1 jam.
2. **Agent B (The Vault)** — Eksekutor *smart contract* yang mengelola *wallet* (EOA) dengan sistem keamanan *Multi-RPC*, KMS, dan *Circuit Breaker*. Menerima instruksi terenkripsi dari Agent A untuk melakukan pembayaran.

## 🛠️ AMD-Native Tech Stack (Kewajiban Hackathon)

| Layer | Teknologi AMD |
|---|---|
| **Cloud Platform** | AMD Developer Cloud ($100 credits) |
| **GPU** | AMD Instinct™ MI300X (192GB HBM3) |
| **Runtime GPU** | AMD ROCm 6.x |
| **Fine-Tuning** | **AMD AI Workbench** (no-code GUI) |
| **Model Deployment** | **AMD Inference Microservice (AIM)** |
| **Inference Server** | **SGLang** (AMD-recommended) |
| **Compute Marketplace** | Akash Systems (co-sponsor) |
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, TypeScript |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Animations** | Motion (motion.dev) |
| **PWA** | Service Worker, Web App Manifest (offline-capable) |

## 📚 Dokumentasi

Baca secara berurutan untuk pemahaman maksimal:

- [01. Arsitektur Sistem](docs/01-architecture.md) — Diagram Mermaid end-to-end + integrasi AMD stack
- [02. Agent A (The Scout)](docs/02-agent-a-scout.md) — Pipeline AMD AI Workbench fine-tune + AIM + SGLang inference
- [03. Agent B (The Vault)](docs/03-agent-b-vault.md) — Keamanan on-chain, Gas Oracle, Idempotensi
- [04. Protokol Komunikasi](docs/04-communication-protocol.md) — Payload JSON, Signature, LangGraph
- [05. Setup Guide](docs/05-setup-guide.md) — Panduan end-to-end install di AMD Developer Cloud
- [06. AMD Stack Alignment](docs/06-amd-stack.md) — Pemetaan detail ke tema & tooling wajib ACT II

## 🚀 Fitur Unggulan (Hackathon Highlights)

- **AMD-Native Pipeline**: Fine-tune LLM di AMD AI Workbench → deploy sebagai AMD Inference Microservice (AIM) → serve via SGLang di MI300X. Sepenuhnya di AMD Developer Cloud.
- **Ultra-Low Latency**: Scraping → AIM inference (SGLang-served) → on-chain Tx selesai dalam < 30 detik di MI300X.
- **Bulletproof Security**: Verifikasi tanda tangan kriptografi, deteksi *double-spending* via PostgreSQL, dan *Emergency Pause* (Circuit Breaker).

### 🎨 Dashboard UI/UX (16 Fitur Production-Grade)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 1 | **Loading Skeletons** | Per-route skeleton states (card, list, chart) |
| 2 | **Toast Notifications** | Success/error/info toast (auto-dismiss, ARIA live) |
| 3 | **Error Boundaries** | Crash recovery dengan fallback UI |
| 4 | **Empty States** | Icon + message + CTA button |
| 5 | **Command Palette** | ⌘+K keyboard-driven command palette |
| 6 | **Command Center** | Grouped action overlay |
| 7 | **Keyboard Navigation** | 1-5 routes, `/` search, `Esc` close |
| 8 | **Animated Counters** | Tween morph number animations |
| 9 | **Tooltips** | Accessible hover/focus tooltips |
| 10 | **Breadcrumbs** | Route-aware navigation trail |
| 11 | **Route Progress** | Top loading bar on page transitions |
| 12 | **Scroll to Top** | Floating scroll button |
| 13 | **Skip to Content** | WCAG 2.1 skip-to-content link |
| 14 | **PWA Support** | Service worker + manifest (offline-capable) |
| 15 | **Export Utilities** | CSV/JSON data export |
| 16 | **Reduced Motion** | Respects `prefers-reduced-motion` |

**Aksesibilitas**: WCAG AA, focus rings, ARIA semantics, 44×44px touch targets, `aria-live` regions, skip-to-content, reduced-motion support.

---

*Dibangun untuk AMD Developer Hackathon: ACT II — menggunakan 100% AMD stack (AI Workbench → AIM → SGLang → MI300X → ROCm).*
