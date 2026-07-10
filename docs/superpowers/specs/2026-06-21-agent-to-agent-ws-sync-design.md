# Agent-to-Agent WebSocket Sync — Design Spec

> **Date:** 2026-06-21
> **Objective:** Synchronization & connection of the frontend dashboard to Agent-to-Agent (A↔B) communication in real time via the backend WebSocket, with a mock fallback when the backend is offline.
> **Scope:** Frontend (`dashboard/`) only. Backend changes are written as a separate spec for the teammate (backend developer) — **not implemented** in this session.

---

## 1. Background & Current Problem

Backend (owned by teammate, already running) provides:
- `POST /api/auth/*` — register/login/me/logout (JWT cookie `a2z-token`) ✅
- REST API `/api/stats`, `/api/status`, `/api/transactions`, `/api/analyze` (protected by `@require_auth` — checks the `a2z-token` cookie **or** the `X-API-Key` header)
- WebSocket `/ws` that closes the connection (code 1008) when not authenticated, and broadcasts the latest transactions (`{"type":"LATEST_TRANSACTIONS","data":[...]}`) every 5 seconds from the `execution_logs` table
- APScheduler: Agent A (5 min) + Agent B (1 min) — currently still a stub (`pass`)

The frontend (`dashboard/`) has two concrete problems found during exploration:

### Bug 1 — Wrong port & missing credentials in `DashboardContext.tsx`
```typescript
// Line 388 & 427 — raw fetch to the WRONG port without credentials:
fetch("http://localhost:8080/api/analyze", { ... })   // 8080 bukan 8000; tanpa credentials
fetch("http://localhost:8080/api/status")             // idem
```
The Starlette backend runs on **8000**, and all endpoints are protected → these requests always return 401 / connection failure. As a result they always fall back to the mock.

### Bug 2 — Panel "Agent Communication" sepenuhnya mock
`AgentCommPanel.tsx` displays an Agent A↔B conversation that is **entirely generated** by `genAgentConversation()` in `DashboardContext.tsx`. There is no connection to the WebSocket `/ws` or any REST API. The UI component is fine, but the data is dummy.

### Tujuan
Connect the panel & dashboard to the real backend via WebSocket. When the backend is offline (dev/demo mode), keep the mock as a fallback so the dashboard stays alive for the hackathon demo.

---

## 2. Design Decisions (from brainstorming)

| Aspek | Keputusan | Alasan |
|---|---|---|
| Focus | Real-time via WebSocket | Requested by user; best fit for "connect A2A" |
| A2A message source | Backend sends agent logs via WS (`AGENT_LOG`) | So the scout↔vault conversation is real, not fabricated by the frontend |
| Backend implementation | **Not** touched; written as a separate spec for the teammate | User: "Frontend first" |
| Offline fallback | Keep the mock (status quo) | Hackathon demo stays alive without backend |
| WS auth | Rely on the httpOnly cookie sent automatically | User's choice; if cross-origin blocks it, fall back to log warning + mock |

Chosen approach: **A — WebSocket Client + Connection Adapter** (from 3 options). Chosen because it is the only one that (a) satisfies the mock-fallback requirement, (b) isolates WS logic in a new file, (c) does not touch the already-working UI.

---

## 3. Arsitektur

```
┌─ Backend (:8000) — NOT CHANGED this session ──────────┐
│  Starlette                                          │
│  ├─ /api/auth/*        (login/register/me/logout)   │
│  ├─ /api/status        (REST: execution_logs)       │
│  ├─ /api/analyze       (REST: trigger pipeline)     │
│  └─ /ws  ←──broadcast setiap 5s───                  │
│        {type:"LATEST_TRANSACTIONS", data:[...]}     │
│        {type:"AGENT_LOG", data:{...}}   ⬅ NEW (spec for teammate) │
└─────────────────────────────────────────────────────┘
                    ▲ WS (credentials automatic)
┌─ Frontend (:3000) ─┴────────────────────────────────┐
│  hooks/useAgentWebSocket.ts   ⬅ NEW               │
│   ↳ lib/ws.ts (WS client + reconnect) ⬅ NEW       │
│        │ exposes {status, transactions, agentLogs}  │
│        ▼                                            │
│  DashboardContext.tsx   (MODIFY)                    │
│   ├─ useAgentWebSocket() → real data when connected │
│   ├─ existing mock generators → fallback offline    │
│   └─ expose: wsStatus, agentMessages, transactions  │
│        ▼                                            │
│  AgentCommPanel.tsx   (NOT CHANGED)               │
│   ↳ reads agentMessages from context (already working)   │
└─────────────────────────────────────────────────────┘
```

**Principle:** WebSocket logic is isolated in 2 new files. `DashboardContext` becomes a "connection adapter" that prioritizes real data when the WS is connected and falls back to mock when offline. All other UI components (`AgentCommPanel`, `TransactionList`, `ApprovalQueue`, KPI, etc.) are **unchanged** → zero regression risk on the working UI.

---

## 4. Component Detail

### 4.1 `dashboard/src/lib/ws.ts` — WS Client (NEW)

