# Agent-to-Agent WebSocket Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the frontend dashboard to the backend WebSocket `/ws` so the Agent Communication panel and transactions display real Agent A↔Agent B data, with mock fallback when the backend is offline.

**Architecture:** A framework-agnostic WebSocket client (`lib/ws.ts`) with auto-reconnect backoff and message routing is wrapped by a React hook (`hooks/useAgentWebSocket.ts`). The existing `DashboardContext` becomes a connection adapter that prioritizes real WS data when connected and falls back to the existing mock generators when disconnected. `AgentCommPanel` and all other UI components stay unchanged (they already read from context).

**Tech Stack:** TypeScript, Next.js 16, React 19, native `WebSocket`, Vitest + jsdom

**Spec:** `docs/superpowers/specs/2026-06-21-agent-to-agent-ws-sync-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `dashboard/src/lib/ws.ts` | CREATE | WS client: URL build, reconnect backoff, message routing by `.type` |
| `dashboard/src/lib/__tests__/ws.test.ts` | CREATE | Unit tests for ws.ts (mock WebSocket global) |
| `dashboard/src/hooks/useAgentWebSocket.ts` | CREATE | React hook: create socket on mount, accumulate agentLogs (cap 50), replace transactions |
| `dashboard/src/lib/mappers.ts` | CREATE | Pure mapper functions: `mapLogToAgentMessage`, `mapRawTxToTransaction` |
| `dashboard/src/lib/__tests__/mappers.test.ts` | CREATE | Unit tests for mappers |
| `dashboard/src/components/DashboardContext.tsx` | MODIFY | Fix port bug (use `apiFetch`), integrate real WS + mock fallback |
| `AgentCommPanel.tsx` & all UI components | NO CHANGE | Already read from context |

**Decomposition rationale:** `ws.ts` and `mappers.ts` are pure functions with zero React dependency → fast isolated unit tests, easy to reason about. `useAgentWebSocket` is the thin React glue. `DashboardContext` changes are isolated to data sourcing; UI consumers are untouched.

---

## Task 1: WS Client — `lib/ws.ts`

**Files:**
- Create: `dashboard/src/lib/ws.ts`
- Test: `dashboard/src/lib/__tests__/ws.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `dashboard/src/lib/__tests__/ws.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAgentSocket } from "../ws";

// Minimal mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static LAST() { return MockWebSocket.instances[MockWebSocket.instances.length - 1]; }
  static reset() { MockWebSocket.instances = []; }
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  readyState = 0;
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() { this.onclose?.(new CloseEvent("close")); }
  // helpers to simulate server events
  fireOpen() { this.readyState = 1; this.onopen?.(new Event("open")); }
  fireMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
  fireClose(code = 1006) { this.readyState = 3; this.onclose?.(new CloseEvent("close", { code })); }
}

describe("createAgentSocket", () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("builds ws:// URL from NEXT_PUBLIC_API_URL http", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    createAgentSocket({});
    expect(MockWebSocket.LAST().url).toBe("ws://localhost:8000/ws");
  });

  it("builds wss:// URL from https", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    createAgentSocket({});
    expect(MockWebSocket.LAST().url).toBe("wss://api.example.com/ws");
  });

  it("emits connecting then connected on open", () => {
    const statuses: string[] = [];
    createAgentSocket({ onStatusChange: (s) => statuses.push(s) });
    expect(statuses).toContain("connecting");
    MockWebSocket.LAST().fireOpen();
    expect(statuses).toContain("connected");
  });

  it("routes LATEST_TRANSACTIONS to onTransactions", () => {
    const txs = [{ tx_hash_id: "0x1", project_target_address: "0xabc", amount_usd: 2.0, status: "SUCCESS", created_at: "2026-06-21" }];
    const received: unknown[] = [];
    createAgentSocket({ onTransactions: (t) => received.push(t) });
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireMessage({ type: "LATEST_TRANSACTIONS", data: txs });
    expect(received[0]).toEqual(txs);
  });

  it("routes AGENT_LOG to onAgentLog", () => {
    const log = { sender: "agent_a", content: "scanning", metadata: { score: 90 } };
    const received: unknown[] = [];
    createAgentSocket({ onAgentLog: (l) => received.push(l) });
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireMessage({ type: "AGENT_LOG", data: log });
    expect(received[0]).toEqual(log);
  });

  it("ignores unknown message type without throwing", () => {
    const handlers = { onTransactions: vi.fn(), onAgentLog: vi.fn() };
    createAgentSocket(handlers);
    MockWebSocket.LAST().fireOpen();
    expect(() => MockWebSocket.LAST().fireMessage({ type: "UNKNOWN", data: {} })).not.toThrow();
    expect(handlers.onTransactions).not.toHaveBeenCalled();
    expect(handlers.onAgentLog).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON without throwing", () => {
    const handlers = { onTransactions: vi.fn(), onAgentLog: vi.fn() };
    createAgentSocket(handlers);
    MockWebSocket.LAST().fireOpen();
    expect(() => {
      MockWebSocket.LAST().onmessage?.({ data: "not-json{{" } as MessageEvent);
    }).not.toThrow();
    expect(handlers.onTransactions).not.toHaveBeenCalled();
  });

  it("emits disconnected on close", () => {
    const statuses: string[] = [];
    createAgentSocket({ onStatusChange: (s) => statuses.push(s) });
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireClose();
    expect(statuses).toContain("disconnected");
  });

  it("reconnects with exponential backoff after close", () => {
    createAgentSocket({});
    expect(MockWebSocket.instances.length).toBe(1);
    MockWebSocket.LAST().fireOpen();
    MockWebSocket.LAST().fireClose();
    vi.advanceTimersByTime(1000); // first backoff (1s)
    expect(MockWebSocket.instances.length).toBe(2);
  });

  it("close() prevents further reconnection and is idempotent", () => {
    const ctrl = createAgentSocket({});
    MockWebSocket.LAST().fireOpen();
    ctrl.close();
    const countAfterClose = MockWebSocket.instances.length;
    vi.advanceTimersByTime(60000); // well past any backoff
    expect(MockWebSocket.instances.length).toBe(countAfterClose);
    expect(() => ctrl.close()).not.toThrow(); // idempotent
  });

  it("is a no-op when window is undefined (SSR guard)", () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error delete window
    delete globalThis.window;
    expect(() => {
      const ctrl = createAgentSocket({});
      ctrl.close();
    }).not.toThrow();
    globalThis.window = originalWindow;
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/lib/__tests__/ws.test.ts`
Expected: FAIL — `Cannot find module '../ws'`

