# Backend Handoff Spec — Emit `AGENT_LOG` via WebSocket

> **Date:** 2026-06-21
> **For:** Backend developer (teammate)
> **Status:** The frontend is ready to receive; implement this backend so the Agent A↔B conversation displays live on the dashboard.
> **Spec induk:** [`2026-06-21-agent-to-agent-ws-sync-design.md`](./2026-06-21-agent-to-agent-ws-sync-design.md) §5

---

## TL;DR

The frontend `AgentCommPanel` is ready to receive a new WebSocket message of type `AGENT_LOG`. Currently the backend `/ws` only broadcasts `LATEST_TRANSACTIONS`. Please add the `AGENT_LOG` broadcast so the Agent A (Scout) ↔ Agent B (Vault) conversation displays **live**, not dummy data.

The frontend **will not error** if this is not yet implemented — unknown message types are ignored and the mock remains active as a fallback.

---

## `AGENT_LOG` Message Contract

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

| Field | Required | Type | Note |
|---|---|---|---|
| `type` | ✅ | `"AGENT_LOG"` | string literal |
| `data.sender` | ✅ | `"agent_a" \| "agent_b" \| "system"` | determines the avatar/bubble in the panel |
| `data.content` | ✅ | `string` | text shown as a chat bubble |
| `data.metadata` | ❌ | `object` | if present, shown as a chip |
| `data.metadata.projectName` | ❌ | `string` | "Project" chip |
| `data.metadata.score` | ❌ | `number` | "Score" chip (e.g. 92) |
| `data.metadata.amountUsd` | ❌ | `number` | "Amount" chip |
| `data.metadata.txHash` | ❌ | `string` | "Tx" chip (monospace, copyable) |

`agent_a` = The Scout (purple, left bubble). `agent_b` = The Vault (cyan, right bubble). `system` = small centered message.

---

## How to Emit (Backend)

Use the existing `ConnectionManager` from `backend/routes/websockets.py`:

```python
import json
import asyncio
from routes.websockets import manager  # import the existing manager

async def emit_agent_log(sender: str, content: str, metadata: dict | None = None):
    payload = {"type": "AGENT_LOG", "data": {"sender": sender, "content": content}}
    if metadata:
        payload["data"]["metadata"] = metadata
    await manager.broadcast(json.dumps(payload))
```

### Call at Pipeline Stages

**Scheduler** (`backend/scheduler/agent_runner.py` — currently a `pass` stub):
- `run_agent_a`: emit at each scrape step → inference (e.g. "Scanning Farcaster...", "Embedding N posts into ChromaDB", "Score Engine: 98/100")
- `run_agent_b`: emit at each execute step (e.g. "Signature verified", "Simulation passed", "Tx included in block #...")

**Endpoint `/api/analyze`** (`backend/routes/api.py`): when called manually, emit the same per-step log (`inference`, `chromadb_dedup`, `blacklist_check`, `executed`/`pending_approval`).

> Note: `manager.broadcast` is `async`. When called from a sync function (APScheduler job), wrap it with `asyncio.run(...)` or schedule it on the event loop.

---

## Optional (not required)

1. **Persistence:** a new `agent_logs` table if you want history on the backend. The frontend does not need this — real-time broadcast is sufficient.
2. **Timestamp:** the frontend currently uses receive time. For accuracy, add `data.ts` (ISO 8601).
3. **WS auth via query param:** if the httpOnly cookie is blocked cross-origin by the browser in dev, add a `?token=` check in `check_ws_auth` (`backend/routes/websockets.py`). The frontend is already prepared to handle 1008 (mock fallback).

---

## Verification

After implementation:
1. Log in on the frontend → receive the `a2z-token` cookie.
2. Open `/dashboard` → WebSocket `/ws` connects (status 101).
3. When the scheduler runs / `/api/analyze` is called → live conversation bubbles appear in the "Agent Communication" panel.

If only `LATEST_TRANSACTIONS` is present (without `AGENT_LOG`), the dashboard still works — only transactions are live, the conversation stays mocked.
