# Agent-to-Agent WebSocket Sync — Design Spec

> **Tanggal:** 2026-06-21
> **Tujuan:** Sinkronisasi & koneksi frontend dashboard ke komunikasi Agent-to-Agent (A↔B) secara real-time via WebSocket backend, dengan fallback mock saat backend offline.
> **Scope:** Frontend (`dashboard/`) saja. Perubahan backend ditulis sebagai spec terpisah untuk teman (backend developer) — **tidak diimplementasikan** di sesi ini.

---

## 1. Latar Belakang & Masalah Saat Ini

Backend (milik teman, sudah berjalan) menyediakan:
- `POST /api/auth/*` — register/login/me/logout (JWT cookie `a2z-token`) ✅
- REST API `/api/stats`, `/api/status`, `/api/transactions`, `/api/analyze` (dilindungi `@require_auth` — cek cookie `a2z-token` **atau** header `X-API-Key`)
- WebSocket `/ws` yang menutup koneksi (code 1008) bila tidak ter-autentikasi, dan broadcast transaksi terbaru (`{"type":"LATEST_TRANSACTIONS","data":[...]}`) setiap 5 detik dari tabel `execution_logs`
- Scheduler APScheduler: Agent A (5 min) + Agent B (1 min) — saat ini masih stub (`pass`)

Frontend (`dashboard/`) punya dua masalah konkret yang ditemukan saat eksplorasi:

### Bug 1 — Port & credentials salah di `DashboardContext.tsx`
```typescript
// Line 388 & 427 — fetch raw ke port SALAH tanpa credentials:
fetch("http://localhost:8080/api/analyze", { ... })   // 8080 bukan 8000; tanpa credentials
fetch("http://localhost:8080/api/status")             // idem
```
Backend Starlette berjalan di **8000**, dan semua endpoint dilindungi → request ini selalu 401/gagal koneksi. Akibatnya selalu jatuh ke mock fallback.

### Bug 2 — Panel "Agent Communication" sepenuhnya mock
`AgentCommPanel.tsx` menampilkan percakapan Agent A↔B yang **seluruhnya di-generate** oleh `genAgentConversation()` di `DashboardContext.tsx`. Tidak ada koneksi ke WebSocket `/ws` atau REST API manapun. Komponen UI-nya bagus, tapi datanya dummy.

### Tujuan
Hubungkan panel & dashboard ke backend real via WebSocket. Saat backend offline (mode dev/demo), pertahankan mock sebagai fallback agar dashboard tetap hidup untuk presentasi hackathon.

---

## 2. Keputusan Desain (dari brainstorming)

| Aspek | Keputusan | Alasan |
|---|---|---|
| Fokus | Real-time via WebSocket | Minta user; paling sesuai "connect A2A" |
| Sumber pesan A2A | Backend kirim log agen via WS (`AGENT_LOG`) | Agar percakapan scout↔vault real, bukan dikarang frontend |
| Implementasi backend | **Tidak** disentuh; ditulis spec terpisah untuk teman | User: "Frontend dulu" |
| Fallback saat offline | Pertahankan mock (status quo) | Demo hackathon tetap hidup tanpa backend |
| Auth WS | Andalkan cookie httpOnly terkirim otomatis | Pilihan user; bila cross-origin block, fallback log warning + mock |

Pendekatan terpilih: **A — WebSocket Client + Connection Adapter** (dari 3 opsi). Dipilih karena satu-satunya yang (a) memenuhi syarat fallback mock, (b) mengisolasi logic WS di file baru, (c) tidak menyentuh UI yang sudah berjalan.

---

## 3. Arsitektur

```
┌─ Backend (:8000) — TIDAK DIUBAH sesi ini ──────────┐
│  Starlette                                          │
│  ├─ /api/auth/*        (login/register/me/logout)   │
│  ├─ /api/status        (REST: execution_logs)       │
│  ├─ /api/analyze       (REST: trigger pipeline)     │
│  └─ /ws  ←──broadcast setiap 5s───                  │
│        {type:"LATEST_TRANSACTIONS", data:[...]}     │
│        {type:"AGENT_LOG", data:{...}}   ⬅ BARU (spec untuk teman) │
└─────────────────────────────────────────────────────┘
                    ▲ WS (credentials otomatis)
┌─ Frontend (:3000) ─┴────────────────────────────────┐
│  hooks/useAgentWebSocket.ts   ⬅ BARU               │
│   ↳ lib/ws.ts (WS client + reconnect) ⬅ BARU       │
│        │ exposes {status, transactions, agentLogs}  │
│        ▼                                            │
│  DashboardContext.tsx   (MODIFY)                    │
│   ├─ useAgentWebSocket() → real data bila connected │
│   ├─ existing mock generators → fallback offline    │
│   └─ expose: wsStatus, agentMessages, transactions  │
│        ▼                                            │
│  AgentCommPanel.tsx   (TIDAK DIUBAH)               │
│   ↳ baca agentMessages dari context (sudah jalan)   │
└─────────────────────────────────────────────────────┘
```