- [ ] **Step 1.3: Implement `lib/ws.ts`**

Create `dashboard/src/lib/ws.ts`:

```typescript
export type WsStatus = "connecting" | "connected" | "disconnected";

export interface RawTransaction {
  tx_hash_id: string;
  project_target_address: string;
  amount_usd: number;
  status: string;
  created_at: string;
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

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

function buildWsUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsProto = api.startsWith("https") ? "wss" : "ws";
  const host = api.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${wsProto}://${host}/ws`;
}

export function createAgentSocket(handlers: WsMessageHandlers): AgentSocketController {
  // SSR guard — no WebSocket on server
  if (typeof window === "undefined") {
    return { close() {} };
  }

  let closed = false;
  let socket: WebSocket | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (s: WsStatus) => handlers.onStatusChange?.(s);

  const connect = () => {
    if (closed) return;
    setStatus("connecting");
    socket = new WebSocket(buildWsUrl());

    socket.onopen = () => {
      backoff = INITIAL_BACKOFF_MS; // reset on success
      setStatus("connected");
    };

    socket.onmessage = (event: MessageEvent) => {
      let msg: { type?: string; data?: unknown };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return; // ignore malformed
      }
      if (msg.type === "LATEST_TRANSACTIONS") {
        handlers.onTransactions?.(msg.data as RawTransaction[]);
      } else if (msg.type === "AGENT_LOG") {
        handlers.onAgentLog?.(msg.data as AgentLogPayload);
      }
      // unknown types ignored — forward-compatible
    };

    socket.onclose = () => {
      setStatus("disconnected");
      if (closed) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    };

    socket.onerror = () => {
      // errors usually precede close; let onclose handle reconnect
    };
  };

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onclose = null; // prevent reconnect triggered by our own close
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        socket = null;
      }
    },
  };
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/lib/__tests__/ws.test.ts`
Expected: 11 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add dashboard/src/lib/ws.ts dashboard/src/lib/__tests__/ws.test.ts
git commit -m "feat(frontend): add WebSocket client with reconnect and message routing

- lib/ws.ts: createAgentSocket factory, exponential backoff (1s..30s)
- routes LATEST_TRANSACTIONS & AGENT_LOG, ignores unknown/malformed
- SSR-safe (no-op when window undefined)
- 11 unit tests passing (mock WebSocket global)"
```

