# A2Z Agent Dashboard — Visual Evolution v3 (Maximal)

**Date:** 2026-06-19
**Status:** Design — pending user review
**Scope:** Visual refine + professional copy rewrite + 10 new features across all pages
**Stack:** Next.js 16, React 19, Tailwind v4, Motion (Framer), Recharts, Lucide
**Direction:** Evolusi refine (pertahankan identitas muted-purple, perkuat dengan accent strategis + depth layering)

---

## 1. Context & Motivation

Dashboard A2Z Agent (multi-agent autonomous airdrop scavenger + A2A payments di Base Network) sudah melalui "visual overhaul v2" (50 task). Analisis kritis menemukan gap asli yang layak ditutup, bukan pekerjaan inventif:

- **Palet monokrom** — hampir semua ungu; accent teal/cyan/orange didefinisikan tapi underused.
- **Chart colors hardcoded** di `AnalyticsCharts.tsx` (dua konstanta hex besar) → tidak sync dengan CSS vars, duplikasi sumber kebenaran.
- **Copy inkonsisten/santai** — `"vs 72% avg"`, `"Kill Switch"`, `"All clear"`, `"awaiting approval"`.
- **Bell icon Navbar tidak berfungsi** — panel notifikasi belum ada.
- **Tidak ada halaman Agents** — status agent hanya diselipkan di sidebar.
- **Aksi destruktif tanpa konfirmasi** (pause, blacklist, reject nilai tinggi).
- **Tidak ada score visualization** — LLM score hanya angka.
- **Tema manual only** — tidak ada auto/system option.
- **Tidak ada discoverability** untuk shortcut keyboard yang sudah ada (`1-5`, `⌘K`).
- **Tidak ada onboarding** untuk first-run user.

---

## 2. Design Decisions

### 2.1 Visual Direction: Evolusi Refine
Pertahankan estetika muted-purple sebagai identitas brand, tapi perkuat:
- Gunakan accent (teal/cyan/orange) secara **semantik & strategis** untuk data distinct.
- Tambah depth: 3-tier elevation, glassmorphism halus pada panel mengambang, soft glow pada interactive.
- Perbaiki kontras, spacing, dan konsistensi radius.

### 2.2 Scope: Maksimal (semua fitur)
Visual + copy + 10 fitur baru (lihat §5).

---

## 3. Foundation: Color Tokens & Design System

### 3.1 Semantic color mapping (konsisten app-wide)
| Warna | Penggunaan |
|---|---|
| 💜 Purple (brand) | Identity — active nav, headers, structure |
| 🟢 Green | success / online / approved / confirmed |
| 🟠 Amber | gas / warning / pending |
| 🔴 Red | danger / failed / rejected |
| 🩵 Cyan | Vault / Agent B |
| 💟 Teal | transactions / on-chain |
| 🟦 Sky/Blue | sentiment / scanning |

### 3.2 Chart color sync
- **Hapus** konstanta `CHART_COLORS_DARK`/`CHART_COLORS_LIGHT` hardcoded di `AnalyticsCharts.tsx`.
- **Tambah** hook `useChartColors()` — baca CSS vars via `getComputedStyle(document.documentElement)`, resolve ke objek warna. Re-read saat theme berubah (subscribe ke `useTheme()` + `window.matchMedia('(prefers-color-scheme: dark)')` untuk mode system).
- Fallback ke nilai default sebelum mount (SSR-safe); re-read pada `useEffect` setelah mount.

### 3.3 Token baru (globals.css `:root` + light theme)
```
--color-accent-teal-bright
--color-accent-cyan-bright
--color-glow-brand          /* rgba, untuk hover glow */
--color-glow-danger
--spacing-scale             /* multiplier untuk density toggle */
```

### 3.4 Depth / elevation system
3 tier via class utility:
- `.elevation-1` — flat (table rows, list items): subtle border, no shadow
- `.elevation-2` — card (default panels): card gradient + `--shadow-xs`
- `.elevation-3` — elevated (modals, dropdowns, portaled panels): `--shadow-xl` + blur backdrop

### 3.5 Theme: system option
- ThemeToggle jadi **SegmentedControl 3-ikon** (Sun / System / Moon).
- `system` → ikut `prefers-color-scheme` media query.
- Persist pilihan di localStorage key `a2z-theme` (reuse key yang ada, value baru `"system"`).
- Script inline di `<head>` (sudah ada) di-extend untuk resolve `"system"` → computed theme sebelum paint.

---