**Prinsip:** Logic WebSocket terisolasi di 2 file baru. `DashboardContext` menjadi "connection adapter" yang memprioritaskan data real bila WS connected dan jatuh ke mock bila offline. Semua komponen UI lain (`AgentCommPanel`, `TransactionList`, `ApprovalQueue`, KPI, dll) **tidak diubah** → zero regression risk pada UI yang sudah jalan.

---

## 4. Komponen Detail

### 4.1 `dashboard/src/lib/ws.ts` — WS Client (BARU)

Modul murni, framework-agnostic, testable tanpa React. Factory function, bukan class.

```typescript
export type WsStatus = "connecting" | "connected" | "disconnected";

export interface RawTransaction {
  tx_hash_id: string;
  project_target_address: string;
  amount_usd: number;
  status: string;          // "SUCCESS" | "PENDING_APPROVAL" | "FAILED" | ...
  created_at: string;      // ISO/datetime string
}

export interface AgentLogPayload {
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  metadata?: {
    txHash?: string;
    score?: number;
    projectName?: string;
    amountUsd?: number;
  };
}

export interface WsMessageHandlers {
  onTransactions?: (txs: RawTransaction[]) => void;
  onAgentLog?: (log: AgentLogPayload) => void;
  onStatusChange?: (status: WsStatus) => void;
}

export interface AgentSocketController {
  close(): void;
}

export function createAgentSocket(handlers: WsMessageHandlers): AgentSocketController
```

**Perilaku:**
- URL dibangun dari `NEXT_PUBLIC_API_URL`: `http://localhost:8000` → `ws://localhost:8000/ws`. Mendukung `https`→`wss`. Bila env kosong, default `ws://localhost:8000/ws`.
- Browser mengirim cookie `a2z-token` httpOnly otomatis (tanpa opsi eksplisit di `WebSocket` constructor). Bila backend menutup koneksi 1008 (unauthorized) atau cross-origin memblokir cookie → `onStatusChange("disconnected")`, hook fallback ke mock.
- **Auto-reconnect exponential backoff:** 1s, 2s, 4s, 8s, … capped 30s. Reset ke 1s setelah connect berhasil.
- Parsing pesan: `JSON.parse` dengan `try/catch`. Route berdasarkan `.type`:
  - `"LATEST_TRANSACTIONS"` → `handlers.onTransactions(data)`
  - `"AGENT_LOG"` → `handlers.onAgentLog(data)`
  - Lainnya → diabaikan (forward-compatible)
- `close()`: set flag `closed=true`, tutup socket, batalkan timer reconnect. Idempoten.
- SSR-safe: bila `typeof window === "undefined"`, return controller no-op (hook hanya memanggil di `useEffect` client, tapi tetap defensif).

### 4.2 `dashboard/src/hooks/useAgentWebSocket.ts` — React Hook (BARU)

```typescript
export interface UseAgentWebSocketResult {
  status: WsStatus;
  transactions: RawTransaction[];
  agentLogs: AgentLogPayload[];
  lastMessageAt: number | null;
}

export function useAgentWebSocket(): UseAgentWebSocketResult
```

**Perilaku:**
- `useEffect` create socket on mount, `close()` on unmount.
- Akumulasi `agentLogs`: append baru, cap 50 entry (FIFO — buang paling lama).
- `transactions`: **replace** (bukan append) saat batch baru datang — sesuai perilaku backend sekarang yang mengirim top-5 terbaru.
- `lastMessageAt`: timestamp pesan terakhir (untuk deteksi stale / indikator "live").
- Hook netral: **tidak** import React Context (bisa dipakai ulang, mudah di-test).

### 4.3 `dashboard/src/components/DashboardContext.tsx` — MODIFY

#### A. Fix bug (critical)

Ganti semua `fetch("http://localhost:8080/...")` raw dengan `apiFetch` dari `@/lib/api` (yang sudah benar: port via `NEXT_PUBLIC_API_URL`, `credentials:'include'`, auto-redirect 401).

```typescript
// SEBELUM:
const res = await fetch("http://localhost:8080/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ target_address, description, project_name, use_mock: false })
});
// ...
const res = await fetch("http://localhost:8080/api/status");

// SESUDAH:
import { apiFetch } from "@/lib/api";
const data = await apiFetch<AnalyzeResp>("/api/analyze", {
  method: "POST",
  body: JSON.stringify({ target_address, description, project_name, use_mock: false })
});
// ...
const data = await apiFetch<StatusResp>("/api/status");
```