---

## Task 2: Mappers — `lib/mappers.ts`

**Files:**
- Create: `dashboard/src/lib/mappers.ts`
- Test: `dashboard/src/lib/__tests__/mappers.test.ts`

**Why separate:** pure functions mapping backend WS payloads to the existing `AgentMessage`/`Transaction` context types. No React. Easy to test in isolation, keeps `DashboardContext` edits minimal.

- [ ] **Step 2.1: Write the failing test**

Create `dashboard/src/lib/__tests__/mappers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapLogToAgentMessage, mapRawTxToTransaction } from "../mappers";
import type { AgentLogPayload, RawTransaction } from "../ws";

describe("mapLogToAgentMessage", () => {
  it("maps sender, content, metadata to AgentMessage", () => {
    const log: AgentLogPayload = {
      sender: "agent_a",
      content: "Scanning Farcaster...",
      metadata: { projectName: "ZeroGravity", score: 92, amountUsd: 2.0, txHash: "0xabc" },
    };
    const msg = mapLogToAgentMessage(log);
    expect(msg.sender).toBe("agent_a");
    expect(msg.content).toBe("Scanning Farcaster...");
    expect(msg.status).toBe("done");
    expect(msg.metadata).toEqual({ projectName: "ZeroGravity", score: 92, amountUsd: 2.0, txHash: "0xabc" });
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  it("works without metadata", () => {
    const msg = mapLogToAgentMessage({ sender: "system", content: "init" });
    expect(msg.metadata).toBeUndefined();
    expect(msg.sender).toBe("system");
  });

  it("assigns unique ids", () => {
    const a = mapLogToAgentMessage({ sender: "agent_a", content: "x" });
    const b = mapLogToAgentMessage({ sender: "agent_a", content: "x" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("mapRawTxToTransaction", () => {
  const base: RawTransaction = {
    tx_hash_id: "0xhash1",
    project_target_address: "0xaddr",
    amount_usd: 1.5,
    status: "SUCCESS",
    created_at: "2026-06-21T10:00:00",
  };

  it("maps SUCCESS to success", () => {
    expect(mapRawTxToTransaction({ ...base, status: "SUCCESS" }).status).toBe("success");
  });

  it("maps PENDING_APPROVAL to pending", () => {
    expect(mapRawTxToTransaction({ ...base, status: "PENDING_APPROVAL" }).status).toBe("pending");
  });

  it("maps FAILED to failed", () => {
    expect(mapRawTxToTransaction({ ...base, status: "FAILED" }).status).toBe("failed");
  });

  it("maps unknown status to failed", () => {
    expect(mapRawTxToTransaction({ ...base, status: "WAT" }).status).toBe("failed");
  });

  it("preserves id, address, amount, hash, timestamp", () => {
    const tx = mapRawTxToTransaction(base);
    expect(tx.id).toBe("0xhash1");
    expect(tx.targetAddress).toBe("0xaddr");
    expect(tx.amountUsd).toBe(1.5);
    expect(tx.txHash).toBe("0xhash1");
    expect(tx.timestamp).toEqual(new Date("2026-06-21T10:00:00"));
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/lib/__tests__/mappers.test.ts`
Expected: FAIL — `Cannot find module '../mappers'`

- [ ] **Step 2.3: Implement `lib/mappers.ts`**

Create `dashboard/src/lib/mappers.ts`. Note: `AgentMessage` and `Transaction` types are imported from the context component file. To avoid a React-only import in a pure file, re-declare the minimal structural shape (structurally compatible — TS structural typing). The context types already have these fields.