## 4. Copy & Voice Guide (Professional English)

### 4.1 Voice principles
- **Presisi di atas jargon** — jelaskan istilah teknis saat pertama muncul.
- **Active voice, ringkas** — "Transactions executed" bukan "Transactions that completed successfully".
- **Status sebagai label** — "Active" bukan "All clear".
- **Bahaya jelas, bukan melodramatis** — "Pause" bukan "Kill Switch".

### 4.2 Rewrite table (sebelum → sesudah)
| Lokasi | Sekarang | Setelah |
|---|---|---|
| KPI trend (TVL) | `"Live tracking"` | `"Above 30-day average"` |
| KPI trend (Success) | `"vs 72% avg"` | `"Above 30-day average"` |
| KPI trend (Gas) | `"+15% efficiency"` | `"+15% vs last cycle"` |
| KPI subValue (Gas) | `"via oracle optimization"` | `"Oracle-optimized gas"` |
| KPI subValue (Total Txs) | `"on Base Network"` | `"Base mainnet"` |
| KPI subValue (Alerts) | `"awaiting approval"` | `"Need review"` |
| Circuit Breaker desc | `"Emergency Kill Switch — halts all Agent B on-chain activity instantly."` | `"Pause all Agent B on-chain execution. Transactions queue but are not broadcast until resumed."` |
| Circuit status badge | `"PAUSED"` / `"ACTIVE"` | `"Paused"` / `"Running"` |
| Pause alert body | `"SYSTEM PAUSED: All automated payouts are blocked. Agent B will not broadcast any transactions until you resume operations."` | `"Execution paused. Agent B will not broadcast transactions. Queued items are preserved and can be resumed."` |
| Approval reason | `"TVL > $5M & KOL engagement detected. Exceeds $2 cap — requires manual approval."` | `"TVL exceeds $5M with strong KOL engagement. Amount is above the $2 autonomous limit and requires manual approval."` |
| Empty queue | `"All transactions are within the $2 autonomous limit. Agent B executes directly."` | `"No pending approvals. Transactions under $2 execute automatically."` |
| Page desc (Analytics) | `"Interactive visualization of agent performance, TVL trends, gas pricing, and transaction success metrics"` | `"Agent performance, TVL trends, gas pricing, and transaction outcomes."` |
| Page desc (Memory) | `"ChromaDB semantic cache — indexed embeddings, similarity scores, and Agent A project memory"` | `"Semantic memory cache. Indexed embeddings, similarity scores, and recognized project patterns."` |
| Page desc (History) | `"Complete paginated log of all agent transactions — approvals, rejections, and raw cryptographic payloads"` | `"Full transaction log — approvals, rejections, and signed payloads."` |
| Page desc (Settings) | `"Tune Agent A scoring parameters, Agent B execution limits, and RPC configuration"` | `"Configure Agent A scoring, Agent B execution limits, and RPC endpoints."` |
| Toast: Approved body | `"sent to Agent B"` | `"Forwarded to Agent B for execution"` |
| Bell aria | `"X pending approvals"` | `"X items need review — open notifications"` |
| Comm panel empty | `"Waiting for agents..."` | `"Connecting to agents"` |
| Comm panel empty sub | `"Agent A (Scout) and Agent B (Vault) will appear here"` | `"Scout and Vault messages will appear here"` |
| Dashboard hero desc | `"Real-time overview of all autonomous agent activity on Base Network"` | `"Live activity of both autonomous agents on Base Network."` |

### 4.3 Status label convention (global, consistent)
- **Agent status:** `Running` · `Scanning` · `Analyzing` · `Executing` · `Paused` · `Offline` (title case, not ALL CAPS)
- **Transaction status:** `Confirmed` · `Failed` · `Pending` (display labels; underlying data values unchanged)
- **Log level badge:** `SYS` · `WARN` · `OK` · `ERR` · `SCOUT` · `VAULT` (SCOUT/VAULT menggantikan SCT/VLT)

### 4.4 Microcopy baru (untuk fitur §5)
- Data freshness: `"Last sync: 2s ago"`
- Onboarding step 1: `"This is Mission Control — your live view of both autonomous agents."`
- Destructive confirm: `"This will pause all on-chain activity. Are you sure?"`
- Keyboard help title: `"Keyboard Shortcuts"`

---

## 5. New Features (10)