Pure module, framework-agnostic, testable without React. A factory function, not a class.

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
- URL is built from `NEXT_PUBLIC_API_URL`: `http://localhost:8000` → `ws://localhost:8000/ws`. Supports `https`→`wss`. If the env is empty, default to `ws://localhost:8000/ws`.
- The browser sends the `a2z-token` httpOnly cookie automatically (no explicit option in the `WebSocket` constructor). If the backend closes the connection with 1008 (unauthorized) or cross-origin blocks the cookie → `onStatusChange("disconnected")`, and the hook falls back to mock.
- **Auto-reconnect with exponential backoff:** 1s, 2s, 4s, 8s, … capped at 30s. Reset to 1s after a successful connection.
- Parsing messages: `JSON.parse` with `try/catch`. Route based on `.type`:
  - `"LATEST_TRANSACTIONS"` → `handlers.onTransactions(data)`
  - `"AGENT_LOG"` → `handlers.onAgentLog(data)`
  - Others → ignored (forward-compatible)
- `close()`: set flag `closed=true`, close the socket, cancel the reconnect timer. Idempotent.
- SSR-safe: if `typeof window === "undefined"`, return a controller no-op (the hook only calls it inside the client `useEffect`, but stays defensive).

### 4.2 `dashboard/src/hooks/useAgentWebSocket.ts` — React Hook (NEW)

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
- Accumulate `agentLogs`: append new entries, cap at 50 (FIFO — drop the oldest).
- `transactions`: **replace** (not append) when a new batch arrives — matches the backend's current behavior of sending the top-5 latest.
- `lastMessageAt`: timestamp of the last message (for stale detection / "live" indicator).
- Neutral hook: **does not** import React Context (reusable, easy to test).

### 4.3 `dashboard/src/components/DashboardContext.tsx` — MODIFY

#### A. Fix bug (critical)

Replace all raw `fetch("http://localhost:8080/...")` calls with `apiFetch` from `@/lib/api` (which is already correct: port via `NEXT_PUBLIC_API_URL`, `credentials:'include'`, auto-redirect on 401).

```typescript
// BEFORE:
const res = await fetch("http://localhost:8080/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ target_address, description, project_name, use_mock: false })
});
// ...
const res = await fetch("http://localhost:8080/api/status");

// AFTER:
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

// inside DashboardProvider:
const ws = useAgentWebSocket();                       // data real
const [usingReal, setUsingReal] = useState(false);

useEffect(() => { setUsingReal(ws.status === "connected"); }, [ws.status]);

// agentMessages:
//   - connected → map ws.agentLogs → AgentMessage[] (sender/content/metadata)
//   - offline   → mock generator (genAgentConversation + simulation, status quo)
useEffect(() => {
  if (!usingReal) return;            // mock runs via existing logic
  const mapped = ws.agentLogs.map(mapLogToAgentMessage);  // kap 50
  setAgentMessages(mapped);
}, [ws.agentLogs, usingReal]);

// transactions:
//   - connected → replace with mapped ws.transactions (real)
//   - offline   → existing polling of /api/status + mock simulation
useEffect(() => {
  if (!usingReal) return;
  setTransactions(ws.transactions.map(mapRawTxToTransaction));
}, [ws.transactions, usingReal]);
```

**Priority rules (simple state machine):**
| `ws.status` | Data agentMessages/transactions | Mock generator & polling mock |
|---|---|---|
| `connected` | **Real** from WS | **Pause** |
| `connecting` | Tahan state terakhir | Tahan |
| `disconnected` | **Mock** (status quo) | **Active** (demo mode) |

**What is NOT changed:** the context signature, all exposed keys (`agentMessages`, `transactions`, `kpiMetrics`, etc.), `AgentCommPanel`, and other components. Expose a new `wsStatus` (optional, for a badge indicator).

**Mapper function (private helper):**
```typescript
function mapLogToAgentMessage(log: AgentLogPayload): AgentMessage {
  return {
    id: genId(),
    sender: log.sender,
    content: log.content,
    timestamp: new Date(),            // backend does not yet send ts; use receive time
    status: "done",
    metadata: log.metadata,
  };
}

function mapRawTxToTransaction(tx: RawTransaction): Transaction {
  return {
    id: tx.tx_hash_id,
    projectName: "On-Chain Target",   // backend execution_logs does not yet store a project name
    targetAddress: tx.project_target_address,
    amountUsd: tx.amount_usd,
    status: tx.status.toLowerCase() === "success" ? "success"
          : tx.status.toLowerCase() === "pending_approval" ? "pending" : "failed",
    txHash: tx.tx_hash_id,
    timestamp: new Date(tx.created_at),
    reason: "Autonomous Execution",
    gasUsedGwei: 42,                  // backend does not yet store gas; placeholder
  };
}
```
(The mapper is intentionally pulled into a separate helper to make unit-testing easy without React.)

### 4.4 `AgentCommPanel.tsx` — NOT CHANGED
Already reads `agentMessages` from `useDashboard()`. When the context sends real data, the panel automatically displays it. Zero change, zero regression.

