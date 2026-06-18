# 01. Arsitektur Sistem Terintegrasi

Dokumen ini menjelaskan arsitektur *high-level* dari sistem **A2Z Agentz** (Autonomous A2A Payment Agent), dibangun **100% di atas AMD stack** untuk AMD Developer Hackathon: ACT II.

## Diagram Arsitektur (End-to-End)

```mermaid
graph TD
    subgraph Data Sources
        F[Farcaster / Neynar API]
        T[Twitter / X]
        O[On-Chain Block Explorer]
    end

    subgraph AMD Developer Cloud — Agent A (The Scout)
        AW[AMD AI Workbench<br/>Fine-Tune GUI]
        AIM[AMD Inference Microservice<br/>Web3-tuned LLM]
        SGL[SGLang Server<br/>ROCm backend]
        VDB[(ChromaDB - Memory)]
        Sc[Scraper / Headless Browser]
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

    subgraph User Interface (TypeUI Design System)
        UI[Next.js Web Dashboard]
        PWA[PWA: Service Worker + Manifest]
        CMD[Command Palette ⌘+K]
        SKELETON[Loading Skeletons]
        A11Y[Skip-to-Content + Reduced Motion]
    end

    Scoring -->|JSON Payload| API
    API --> VaultCore
    VaultCore -->|Execute Tx| RPC
    RPC --> SC
    SC -->|Tx Hash| DB
    VaultCore -->|Live Logs| UI
```

## Komponen Utama

1. **Hardware AMD Instinct™ MI300X** (192GB HBM3) — Inti komputasi AI, tersedia di **AMD Developer Cloud**. Semua inferensi LLM berjalan di GPU ini via **SGLang** dengan backend **ROCm**.
2. **AMD AI Workbench** — GUI no-code yang digunakan untuk *fine-tune* base LLM (Llama 3 8B Instruct) menjadi **AIM-tuned LLM** yang ter-specialisasi untuk analisis sentimen Web3 (Farcaster, Twitter, on-chain narrative).
3. **AMD Inference Microservice (AIM)** — Format deployment standar AMD untuk hasil fine-tune. LLM terungkus sebagai *microservice* yang bisa di-panggil via HTTP/gRPC oleh Agent A.
4. **SGLang (AMD-recommended)** — *Serving framework* LLM *high-throughput* yang berjalan di atas ROCm. Bertugas menerima *request* inference dari Agent A dan mengembalikan *response* terstruktur.
5. **LangGraph Framework** — Mengorkestrasi state graf antar-agen, menangani *retry mechanism* dan *backpressure*.
6. **Database Relasional & Vector**:
   - **ChromaDB** — Long-term memory Agent A agar tidak menganalisis proyek yang sama berulang kali.
   - **PostgreSQL** — Log transaksi Agent B untuk memastikan status *idempotency* (mencegah *double-spending*).
7. **Hybrid Approval Mode** — Semua transaksi < $2 berjalan otonom. Jika > $2, proses tertahan di *Dashboard Next.js* dan butuh klik "Approve" dari manusia.

## Alur AMD Pipeline (Inti)

```
Base Llama 3 8B (HuggingFace)
        │
        ▼
[AMD AI Workbench — fine-tune pada dataset Web3 sentiment]
        │
        ▼
AIM-tuned weights (.safetensors)
        │
        ▼
[AMD Inference Microservice (AIM) — wrap sebagai container]
        │
        ▼
[SGLang server — load AIM di ROCm backend pada MI300X]
        │
        ▼
Agent A Scout → panggil AIM via OpenAI-compatible API
```

Seluruh pipeline berjalan di **AMD Developer Cloud**, tanpa ketergantungan pada provider cloud eksternal untuk workload AI-nya.

---

## Frontend Architecture (Dashboard)

### TypeUI Design System

Dashboard menggunakan sistem desain internal bernama **TypeUI** dengan token-token berikut (didefinisikan di `globals.css` via CSS `:root` variables):

| Token | Kegunaan |
|-------|----------|
| `--color-brand` | Warna utama (purple gradient) |
| `--color-brand-medium` | Variasi brand medium |
| `--color-brand-soft` | Brand glow / shadow |
| `--color-heading` | Warna teks heading |
| `--color-body` | Warna teks body |
| `--color-body-subtle` | Teks sekunder / muted |
| `--color-border-default` | Border standar |
| `--color-neutral-secondary-medium` | Background netral |
| `--font-heading` (Outfit) | Font heading |
| `--font-body` (Inter) | Font body / data |
| `--font-mono` (Geist Mono) | Font log / code |

Glassmorphism: `.glass` dan `.glass-card` utility classes untuk efek blur transparan.

### Component Hierarchy

```
App Layout (layout.tsx)
├── SkipToContent          ← WCAG 2.1 skip link
├── RouteProgress          ← Top loading bar
├── PWARegister            ← Service worker registration
├── KeyboardNavWrapper     ← Global keyboard shortcuts
│   ├── Toast (provider)   ← Toast notification system
│   ├── ErrorBoundary      ← Crash recovery
│   ├── Sidebar            ← Navigation
│   ├── Navbar             ← Top bar
│   └── Page Content
│       ├── Breadcrumbs    ← Route trail
│       ├── PageHeader     ← Consistent header
│       ├── CommandPalette ← ⌘+K overlay
│       ├── CommandCenter  ← Action overlay
│       └── Page Components
│           ├── KpiCard / AnimatedCounter
│           ├── Skeleton (loading state)
│           ├── EmptyState (no data)
│           └── ScrollToTop
```

### Loading & Streaming Patterns

Setiap route memiliki `loading.tsx` yang menampilkan **Skeleton** komponen saat data sedang dimuat:

- `app/loading.tsx` — Root dashboard skeleton (6 KPI cards + 3-column grid)
- `app/analytics/loading.tsx` — Chart skeletons (area, line, bar)
- `app/memory/loading.tsx` — Vector memory explorer skeleton
- `app/settings/loading.tsx` — Settings form skeleton
- `app/history/loading.tsx` — Audit trail table skeleton

Pattern: **Streaming SSR** via Next.js App Router — komponen server mengalir data ke komponen client, dengan `loading.tsx` sebagai Suspense boundary.

### Error Handling

- `ErrorBoundary.tsx` — Setiap section utama dibungkus error boundary dengan fallback UI
- `not-found.tsx` — Custom 404 page (animated, branded)
- `Toast.tsx` — Notifikasi error/info/success global (ARIA live regions)

### Accessibility Stack

- `SkipToContent.tsx` — WCAG 2.1 skip navigation link
- `useReducedMotion.ts` — Detect `prefers-reduced-motion` media query
- `KeyboardNavWrapper.tsx` — Full keyboard navigation (1-5 routes, ⌘+K, Esc)
- `aria-live="polite"` pada semua area yang update real-time (LiveLog, Toast)
- `role="log"`, `role="alert"`, `aria-label` pada semua interactive elements
- Focus-visible rings pada semua interactive targets
- Touch targets minimum 44×44px