```typescript
import type { AgentLogPayload, RawTransaction } from "./ws";

// Structural shapes matching DashboardContext's AgentMessage / Transaction
// (re-declared here to keep mappers.ts React-free).
export interface MappedAgentMessage {
  id: string;
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  timestamp: Date;
  status: "sending" | "sent" | "processing" | "done" | "error";
  metadata?: {
    txHash?: string;
    score?: number;
    projectName?: string;
    amountUsd?: number;
  };
}

export interface MappedTransaction {
  id: string;
  projectName: string;
  targetAddress: string;
  amountUsd: number;
  status: "success" | "failed" | "pending";
  txHash: string;
  timestamp: Date;
  reason: string;
  gasUsedGwei: number;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function mapLogToAgentMessage(log: AgentLogPayload): MappedAgentMessage {
  return {
    id: genId(),
    sender: log.sender,
    content: log.content,
    timestamp: new Date(),
    status: "done",
    metadata: log.metadata,
  };
}

export function mapRawTxToTransaction(tx: RawTransaction): MappedTransaction {
  const statusLower = (tx.status || "").toLowerCase();
  const status: MappedTransaction["status"] =
    statusLower === "success" ? "success"
    : statusLower === "pending_approval" ? "pending"
    : "failed";
  return {
    id: tx.tx_hash_id,
    projectName: "On-Chain Target",
    targetAddress: tx.project_target_address,
    amountUsd: tx.amount_usd,
    status,
    txHash: tx.tx_hash_id,
    timestamp: new Date(tx.created_at),
    reason: "Autonomous Execution",
    gasUsedGwei: 42,
  };
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/lib/__tests__/mappers.test.ts`
Expected: 8 tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add dashboard/src/lib/mappers.ts dashboard/src/lib/__tests__/mappers.test.ts
git commit -m "feat(frontend): add pure mappers for WS payloads to context types

- mapLogToAgentMessage: AGENT_LOG payload -> AgentMessage (sender/content/metadata)
- mapRawTxToTransaction: execution_log -> Transaction (status mapping)
- React-free, structurally typed; 8 unit tests passing"
```

---

## Task 3: React Hook — `hooks/useAgentWebSocket.ts`

**Files:**
- Create: `dashboard/src/hooks/useAgentWebSocket.ts`

**Note:** This hook is thin glue over `lib/ws.ts`. Logic is already covered by ws.test.ts; the hook is verified via the integration smoke in Task 5. No separate test file (would only assert React wiring, low ROI).

- [ ] **Step 3.1: Implement the hook**

Create `dashboard/src/hooks/useAgentWebSocket.ts`:

```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import { createAgentSocket, type WsStatus, type RawTransaction, type AgentLogPayload } from "@/lib/ws";

const MAX_LOGS = 50;

export interface UseAgentWebSocketResult {
  status: WsStatus;
  transactions: RawTransaction[];
  agentLogs: AgentLogPayload[];
  lastMessageAt: number | null;
}

export function useAgentWebSocket(): UseAgentWebSocketResult {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogPayload[]>([]);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const ctrlRef = useRef<ReturnType<typeof createAgentSocket> | null>(null);

  useEffect(() => {
    ctrlRef.current = createAgentSocket({
      onStatusChange: setStatus,
      onTransactions: (txs) => {
        setTransactions(txs); // backend sends latest batch -> replace
        setLastMessageAt(Date.now());
      },
      onAgentLog: (log) => {
        setAgentLogs((prev) => [...prev, log].slice(-MAX_LOGS)); // FIFO cap 50
        setLastMessageAt(Date.now());
      },
    });
    return () => {
      ctrlRef.current?.close();
      ctrlRef.current = null;
    };
  }, []);

  return { status, transactions, agentLogs, lastMessageAt };
}
```

- [ ] **Step 3.2: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3.3: Commit**

```bash
git add dashboard/src/hooks/useAgentWebSocket.ts
git commit -m "feat(frontend): add useAgentWebSocket hook

