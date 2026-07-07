# 01. Arsitektur Sistem Terintegrasi

Dokumen ini menjelaskan arsitektur *high-level* dari sistem **A2Z Agentz** (Autonomous A2A Payment Agent), dibangun **100% di atas AMD stack** untuk AMD Developer Hackathon: ACT II.

## Diagram Arsitektur (End-to-End)

```mermaid
graph TD
    subgraph Data Sources
    F[Farcaster / Neynar API]
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
        AUTH[Auth System: Login / Register]
        MW[Middleware: JWT Cookie Protection]
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
2. **AMD AI Workbench** — GUI no-code yang digunakan untuk *fine-tune* base LLM (Qwen 2.5 72B Instruct) menjadi **AIM-tuned LLM** yang ter-specialisasi untuk analisis sentimen Web3 (Farcaster and on-chain narrative).
3. **AMD Inference Microservice (AIM)** — Format deployment standar AMD untuk hasil fine-tune. LLM terungkus sebagai *microservice* yang bisa di-panggil via HTTP/gRPC oleh Agent A.
4. **SGLang (AMD-recommended)** — *Serving framework* LLM *high-throughput* yang berjalan di atas ROCm. Bertugas menerima *request* inference dari Agent A dan mengembalikan *response* terstruktur.
5. **LangGraph Framework** — Mengorkestrasi state graf antar-agen, menangani *retry mechanism* dan *backpressure*.
6. **Database Relasional & Vector**:
   - **ChromaDB** — Long-term memory Agent A agar tidak menganalisis proyek yang sama berulang kali.
   - **PostgreSQL** — Log transaksi Agent B untuk memastikan status *idempotency* (mencegah *double-spending*).
7. **Hybrid Approval Mode** — Semua transaksi < $2 berjalan otonom. Jika > $2, proses tertahan di *Dashboard Next.js* dan butuh klik "Approve" dari manusia.
8. **Auth System** — Autentikasi email/password dengan JWT httpOnly cookie (7 hari). Backend Starlette: `POST /api/auth/register`, `/login`, `GET /me`, `POST /logout`. Tabel `users` di PostgreSQL (bcrypt hash). Frontend: `AuthProvider` React Context + Next.js middleware route protection. Optional wallet address saat register.
9. **Route Protection** — Next.js middleware memeriksa keberadaan cookie `a2z-token`. Unauthenticated → redirect `/login`. Authenticated di halaman auth → redirect `/dashboard`.

## Alur AMD Pipeline (Inti)

```
Base Qwen 2.5 72B Instruct (HuggingFace)
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

### Route & Layout Architecture

Next.js App Router dikelompokkan ke dalam dua grup rute utama untuk memisahkan layout visual landing page dan dashboard:
1. **`(landing)` Group** (`dashboard/src/app/(landing)/`):
   - **Rute**: `/` (Landing Page)
   - **Visual**: Background 2D `<canvas>` Particle Network interaktif (`AgentScene.tsx`) yang beradaptasi dengan perubahan tema, didukung efek mouse parallax, HSL breathing grid, dan scanlines cybernetic.
   - **Main Component**: Mockup Terminal retro dengan GIF animasi multi-agent `A2Z-animation.gif` otonom (Agent A & Agent B).
2. **`(dashboard)` Group** (`dashboard/src/app/(dashboard)/`):
   - **Rute**: `/dashboard` (Dashboard Utama) beserta halaman pendukung (`/agents`, `/analytics`, `/memory`, `/settings`, `/history`).
   - **Layout**: Sidebar & Navbar permanen, state management tersinkronisasi (`DashboardContext.tsx`), serta global keybindings wrapper.

### Component Hierarchy

```
Root Layout (dashboard/src/app/layout.tsx)
├── PWARegister                ← Service worker registration
├── ToastProvider & Toast      ← Global toast notification system
├── RouteProgress              ← Top transition loading bar
└── Rute Grup
    ├── (landing) Layout
    │   └── Landing Page (page.tsx)
    │       ├── AgentScene     ← Interactive HTML5 2D Canvas Background
    │       └── Terminal UI    ← Cyberpunk Mockup Terminal with A2Z-animation.gif
    └── (dashboard) Layout (layout.tsx)
        ├── SkipToContent      ← WCAG 2.1 skip link
        ├── KeyboardNavWrapper ← Global keyboard shortcuts (1-5 routes, Esc, etc.)
        │   ├── KeyboardHelpOverlay
        │   ├── OnboardingTour
        │   ├── Sidebar        ← Main Navigation
        │   └── Main Area
        │       ├── Navbar     ← Top bar w/ AMD status indicators
        │       ├── Breadcrumbs← Route trail navigation
        │       ├── Page Content
        │       │   ├── PageHeader
        │       │   ├── CommandPalette  ← ⌘+K overlay
        │       │   ├── CommandCenter   ← Actions overlay
        │       │   └── Page Components (KpiCard, AnalyticsCharts, etc.)
        │       └── ScrollToTop
```

### Loading & Streaming Patterns

Setiap rute di bawah grup `(dashboard)` memiliki `loading.tsx` yang menampilkan **Skeleton** komponen saat data sedang dimuat secara asinkron (Streaming SSR):

- `dashboard/src/app/(dashboard)/loading.tsx` — Root dashboard skeleton (6 KPI cards + 3-column grid)
- `dashboard/src/app/(dashboard)/analytics/loading.tsx` — Chart skeletons (area, line, bar)
- `dashboard/src/app/(dashboard)/memory/loading.tsx` — Vector memory explorer skeleton
- `dashboard/src/app/(dashboard)/settings/loading.tsx` — Settings form skeleton
- `dashboard/src/app/(dashboard)/history/loading.tsx` — Audit trail table skeleton

Pattern: **Streaming SSR** via Next.js App Router — data simulasi real-time dialirkan secara asinkron dari server ke komponen client, menggunakan `loading.tsx` sebagai Suspense boundary.

### Error Handling

- `ErrorBoundary.tsx` — Setiap section utama dibungkus error boundary dengan fallback UI untuk pemulihan crash seketika.
- `not-found.tsx` — Custom 404 page (animated, branded).
- `Toast.tsx` — Notifikasi error/info/success global (ARIA live regions).

### Accessibility Stack

- `SkipToContent.tsx` — WCAG 2.1 skip navigation link.
- `useReducedMotion.ts` — Mendeteksi media query `prefers-reduced-motion`.
- `KeyboardNavWrapper.tsx` — Navigasi keyboard penuh (1-5 rute, ⌘+K, Esc).
- `aria-live="polite"` pada semua area yang update real-time (LiveLog, Toast).
- `role="log"`, `role="alert"`, `aria-label` pada semua interactive elements.
- Focus-visible rings pada semua target interaktif.
- Area sentuh (touch targets) minimum 44×44px.