#### B. Integrasi real WS + fallback mock

```typescript
import { useAgentWebSocket } from "@/hooks/useAgentWebSocket";

// di dalam DashboardProvider:
const ws = useAgentWebSocket();                       // data real
const [usingReal, setUsingReal] = useState(false);

useEffect(() => { setUsingReal(ws.status === "connected"); }, [ws.status]);

// agentMessages:
//   - connected → map ws.agentLogs → AgentMessage[] (sender/content/metadata)
//   - offline   → mock generator (genAgentConversation + simulasi, status quo)
useEffect(() => {
  if (!usingReal) return;            // mock jalan via logic existing
  const mapped = ws.agentLogs.map(mapLogToAgentMessage);  // kap 50
  setAgentMessages(mapped);
}, [ws.agentLogs, usingReal]);

// transactions:
//   - connected → replace dengan map ws.transactions (real)
//   - offline   → existing polling /api/status + simulasi mock
useEffect(() => {
  if (!usingReal) return;
  setTransactions(ws.transactions.map(mapRawTxToTransaction));
}, [ws.transactions, usingReal]);
```

**Aturan prioritas (state machine sederhana):**
| `ws.status` | Data agentMessages/transactions | Mock generator & polling mock |
|---|---|---|
| `connected` | **Real** dari WS | **Pause** |
| `connecting` | Tahan state terakhir | Tahan |
| `disconnected` | **Mock** (status quo) | **Aktif** (demo mode) |

**Yang TIDAK berubah:** signature context, semua key yang diekspos (`agentMessages`, `transactions`, `kpiMetrics`, dll), `AgentCommPanel`, dan komponen lain. Ekspos `wsStatus` baru (opsional, untuk indikator badge).

**Fungsi mapper (helper privat):**
```typescript
function mapLogToAgentMessage(log: AgentLogPayload): AgentMessage {
  return {
    id: genId(),
    sender: log.sender,
    content: log.content,
    timestamp: new Date(),            // backend belum kirim ts; pakai waktu terima
    status: "done",
    metadata: log.metadata,
  };
}

function mapRawTxToTransaction(tx: RawTransaction): Transaction {
  return {
    id: tx.tx_hash_id,
    projectName: "On-Chain Target",   // backend execution_logs belum punya nama proyek
    targetAddress: tx.project_target_address,
    amountUsd: tx.amount_usd,
    status: tx.status.toLowerCase() === "success" ? "success"
          : tx.status.toLowerCase() === "pending_approval" ? "pending" : "failed",
    txHash: tx.tx_hash_id,
    timestamp: new Date(tx.created_at),
    reason: "Autonomous Execution",
    gasUsedGwei: 42,                  // backend belum simpan gas; placeholder
  };
}
```
(Mapper sengaja ditarik ke helper terpisah agar mudah di-unit-test tanpa React.)

### 4.4 `AgentCommPanel.tsx` — TIDAK DIUBAH
Sudah membaca `agentMessages` dari `useDashboard()`. Bila context kirim real data, panel otomatis tampilkan real. Zero change, zero regression.

---

## 5. Kontrak WS untuk Backend (Spec untuk Teman)

> Dokumen ini **bukan** implementasi. Frontend sudah siap menerima kedua tipe pesan; bila backend belum kirim `AGENT_LOG`, frontend tetap jalan via mock (tidak breaking).

### Tipe pesan yang frontend harapkan dari `/ws`

**1. `LATEST_TRANSACTIONS`** — sudah ada di backend, **tidak perlu ubahan**:
```json
{
  "type": "LATEST_TRANSACTIONS",
  "data": [
    {
      "tx_hash_id": "0xabc...",
      "project_target_address": "0x...",
      "amount_usd": 2.0,
      "status": "SUCCESS",
      "created_at": "2026-06-21T10:00:00"
    }
  ]
}
```

**2. `AGENT_LOG`** — BARU, diminta ditambahkan:
```json
{
  "type": "AGENT_LOG",
  "data": {
    "sender": "agent_a",
    "content": "Scanning Farcaster channel /defi — 342 casts analyzed",
    "metadata": {
      "projectName": "ZeroGravity Protocol",
      "score": 92,
      "amountUsd": 2.0,
      "txHash": "0x..."
    }
  }
}
```
- `sender`: `"agent_a" | "agent_b" | "system"`
- `content`: teks bebas yang akan tampil sebagai bubble chat
- `metadata`: opsional; bila ada tampil sebagai chip (Project/Score/Amount/Tx)

### Yang diminta dari teman (backend developer)
1. Saat scheduler `run_agent_a` / `run_agent_b` mengeksekusi pipeline (atau endpoint `/api/analyze` dipanggil), **emit log per-langkah** (scraping → inference → vault execution) dengan memanggil:
   ```python
   await manager.broadcast(json.dumps({"type": "AGENT_LOG", "data": {...}}))
   ```