- wraps createAgentSocket; accumulate agentLogs (FIFO cap 50)
- replace transactions on each LATEST_TRANSACTIONS batch
- expose status, transactions, agentLogs, lastMessageAt"
```

---

## Task 4: Integrate WS + fix port bug in `DashboardContext.tsx`

**Files:**
- Modify: `dashboard/src/components/DashboardContext.tsx`

This task does two things: (A) fix the port/credentials bug by routing through `apiFetch`, and (B) wire the real WS data with mock fallback. It is the only file that touches existing behavior.

- [ ] **Step 4.1: Add imports**

At the top of `dashboard/src/components/DashboardContext.tsx`, add these imports alongside the existing ones (after the `react` import line):

```typescript
import { useAgentWebSocket } from "@/hooks/useAgentWebSocket";
import { apiFetch } from "@/lib/api";
import { mapLogToAgentMessage, mapRawTxToTransaction } from "@/lib/mappers";
```

- [ ] **Step 4.2: Add WS hook + real/mock state inside `DashboardProvider`**

Inside the `DashboardProvider` function body, immediately after the existing `useState` declarations block (before `logCountRef`), add:

```typescript
  // ─── Agent WebSocket (real data) ──────────────────────────────
  const ws = useAgentWebSocket();
  const usingReal = ws.status === "connected";
```

- [ ] **Step 4.3: Map real WS data into context state**

Add a `useEffect` that, when connected, overrides `agentMessages` and `transactions` with mapped real data. Place it after the existing `analyzeTarget` useCallback but before the polling `useEffect` (the "Real Backend Polling & Live Simulation" block):

```typescript
  // ─── Real WS data overrides mock when connected ────────────────────────────
  useEffect(() => {
    if (!usingReal) return;
    setAgentMessages(ws.agentLogs.map(mapLogToAgentMessage).slice(-50));
  }, [ws.agentLogs, usingReal]);

  useEffect(() => {
    if (!usingReal) return;
    setTransactions(ws.transactions.map(mapRawTxToTransaction));
  }, [ws.transactions, usingReal]);
```

- [ ] **Step 4.4: Pause mock generator + polling fallback when connected**

Modify the existing polling `useEffect` so it skips when `usingReal`. Change its opening guard from:

```typescript
  useEffect(() => {
    if (isPaused) return;
```

to:

```typescript
  useEffect(() => {
    if (isPaused || usingReal) return;
```

And add `usingReal` to its dependency array, changing:

```typescript
  }, [isPaused, addLog, addNotification]);
```

to:

```typescript
  }, [isPaused, usingReal, addLog, addNotification]);
```

- [ ] **Step 4.5: Fix the port + credentials bug in `analyzeTarget`**

Replace the raw `fetch("http://localhost:8080/api/analyze", ...)` block in `analyzeTarget` (currently lines ~387-396) with `apiFetch`:

Before:
```typescript
    try {
      const res = await fetch("http://localhost:8080/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_address: targetAddress, description, project_name: projectName, use_mock: false })
      });
      
      if (!res.ok) throw new Error("Backend unavailable");
      
      const data = await res.json();
      setAgentAStatus("online");
```

After:
```typescript
    try {
      const data = await apiFetch<{
        status: string;
        score?: number;
        reason?: string;
      }>("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ target_address: targetAddress, description, project_name: projectName, use_mock: false }),
      });
      setAgentAStatus("online");