### 5.1 Halaman Agents (`/agents`) — NEW
Panel terpadu untuk kedua agent (saat ini status tersebar di sidebar/navbar).
- Hero per agent: avatar, nama (Scout/Vault), role, status badge besar, uptime %, last active.
- Health metrics: latency (ms), inference time, success/fail count, queue depth.
- Mini charts: latency sparkline, throughput bar (7-day).
- Action buttons: Pause/Resume per-agent, View logs, View config (link ke Settings).
- Live activity feed ringkas per agent.
- Nav item baru di Sidebar, icon `Bot`, label "Agents".

### 5.2 Notifications Panel (Bell) — NEW
Bell icon Navbar saat ini tidak berfungsi.
- Dropdown panel (elevation-3, glassmorphism) on click.
- Gabungan: approval alerts (priority), tx failures, agent state changes, threshold breaches.
- Tiap item: icon + judul + waktu relatif + link action.
- Footer: `"View all in Audit Trail"`.
- "Mark all as read" + badge count live.
- Data source: extend `DashboardContext` dengan `notifications[]`.

### 5.3 Destructive Action Confirmation Modal — NEW
Pause/blacklist/reject nilai tinggi saat ini langsung jalan — berbahaya untuk DeFi.
- Komponen reusable `<ConfirmModal>` dengan variant: `danger`, `warning`, `info`.
- Konten: icon, judul, deskripsi, detail item (project, amount), tombol Cancel + Confirm.
- Wiring: Circuit Breaker pause, Blacklist, Reject approval (saat `amountUsd > $5`), Clear cache.
- Keyboard accessible (Enter=confirm, Escape=cancel, focus trap).

### 5.4 Score Breakdown Radial Gauge — NEW
LLM score sekarang hanya angka.
- Radial gauge (SVG arc) di ApprovalQueue item + halaman Agents: score 0-100 dengan color band.
- Breakdown split bar: Sentiment (purple) vs TVL (teal) — proporsi dari Settings weights.
- Hover/expand: `"Sentiment 70pts · TVL 28pts · Total 98/100"`.
- Reuse pattern sparkline SVG yang sudah ada.

### 5.5 Data Freshness Indicator — NEW
- Global: pill di Navbar `"Live · synced 2s ago"` (update tiap detik).
- Per-panel: timestamp kecil `"Updated Xs ago"` di header card.
- Hijau <10s, amber <60s, red >60s + tombol manual refresh.

### 5.6 System Theme Option — NEW (lihat §3.5)

### 5.7 Keyboard Shortcuts Help (`?`) — NEW
- Overlay dengan daftar semua shortcut saat tekan `?`.
- Kategori: Navigation, Actions, Accessibility.
- Discoverable via Tooltip di CommandCenter.

### 5.8 Onboarding Tour — NEW
- First-visit (deteksi localStorage flag) → tour 4-langkah:
  1. Mission Control overview
  2. Agent status (sidebar)
  3. Approval Queue (cara approve/reject)
  4. Command palette (`⌘K`)
- Spotlight overlay + tooltip arah + Skip/Done.
- Re-trigger via Settings atau command palette.

### 5.9 Density Toggle — NEW
- Compact / Comfortable / Spacious (ubah `--spacing-scale` via root class `data-density`).
- Persist preference via `usePreferences()`.
- Berguna untuk data-dense view (Audit Trail, Memory) vs reading.

### 5.10 Empty/Loading consistency pass
- Audit semua empty state pakai `EmptyState` komponen yang ada.
- Pastikan skeleton `loading.tsx` match layout final tiap halaman.

---

## 6. Component Polish (global)

### 6.1 KpiCard upgrade
- Tambah mini sparkline (7-titik) di bawah nilai untuk TVL, Success Rate, Total Txs.
- Data freshness badge `"Updated Xs ago"` di pojok kartu.
- Trend arrow + delta persen riil (dihitung dari data), bukan string hardcode.

### 6.2 Navbar enhancement
- Agent status pills jadi kompak & clickable → buka halaman Agents.
- Bell: badge count + hover/click dropdown (panel notifikasi).
- Data freshness indicator global.
- Pada `<sm`: gabungkan `Base Network` + `AMD MI300X` jadi satu pill.

### 6.3 Sidebar polish
- Agent status panel: tambah uptime % & last inference time.
- Saat collapse (72px), tetap tampilkan status dot di setiap nav item.
- Extract Sparkline jadi komponen reusable.

### 6.4 Responsif fixes
- Navbar `<sm`: sembunyikan agent status → pindah ke halaman Agents + bell badge.
- Approval Queue mobile: bottom sheet, bukan panel sempit.
- TransactionList table mobile: horizontal scroll dengan shadow edge indicator.
- Circuit Breaker mobile: stack vertical rapi.