2. Opsional: persistensi ke tabel `agent_logs` baru bila ingin history (frontend tidak butuh ini; cukup broadcast real-time).
3. Frontend **tidak akan error** bila `AGENT_LOG` belum diimplementasi — pesan tipe tak dikenal diabaikan, dan mock tetap aktif.

### Catatan auth WS
Backend menutup koneksi 1008 bila tidak ada cookie `a2z-token` / `X-API-Key`. Frontend andalkan cookie httpOnly terkirim otomatis (SameSite=Lax). Bila dev lintas-origin memblokir cookie, frontend fallback ke mock + log warning di console — tidak crash. Bila teman ingin lebih reliable, bisa tambahkan cek query param `?token=` di `check_ws_auth` (opsional, bukan syarat).

---

## 6. Testing

### Unit test — `dashboard/src/lib/__tests__/ws.test.ts` (BARU)
- Mock `WebSocket` global (vi.stubGlobal).
- `createAgentSocket` memanggil `onStatusChange("connecting")` lalu `"connected"` saat `onopen`.
- Pesan `LATEST_TRANSACTIONS` → `onTransactions` dipanggil dengan data.
- Pesan `AGENT_LOG` → `onAgentLog` dipanggil.
- Pesan tipe tak dikenal → tidak ada handler dipanggil (tidak throw).
- Disconnect → `onStatusChange("disconnected")` → reconnect terjadwal.
- `close()` → tidak ada reconnect lanjutan; idempoten.
- SSR: `typeof window === undefined` → controller no-op (tidak throw).

### Unit test — mapper (di `DashboardContext` atau file helper)
- `mapLogToAgentMessage`: sender/content/metadata terpetik benar, `status` selalu `"done"`.
- `mapRawTxToTransaction`: status `"SUCCESS"`→`"success"`, `"PENDING_APPROVAL"`→`"pending"`, lainnya→`"failed"`.

### Regression — existing vitest
- Jalankan `npm run test:e2e` (vitest): semua test existing di `src/lib/__tests__/` dan `src/components/__tests__/` **harus tetap lulus**. Tidak ada perubahan signature context yang boleh membreak konsumer.

### Manual smoke (saat backend & frontend hidup)
1. Login → dapat cookie `a2z-token`.
2. Buka `/dashboard` → `ws.status` connected → `AgentCommPanel` tampilkan log real (jika backend emit `AGENT_LOG`) atau mock (jika belum).
3. Matikan backend → `ws.status` disconnected → mock generator aktif, dashboard tetap hidup.
4. Nyalakan lagi → reconnect otomatis, kembali ke real.

---

## 7. File Inventory

| File | Aksi | Risiko |
|---|---|---|
| `dashboard/src/lib/ws.ts` | **CREATE** | Rendah (file baru, terisolasi) |
| `dashboard/src/hooks/useAgentWebSocket.ts` | **CREATE** | Rendah (file baru) |
| `dashboard/src/lib/__tests__/ws.test.ts` | **CREATE** | Test unit |
| `dashboard/src/components/DashboardContext.tsx` | **MODIFY** (fix port + integrasi WS) | Sedang (satu file inti) |
| `docs/superpowers/specs/2026-06-21-agent-log-emit-backend-spec.md` | **CREATE** | Rendah (dokumen handoff) |
| `AgentCommPanel.tsx` & semua komponen UI lain | **TIDAK DIUBAH** | — |

---

## 8. Out of Scope (YAGNI)
- Implementasi perubahan backend (`agent_logs` emit) — serahkan ke teman via spec.
- Refactor besar `DashboardContext` jadi multi-provider — over-engineering untuk hackathon.
- Implementasi wallet connect di login page — sudah ada UI-nya, di luar scope A2A sync.
- Fitur pause/resume Agent via WS bidirectional — backend WS saat ini read-only (ignore incoming).
- Persistensi log agen di frontend (localStorage) — tidak diminta.

---

## 9. Success Criteria
1. Bug port `8080→8000` & credentials hilang di `DashboardContext.tsx`; `/api/analyze` & `/api/status` memakai `apiFetch`.
2. `lib/ws.ts` & `hooks/useAgentWebSocket.ts` ada, ter-connect ke `/ws` saat backend online.
3. `AgentCommPanel` menampilkan data real (`LATEST_TRANSACTIONS` / `AGENT_LOG`) saat WS connected, dan mock saat disconnected.
4. Semua test vitest existing tetap lulus; test baru untuk `ws.ts` lulus.
5. Spec handoff backend (`agent-log-emit-backend-spec.md`) tersedia untuk teman.