```

- [ ] **Step 4.6: Fix the port + credentials bug in the polling block**

Replace the raw `fetch("http://localhost:8080/api/status")` inside the polling `useEffect` with `apiFetch`. The current block:

```typescript
      try {
        const res = await fetch("http://localhost:8080/api/status");
        if (res.ok) {
          const data = await res.json();
          if (data && data.logs && data.logs.length > 0) {
```

becomes:

```typescript
      try {
        const data = await apiFetch<{ logs?: Array<{ tx_hash_id: string; project_target_address: string; amount_usd: number; status: string; created_at: string }> }>("/api/status");
        if (data && data.logs && data.logs.length > 0) {
```

And delete the now-redundant `const data = await res.json();` line that previously followed the `if (res.ok) {`. Also update the closing brace of the `if (res.ok)` block: since we removed the `res.ok` check (apiFetch already throws on non-ok), the body that followed runs directly. Verify the indentation/braces compile (Step 4.8 typechecks).

The inline `.map((log: any) => ...)` mapping that follows can stay as-is, OR (preferred) be replaced with the mappers. Minimal change: leave it. The transaction mapping there is the REST-poll fallback (only runs when `!usingReal`), so it's a secondary path.

- [ ] **Step 4.7: Expose wsStatus in context (optional badge)**

This is additive and safe. In the `DashboardContextType` interface, add after `lastSync: number;`:

```typescript
  wsStatus: "connecting" | "connected" | "disconnected";
```

In the `DashboardContext.Provider` `value={{ ... }}` object, add `wsStatus: ws.status,` next to the existing `lastSync` field.

- [ ] **Step 4.8: Typecheck**

Run: `cd dashboard && npx tsc --noEmit`
Expected: no errors. If the braces from Step 4.6 are off, fix the indentation until it compiles.

- [ ] **Step 4.9: Commit**

```bash
git add dashboard/src/components/DashboardContext.tsx
git commit -m "feat(frontend): integrate real WebSocket data with mock fallback

- fix bug: replace fetch('http://localhost:8080/...') raw calls with apiFetch
  (correct port via NEXT_PUBLIC_API_URL, credentials:'include')
- wire useAgentWebSocket: real agentMessages/transactions when connected
- pause mock generator + REST polling when WS connected
- expose wsStatus on context for connection badge"
```

---

## Task 5: Regression verification

**Files:** none (verification only)

- [ ] **Step 5.1: Run full vitest suite**

Run: `cd dashboard && npm run test:e2e`
Expected: ALL tests PASS — including the new `ws.test.ts` (11), `mappers.test.ts` (8), and all pre-existing tests (`api.test.ts`, `auth.test.ts`, `middleware.test.ts`, `AuthProvider.test.tsx`, and any tier/smoke tests). No regressions.

- [ ] **Step 5.2: Fix any regression if a test fails**

If an existing test fails, inspect the failure. Most likely cause: a test that rendered `DashboardProvider` and relied on mock-only behavior. If so, that test is unaffected by code changes (mock still runs when WS disconnected, which is the default in jsdom since `WebSocket` is undefined). Verify by running that specific test file. Do not change production code to satisfy a test that contradicts the spec.

- [ ] **Step 5.3: Manual smoke (document only — requires live backend)**

Document in the commit message body or a follow-up note. Checklist (run when both servers are up):
1. Start backend (`:8000`) + frontend (`:3000`).
2. Register/login → cookie `a2z-token` set.
3. Open `/dashboard` → browser devtools Network → WS connection to `/ws` = 101 Switching.
4. `AgentCommPanel`: if backend emits `AGENT_LOG`, real bubbles appear; if not, mock runs.
5. Stop backend → WS disconnects → mock generator resumes (dashboard stays alive).
6. Restart backend → auto-reconnect → back to real.

- [ ] **Step 5.4: Final commit (docs only, if any manual notes)**

Only if documentation was added; otherwise skip.

---

## Implementation Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | WS client | 2 new | 11 unit |
| 2 | Mappers | 2 new | 8 unit |
| 3 | useAgentWebSocket hook | 1 new | (typecheck) |
| 4 | DashboardContext integration + bug fix | 1 modified | (typecheck) |
| 5 | Regression | 0 | full vitest run |

**Total: 5 new files, 1 modified file, 19 new unit tests + full regression suite**

---

## Self-Review Notes (completed)

- **Spec coverage:** §4.1 ws.ts → Task 1 ✓. §4.2 hook → Task 3 ✓. §4.3 mappers → Task 2 ✓. §4.3 DashboardContext fix+integration → Task 4 ✓. §6 testing → Tasks 1,2,5 ✓. §5 backend handoff spec already written (separate file, not a task here).
- **Placeholder scan:** no TBD/TODO; every code step has complete code.
- **Type consistency:** `AgentLogPayload`/`RawTransaction` defined in ws.ts (Task 1) and imported consistently in mappers (Task 2) and hook (Task 3). `WsStatus` used identically across files. Mapper output types structurally match context types.
- **One caveat flagged:** Step 4.6 involves brace surgery when removing `if (res.ok)`; Step 4.8 typecheck is the gate that catches errors there.