### 6.5 Accessibility hardening
- Focus ring konsisten (`focus-ring` class) di SEMUA interactive.
- `aria-live` untuk KPI value changes.
- Color contrast: pastikan `--color-fg-disabled` pada background gelap AA (4.5:1 minimum).
- ConfirmModal, NotificationsPanel, OnboardingTour: focus trap + return focus.

---

## 7. Architecture & Data Flow

### 7.1 DashboardContext extension (additive only)
```
+ notifications: Notification[]
+ addNotification(type, title, body, link?)
+ markNotificationsRead()
+ unreadCount: number
+ agentHealth: { a: AgentHealth; b: AgentHealth }
+ preferences: { theme, density, onboarded }
+ setPreferences(partial)
+ lastSync: number
```
Semua field **additive** — tidak mengubah signature yang ada. Generator simulasi yang ada di-extend untuk populate `notifications` & `agentHealth` dari event yang sama (tidak duplikasi logika).

### 7.2 Hooks baru (terisolasi, testable)
- `useChartColors()` — baca CSS vars via `getComputedStyle` + `useTheme`, resolve ke objek warna chart. Single source of truth. Fallback pre-mount.
- `useDataFreshness(lastSync)` — hitung `secondsAgo`, expose `{ seconds, label, status: 'fresh'|'stale'|'dead', color }`. Throttled 1s.
- `usePreferences()` — wrapper localStorage + state sync (theme, density, onboarded).
- `useKeyboardShortcut(key, handler, opts)` — generalisasi pattern yang ada di CommandPalette/useKeyboardNav.

### 7.3 Komponen UI baru (`src/components/ui/`)
- `ConfirmModal.tsx` (5.3)
- `RadialGauge.tsx` (5.4)
- `FreshnessPill.tsx` (5.5)
- `SegmentedControl.tsx` (5.6, 5.9)
- `KeyboardHelpOverlay.tsx` (5.7)
- `OnboardingTour.tsx` (5.8)
- `ScoreBreakdown.tsx` (5.4)
- `NotificationsPanel.tsx` (5.2)
- `Sparkline.tsx` (extract dari Sidebar, 5.2/6.1)

### 7.4 Data flow
- Event simulasi tick (sudah ada) → side-effect `addNotification()` saat: tx failed, approval baru, agent state change, threshold breach. Dedupe by type+key dalam window 10s.
- `agentHealth` di-update incremental setiap tick (rolling avg latency, count, uptime).
- Preferences flow: `usePreferences()` → root `<html>` class toggle (`data-density`, `data-theme`) → CSS vars handle sisanya.

### 7.5 CSS additions (globals.css)
- Token baru (§3.3).
- Density: `html[data-density="compact"] { --spacing-scale: 0.85 }` apply pada padding/gap via `calc(var(--spacing-scale) * ...)`.
- Elevation utilities: `.elevation-1/2/3`.
- `prefers-color-scheme` media query untuk auto-theme fallback.

### 7.6 Tidak ada dependency baru
Semua pakai motion + lucide + recharts yang sudah ada.

---

## 8. Testing, Phasing & Rollout

### 8.1 Testing strategy
- **Unit**: hooks pure logic (`useDataFreshness`, `usePreferences` localStorage, score breakdown math).
- **Component**: ConfirmModal focus trap, RadialGauge value→arc, NotificationsPanel empty/populated.
- **Integration**: simulasi tick → notification muncul → bell badge update.
- **Gate minimum**: ESLint pass + `next build` clean per phase.

### 8.2 Phase breakdown (7 phase, sequential, tiap phase independently shippable)
| Phase | Konten | Output |
|---|---|---|
| **P1 — Foundation** | Token warna baru, `useChartColors`, sinkronisasi AnalyticsCharts, `prefers-color-scheme`, density token | Chart & theme auto-sync, base siap |
| **P2 — Copy & Voice** | Rewrite semua copy per §4, seragamkan label status | Bahasa profesional app-wide |
| **P3 — Component Polish** | Depth/elevation system, KpiCard sparkline+freshness, Navbar reorg, Sidebar dot+uptime, responsif fixes, a11y focus-ring pass | Konsistensi visual antar halaman |
| **P4 — New Pages & Panels** | Halaman Agents, NotificationsPanel wiring Bell, ConfirmModal + wiring destructive | Gap fungsional inti tertutup |
| **P5 — Data Viz** | RadialGauge + ScoreBreakdown di ApprovalQueue & Agents, data freshness global+per-panel | Visualisasi skor & sync status |
| **P6 — Power-user Features** | System theme (SegmentedControl), Keyboard help `?`, Density toggle | Kontrol preferensi & discoverability |
| **P7 — Onboarding & Final Pass** | Onboarding tour, empty/loading consistency, a11y audit akhir, polish edge cases | First-run experience + tuntas |

