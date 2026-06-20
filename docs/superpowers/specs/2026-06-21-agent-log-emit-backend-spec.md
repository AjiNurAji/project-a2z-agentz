# Backend Handoff Spec — Emit `AGENT_LOG` via WebSocket

> **Tanggal:** 2026-06-21
> **Untuk:** Backend developer (teman)
> **Status:** Frontend sudah siap menerima; implementasi backend ini agar percakapan Agent A↔B tampil real di dashboard.
> **Spec induk:** [`2026-06-21-agent-to-agent-ws-sync-design.md`](./2026-06-21-agent-to-agent-ws-sync-design.md) §5

---

## TL;DR

Frontend `AgentCommPanel` sudah siap menerima pesan WebSocket baru bertipe `AGENT_LOG`. Saat ini backend `/ws` hanya broadcast `LATEST_TRANSACTIONS`. Mohon tambahkan broadcast `AGENT_LOG` agar percakapan Agent A (Scout) ↔ Agent B (Vault) tampil **real**, bukan dummy.

Frontend **tidak akan error** bila ini belum diimplementasi — pesan tipe tak dikenal diabaikan, dan mock tetap aktif sebagai fallback.

---

## Kontrak Pesan `AGENT_LOG`

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

| Field | Wajib | Tipe | Catatan |
|---|---|---|---|
| `type` | ✅ | `"AGENT_LOG"` | string literal |
| `data.sender` | ✅ | `"agent_a" \| "agent_b" \| "system"` | menentukan avatar/bubble di panel |
| `data.content` | ✅ | `string` | teks yang tampil sebagai bubble chat |
| `data.metadata` | ❌ | `object` | bila ada, tampil sebagai chip |
| `data.metadata.projectName` | ❌ | `string` | chip "Project" |
| `data.metadata.score` | ❌ | `number` | chip "Score" (mis. 92) |
| `data.metadata.amountUsd` | ❌ | `number` | chip "Amount" |
| `data.metadata.txHash` | ❌ | `string` | chip "Tx" (kode monospace, bisa copy) |

`agent_a` = The Scout (ungu, bubble kiri). `agent_b` = The Vault (cyan, bubble kanan). `system` = pesan terpusat kecil.

---

## Cara Emit (Backend)

Pakai `ConnectionManager` yang sudah ada di `backend/routes/websockets.py`:

```python
import json
import asyncio
from routes.websockets import manager  # import manager yang sudah ada

async def emit_agent_log(sender: str, content: str, metadata: dict | None = None):
    payload = {"type": "AGENT_LOG", "data": {"sender": sender, "content": content}}
    if metadata:
        payload["data"]["metadata"] = metadata
    await manager.broadcast(json.dumps(payload))
```

### Panggil di titik-titik pipeline

**Scheduler** (`backend/scheduler/agent_runner.py` — saat ini stub `pass`):
- `run_agent_a`: emit tiap langkah scrape → inference (mis. "Scanning Farcaster...", "Embedding N posts into ChromaDB", "Score Engine: 98/100")
- `run_agent_b`: emit tiap langkah execute (mis. "Signature verified", "Simulation passed", "Tx included in block #...")

**Endpoint `/api/analyze`** (`backend/routes/api.py`): bila dipanggil manual, emit log per-langkah yang sama (`inference`, `chromadb_dedup`, `blacklist_check`, `executed`/`pending_approval`).

> Catatan: `manager.broadcast` adalah `async`. Bila dipanggil dari fungsi sync (APScheduler job), bungkus dengan `asyncio.run(...)` atau jadwalkan ke event loop.

---

## Opsional (tidak wajib)

1. **Persistensi:** tabel `agent_logs` baru bila ingin history di backend. Frontend tidak butuh ini — cukup broadcast real-time.
2. **Timestamp:** frontend saat ini pakai waktu-terima. Bila ingin akurat, tambahkan `data.ts` (ISO 8601).
3. **Auth WS via query param:** bila cookie httpOnly cross-origin diblokir browser di dev, tambahkan cek `?token=` di `check_ws_auth` (`backend/routes/websockets.py`). Frontend sudah siap menangani 1008 (fallback mock).

---

## Verifikasi

Setelah implementasi:
1. Login di frontend → dapat cookie `a2z-token`.
2. Buka `/dashboard` → WebSocket `/ws` connect (status 101).
3. Saat scheduler jalan / `/api/analyze` dipanggil → bubble percakapan real muncul di panel "Agent Communication".

Bila hanya `LATEST_TRANSACTIONS` yang ada (tanpa `AGENT_LOG`), dashboard tetap jalan — hanya transaksi yang real, percakapan tetap mock.