---

## 5. WS Contract for Backend (Spec for Teammate)

> This document is **not** an implementation. The frontend is ready to receive both message types; if the backend has not yet sent `AGENT_LOG`, the frontend still works via mock (non-breaking).

### Message types the frontend expects from `/ws`

**1. `LATEST_TRANSACTIONS`** — already exists in the backend, **no change needed**:
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

**2. `AGENT_LOG`** — NEW, requested to be added:
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
- `content`: free text that will appear as a chat bubble
- `metadata`: optional; if present, shown as a chip (Project/Score/Amount/Tx)

### What is requested from the teammate (backend developer)
1. When the scheduler `run_agent_a` / `run_agent_b` executes the pipeline (or the `/api/analyze` endpoint is called), **emit a per-step log** (scraping → inference → vault execution) by calling:
   ```python
   await manager.broadcast(json.dumps({"type": "AGENT_LOG", "data": {...}}))
   ```
2. Optional: persistence to a new `agent_logs` table if you want history (the frontend does not need this; real-time broadcast is enough).
3. The frontend **will not error** if `AGENT_LOG` is not yet implemented — unknown message types are ignored and the mock stays active.

### WS auth note
The backend closes the connection with 1008 when there is no `a2z-token` / `X-API-Key` cookie. The frontend relies on the httpOnly cookie being sent automatically (SameSite=Lax). If dev cross-origin blocks the cookie, the frontend falls back to mock + a console warning — it does not crash. If the teammate wants more reliability, an optional `?token=` query-param check can be added in `check_ws_auth` (optional, not required).

---

## 6. Testing

### Unit test — `dashboard/src/lib/__tests__/ws.test.ts` (NEW)
- Mock the global `WebSocket` (vi.stubGlobal).
- `createAgentSocket` calls `onStatusChange("connecting")` then `"connected"` on `onopen`.
- `LATEST_TRANSACTIONS` message → `onTransactions` is called with the data.
- `AGENT_LOG` message → `onAgentLog` is called.
- Unknown message type → no handler is called (does not throw).
- Disconnect → `onStatusChange("disconnected")` → reconnect terjadwal.
- `close()` → no further reconnect; idempotent.
- SSR: `typeof window === undefined` → controller no-op (does not throw).

### Unit test — mapper (in `DashboardContext` or a helper file)
- `mapLogToAgentMessage`: sender/content/metadata are captured correctly, `status` is always `"done"`.
- `mapRawTxToTransaction`: status `"SUCCESS"`→`"success"`, `"PENDING_APPROVAL"`→`"pending"`, others→`"failed"`.

### Regression — existing vitest
- Run `npm run test:e2e` (vitest): all existing tests in `src/lib/__tests__/` and `src/components/__tests__/` **must still pass**. No context signature change may break consumers.

### Manual smoke test (when backend & frontend are running)
1. Log in → receive the `a2z-token` cookie.
2. Open `/dashboard` → `ws.status` connected → `AgentCommPanel` shows real logs (if the backend emits `AGENT_LOG`) or mock (if not yet).
3. Stop the backend → `ws.status` disconnected → mock generator active, dashboard stays alive.
4. Start it again → automatic reconnect, back to real data.

---

## 7. File Inventory

| File | Aksi | Risiko |
|---|---|---|
| `dashboard/src/lib/ws.ts` | **CREATE** | Low (new file, isolated) |
| `dashboard/src/hooks/useAgentWebSocket.ts` | **CREATE** | Low (new file) |
| `dashboard/src/lib/__tests__/ws.test.ts` | **CREATE** | Test unit |
| `dashboard/src/components/DashboardContext.tsx` | **MODIFY** (fix port + WS integration) | Medium (one core file) |
| `docs/superpowers/specs/2026-06-21-agent-log-emit-backend-spec.md` | **CREATE** | Low (handoff doc) |
| `AgentCommPanel.tsx` & all other UI components | **NOT CHANGED** | — |

---

## 8. Out of Scope (YAGNI)
- Implement backend changes (`agent_logs` emit) — hand off to teammate via spec.
- Large refactor of `DashboardContext` into multi-provider — over-engineering for a hackathon.
- Implement wallet connect on the login page — its UI already exists, but it is outside the A2A sync scope.
- Agent pause/resume feature via bidirectional WS — the backend WS is currently read-only (ignores incoming).
- Persisting agent logs on the frontend (localStorage) — not requested.

---

## 9. Success Criteria
1. Port bug `8080→8000` & missing credentials in `DashboardContext.tsx`; `/api/analyze` & `/api/status` use `apiFetch`.
2. `lib/ws.ts` & `hooks/useAgentWebSocket.ts` exist, connect to `/ws` when the backend is online.
3. `AgentCommPanel` displays real data (`LATEST_TRANSACTIONS` / `AGENT_LOG`) when the WS is connected, and mock when disconnected.
4. All existing vitest tests still pass; the new test for `ws.ts` passes.
5. The backend handoff spec (`agent-log-emit-backend-spec.md`) is available for the teammate.