### 8.3 Manual validation checklist (per halaman)
- **Dashboard**: KPI sparkline animate, freshness live, circuit breaker confirm modal, comm panel auto-scroll.
- **Analytics**: chart colors sync theme switch, tooltip readable, legend a11y.
- **Memory**: filter works, blacklist confirm, empty state, mobile cards.
- **History**: pagination, search filter, CSV export, expand detail.
- **Settings**: save/reset, range sliders, sources chips, density effect live.
- **Agents (new)**: health metrics render, per-agent pause, charts.
- **Global**: theme toggle 3-mode, density toggle, keyboard help, onboarding skip/replay, notifications read/unread.

### 8.4 Rollout & risk
- Tiap phase = 1 commit/PR boundary, bisa revert terisolasi.
- Risk tertinggi: P1 (token) & P4 (context mutation) — diuji paling teliti.
- Tidak ada breaking change API/data — semua additive.
- PWA/SW tidak terdampak (tidak sentuh `sw.js`/manifest).

---

## 9. Out of Scope (YAGNI)
- Refactor besar `DashboardContext.tsx` (475 baris) — di-extend saja, tidak dipisah.
- Backend/API integration — tetap simulasi client-side.
- i18n/multi-bahasa — copy profesional English only sesuai permintaan.
- New chart types selain yang ada (radar, heatmap) — reuse area/bar/sparkline.
- Mobile native app / responsive redesign total.
- Dark/light theme palette overhaul radikal — refine only.

---

## 10. Files Touched (estimasi)

**Modified:**
- `src/app/globals.css` — token baru, elevation, density, prefers-color-scheme
- `src/app/layout.tsx` — density class, theme resolve script
- `src/app/page.tsx`, `analytics/page.tsx`, `memory/page.tsx`, `history/page.tsx`, `settings/page.tsx` — copy + minor layout
- `src/components/DashboardContext.tsx` — additive state (notifications, agentHealth, preferences, lastSync)
- `src/components/AnalyticsCharts.tsx` — pakai `useChartColors()`
- `src/components/KpiCard.tsx` — sparkline + freshness + delta
- `src/components/DashboardKpis.tsx` — copy rewrite
- `src/components/Navbar.tsx` — reorg + freshness + notifications
- `src/components/Sidebar.tsx` — status dot, uptime, extract Sparkline, copy
- `src/components/CircuitBreaker.tsx` — copy + ConfirmModal wiring
- `src/components/ApprovalQueue.tsx` — copy + ConfirmModal + RadialGauge
- `src/components/AgentCommPanel.tsx` — copy
- `src/components/LiveLog.tsx` — badge labels
- `src/components/TransactionList.tsx` — status labels + mobile scroll
- `src/components/VectorMemoryExplorer.tsx` — blacklist confirm + empty state
- `src/components/AuditTrail.tsx` — copy + empty state
- `src/components/SettingsPanel.tsx` — copy + density + onboarding replay
- `src/components/PageHeader.tsx` — copy consistency
- `src/components/ui/ThemeToggle.tsx` — SegmentedControl 3-mode
- `src/components/ui/CommandPalette.tsx` — onboarding + help commands
- `src/app/agents/page.tsx` — NEW
- `src/app/agents/loading.tsx` — NEW

**New files:**
- `src/components/ui/ConfirmModal.tsx`
- `src/components/ui/RadialGauge.tsx`
- `src/components/ui/ScoreBreakdown.tsx`
- `src/components/ui/FreshnessPill.tsx`
- `src/components/ui/SegmentedControl.tsx`
- `src/components/ui/KeyboardHelpOverlay.tsx`
- `src/components/ui/OnboardingTour.tsx`
- `src/components/ui/NotificationsPanel.tsx`
- `src/components/ui/Sparkline.tsx`
- `src/hooks/useChartColors.ts`
- `src/hooks/useDataFreshness.ts`
- `src/hooks/usePreferences.ts`
- `src/hooks/useKeyboardShortcut.ts`
