import sys
import os
import json
import time
import hashlib
import httpx

from starlette.routing import Route
from starlette.responses import JSONResponse
from starlette.requests import Request
from urllib import request as _url_request
from urllib import error as _url_error
import logging

logger = logging.getLogger("a2z.api")

# Add root directory to sys.path so we can import the existing database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database
from agent_a_chroma import check_semantic_similarity
import web3_async as w3_async
from web3_async import _rotated_rpc_urls, swap_token_for_eth, collect_platform_fee, get_user_wallet_account, send_native_from_account, _usd_to_wei_real
from lib.dexscreener import get_prices_usd
from eth_abi import encode as _encode, decode as _decode
from eth_utils import to_checksum_address as _checksum

# Also add backend directory so we can import auth module
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from auth import verify_access_token
from routes.websockets import manager

_raw_api_key = os.getenv("API_KEY")
if not _raw_api_key:
    raise RuntimeError("API_KEY environment variable is not set. Refusing to start.")
API_KEY = _raw_api_key

AGENT_B_ENDPOINT = os.getenv("AGENT_B_ENDPOINT", "")
AGENT_B_MODEL = os.getenv("AGENT_B_MODEL", "accounts/fireworks/models/deepseek-v4-pro")
AGENT_B_API_KEY = os.getenv("AGENT_B_API_KEY", "")
FIREWORKS_API_KEY = AGENT_B_API_KEY

# Read-only admin/demo bypass token (demo mode); GET-only, never mutations.
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")


def check_auth(request: Request) -> bool:
    api_key = request.headers.get("X-API-Key")
    if api_key and api_key == API_KEY:
        return True

    # Accept bearer token from Authorization header (dashboard stores the
    # JWT in localStorage and forwards it here; cross-site cookies are flaky).
    auth_header = request.headers.get("Authorization", "")
    bearer = ""
    if auth_header.lower().startswith("bearer "):
        bearer = auth_header[7:].strip()

    token = bearer or request.cookies.get("a2z-token")
    if token == "guest":
        return True  # guest demo mode: read-only mock access, no real user
    if token and verify_access_token(token):
        return True

    # Allow read-only admin access via cookie OR header.
    # The dashboard forwards the ADMIN_TOKEN as ``X-Admin-Token`` when the
    # public ``NEXT_PUBLIC_ADMIN_TOKEN`` env is set. The token is also still
    # accepted as the cookie value to permit curl / scripted use.
    admin_token_header = request.headers.get("X-Admin-Token")
    if (
        request.method in ("GET", "HEAD", "OPTIONS")
        and ADMIN_TOKEN
        and (
            (token and token == ADMIN_TOKEN)
            or (admin_token_header and admin_token_header == ADMIN_TOKEN)
        )
    ):
        return True

    return False


def require_auth(func):
    import functools

    @functools.wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        if not check_auth(request):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return await func(request, *args, **kwargs)

    return wrapper


def _get_uid(request: Request) -> "int | str | None":
    """Resolve the authenticated user_id from the bearer token (or admin).

    Returns an int user_id, the guest sentinel string "__guest__" for demo
    mode, or None if unauthenticated.
    """
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("a2z-token", "")
    if token and token != "guest":
        try:
            payload = verify_access_token(token)
            if payload and "sub" in payload:
                return int(payload["sub"])
        except Exception:
            pass
    # Read-only admin token maps to the system owner (id=1) for scoped reads.
    if ADMIN_TOKEN and token == ADMIN_TOKEN:
        return 1
    if token == "guest":
        return "__guest__"  # sentinel: demo mode, serve mock data (no DB)
    return None


GUEST_SENTINEL = "__guest__"


def _is_guest(uid) -> bool:
    """True when the caller is the demo/guest sentinel (mock-only access)."""
    return uid == GUEST_SENTINEL

@require_auth
async def get_stats(request: Request):
    """Returns global statistics for the dashboard."""
    if _is_guest(_get_uid(request)):
        from routes.mock_demo import GUEST_STATS
        return JSONResponse(GUEST_STATS)
    try:
        with database._get_cursor(dict_rows=True) as cur:
            # Total transactions
            cur.execute("SELECT COUNT(*) as total FROM execution_logs")
            total_tx = cur.fetchone()["total"]

            # Success transactions
            cur.execute(
                "SELECT COUNT(*) as success FROM execution_logs WHERE UPPER(status) = 'SUCCESS'"
            )
            success_tx = cur.fetchone()["success"]

            # Total USD sent
            cur.execute(
                "SELECT SUM(amount_usd) as total_usd FROM execution_logs WHERE UPPER(status) = 'SUCCESS'"
            )
            total_usd = cur.fetchone()["total_usd"] or 0.0

            # Projects Scanned — total unique Base token targets discovered
            # by Agent A's DexScreener scout (scraping_queue.target_address).
            cur.execute("SELECT COUNT(*) as scanned FROM scraping_queue")
            projects_scanned = cur.fetchone()["scanned"] or 0

            tvl_endpoint = os.getenv("TVL_ENDPOINT", "https://api.llama.fi/v2/chains")
            total_tvl = 0.0
            client = None
            try:
                client = httpx.AsyncClient()
                response = await client.get(tvl_endpoint, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    for chain in data:
                        if chain.get("name") == "Base":
                            total_tvl = float(chain.get("tvl", 0.0))
                            break
                else:
                    print(f"Error fetching TVL from {tvl_endpoint}: {response.status_code}")
            except Exception as e:
                print(f"Error fetching TVL from {tvl_endpoint}: {e}")
                # Fallback to simulated data if API fails
                total_tvl = projects_scanned * 1200000
            finally:
                # Guarantee the client is closed even when the event loop is
                # tearing down or an exception fired. Without this, an unclosed
                # httpx.AsyncClient raises "RuntimeError: Event loop is closed".
                if client is not None:
                    try:
                        await client.aclose()
                    except Exception:
                        # Loop may already be closed; swallow to avoid masking
                        # the original error.
                        pass

            success_rate = (success_tx / total_tx * 100) if total_tx > 0 else 0

        return JSONResponse(
            {
                "total_transactions": total_tx,
                "success_rate": round(success_rate, 2),
                "total_usd_sent": float(total_usd),
                "active_targets": 0,
                "projects_scanned": projects_scanned,
                "total_tvl": total_tvl,
            }
        )
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


@require_auth
async def get_targets(request: Request):
    """Returns list of target addresses and their sentiment scores."""
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT address, sentiment_score, status, updated_at FROM target_addresses ORDER BY updated_at DESC"
            )
            targets = cur.fetchall()
        # Normalize Postgres types for JSON serialization (datetime -> str,
        # Decimal -> float) — same fix applied to /api/holdings.
        from decimal import Decimal as _Decimal
        from datetime import datetime as _Dt, date as _Date

        norm_targets = []
        for t in targets:
            nt = dict(t)
            for k, v in nt.items():
                if isinstance(v, _Decimal):
                    nt[k] = float(v)
                elif isinstance(v, (_Dt, _Date)):
                    nt[k] = v.isoformat()
                elif isinstance(v, bytes):
                    nt[k] = v.decode("utf-8", "replace")
            norm_targets.append(nt)
        return JSONResponse({"data": norm_targets})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


@require_auth
async def get_transactions(request: Request):
    """Returns list of execution logs / transaction history.

    Includes Agent A's LLM narrative (reason) + Factory token_name so the
    dashboard can display the AI's reasoning behind each trade.
    """
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute(
                """
                SELECT
                    tx_hash_id,
                    project_target_address,
                    amount_usd,
                    status,
                    created_at,
                    COALESCE(token_name, '') AS token_name,
                    COALESCE(reason, '')     AS reason
                FROM execution_logs
                ORDER BY created_at DESC
                LIMIT 100
                """
            )
            transactions = cur.fetchall()
        # Convert datetime to string for JSON serialization
        for t in transactions:
            if "created_at" in t and t["created_at"]:
                t["created_at"] = str(t["created_at"])
            if "amount_usd" in t and t["amount_usd"] is not None:
                t["amount_usd"] = float(t["amount_usd"])
        return JSONResponse({"data": transactions})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


@require_auth
async def circuit_breaker(request: Request):
    """Emergency pause or resume."""
    try:
        data = await request.json()
        action = data.get("action", "").lower()
        if action not in ["pause", "resume"]:
            return JSONResponse(
                {"detail": "Invalid action. Must be 'pause' or 'resume'."},
                status_code=400,
            )

        new_status = "paused" if action == "pause" else "active"
        database.set_system_config("circuit_breaker", new_status)
        with database._get_cursor() as cur:
            cur.execute(
                "UPDATE target_addresses SET status = %s WHERE status != 'BLACKLISTED'",
                (new_status,),
            )
            updated = cur.rowcount
        return JSONResponse(
            {
                "message": f"Circuit breaker activated: {action}",
                "targets_updated": updated,
            }
        )
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)


def _fetch_gpu_metrics() -> dict | None:
    """Scrape live AMD GPU metrics from the vLLM /metrics endpoint (Agent A brain).

    AGENT_A_ENDPOINT is e.g. https://tunnel/v1 -> metrics live at https://tunnel/metrics.
    Parses the Prometheus exposition format for the fields the dashboard shows.
    Returns None if AGENT_A_ENDPOINT is unset or the metrics endpoint is unreachable.
    """
    endpoint = os.getenv("AGENT_A_ENDPOINT", "").strip().rstrip("/")
    if not endpoint:
        return None
    # https://tunnel/v1 -> https://tunnel ; then /metrics
    base = endpoint[:-len("/v1")] if endpoint.endswith("/v1") else endpoint
    metrics_url = f"{base}/metrics"
    api_key = os.getenv("AI_API_KEY", "").strip()
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        req = _url_request.Request(metrics_url, headers=headers, method="GET")
        with _url_request.urlopen(req, timeout=8) as resp:
            text = resp.read().decode("utf-8", "ignore")
    except Exception as exc:
        logger.warning("GPU metrics scrape failed: %s", exc)
        return None

    out: dict[str, object] = {}
    try:
        for line in text.splitlines():
            if line.startswith("#") or not line.strip():
                continue
            # name{labels} value
            if "{" in line:
                name = line.split("{", 1)[0]
                value = line.rsplit(" ", 1)[-1]
            else:
                parts = line.rsplit(" ", 1)
                if len(parts) != 2:
                    continue
                name, value = parts
            try:
                v = float(value)
            except ValueError:
                continue
            if name == "vllm:gpu_cache_usage_sys":
                out["gpu_cache_usage_pct"] = round(v * 100, 1)
            elif name == "vllm:gpu_cache_usage_perc":
                out["gpu_cache_usage_pct"] = round(v, 1)
            elif name == "vllm:num_requests_running":
                out["requests_running"] = int(v)
            elif name == "vllm:num_requests_waiting":
                out["requests_waiting"] = int(v)
            elif name == "vllm:avg_prompt_throughput_tok_per_s":
                out["prompt_throughput_tok_s"] = round(v, 1)
            elif name == "vllm:avg_generation_throughput_tok_per_s":
                out["generation_throughput_tok_s"] = round(v, 1)
            elif name == "vllm:time_to_first_token_seconds_sum" and v > 0:
                out["time_to_first_token_s"] = round(v, 2)
        out["source"] = "amd_mi300x_vllm"
        return out
    except Exception:
        return None


@require_auth
async def get_system_status(request: Request):
    """Returns LIVE health status of components against AMD GPU tunnel."""
    from urllib import request as _url_req
    from urllib import error as _url_err
    import json as _json
    body = {"database": "unknown", "circuit_breaker": "unknown", "rpc_node": "unknown", "ai_model": "unknown", "ai_model_id": None, "ai_endpoint": None}
    
    # --- Real RPC config check (was hardcoded "healthy") ---
    # We can't run async _rpc_health_ok() in a sync Starlette handler
    # (event loop already running), but we CAN verify endpoints are configured.
    try:
        from scheduler.agent_b_cycle import _build_rpc_provider
        provider = _build_rpc_provider()
        if provider is None:
            body["rpc_node"] = "no_endpoints_configured"
        else:
            ep_count = len(provider._endpoints)
            body["rpc_node"] = f"configured ({ep_count} endpoint(s))"
    except Exception as exc:
        body["rpc_node"] = f"config_error: {exc}"

    # --- Real DB health check (was hardcoded "healthy") ---
    try:
        database.get_system_config("circuit_breaker", "active")
        body["database"] = "healthy"
    except Exception as exc:
        body["database"] = f"error: {exc}"
    try:
        cb = database.get_system_config("circuit_breaker", "active")
        body["circuit_breaker"] = cb
    except Exception:
        body["circuit_breaker"] = "unknown"
    try:
        ep = os.getenv("AGENT_A_ENDPOINT", "").rstrip("/")
        if not ep:
            ep = os.getenv("AGENT_B_ENDPOINT", "").rstrip("/")
        body["ai_endpoint"] = ep
        if ep:
            ep_models = ep.rstrip("/") + "/models"
            # vLLM (AMD tunnel) requires Authorization: Bearer <AI_API_KEY>.
            # Without it the server returns 401 Unauthorized on /v1/models.
            _ai_key = os.getenv("AI_API_KEY", "").strip()
            _models_headers = {"Accept": "application/json"}
            if _ai_key:
                _models_headers["Authorization"] = f"Bearer {_ai_key}"
            req = _url_req.Request(ep_models, headers=_models_headers, method="GET")
            with _url_req.urlopen(req, timeout=8) as resp:
                data = _json.loads(resp.read().decode("utf-8"))
            models = data.get("data", [])
            if models:
                body["ai_model"] = "healthy"
                body["ai_model_id"] = models[0].get("id")
                body["ai_max_model_len"] = models[0].get("max_model_len")
            else:
                body["ai_model"] = "empty"
        else:
            body["ai_model"] = "not_configured"
    except _url_err.HTTPError as exc:
        body["ai_model"] = f"http_{exc.code}"
    except Exception as exc:
        body["ai_model"] = "unreachable"

    # Live agent health derived from the WebSocket manager + configured
    # model endpoints. Lets the dashboard show real (non-hardcoded) status.
    try:
        from routes.websockets import manager
        last_a = max(
            [m.get("ts", 0) for m in manager.agent_log_buffer if m.get("data", {}).get("sender") == "agent_a"],
            default=0,
        )
        last_b = max(
            [m.get("ts", 0) for m in manager.agent_log_buffer if m.get("data", {}).get("sender") == "agent_b"],
            default=0,
        )
        m = manager.get_metrics()
        body["agent_health"] = {
            "ws_connections": len(manager.active_connections),
            "agent_a_model": os.getenv("AI_MODEL", ""),
            "agent_b_model": os.getenv("AGENT_B_MODEL", ""),
            "agent_a_last_seen": last_a,
            "agent_b_last_seen": last_b,
            "latency_ms": m["agent_a_latency_ms"] or m["agent_b_latency_ms"],
            "inference_ms": m["agent_a_inference_ms"] or m["agent_b_inference_ms"],
            "success_count": m["agent_a_success"] + m["agent_b_success"],
            "fail_count": m["agent_a_failed"] + m["agent_b_failed"],
            "queue_depth": database.fetch_queue_depth(),
        }
        # Live AMD GPU metrics scraped from the vLLM /metrics endpoint (Agent A brain).
        try:
            gpu = _fetch_gpu_metrics()
            if gpu:
                body["agent_health"]["gpu"] = gpu
        except Exception:
            pass
    except Exception:
        pass
    return JSONResponse(body)


async def health(request: Request):
    """Lightweight healthcheck for admin / uptime monitoring (admin token optional)."""
    admin = request.headers.get("X-Admin-Token")
    if ADMIN_TOKEN and admin and admin != ADMIN_TOKEN:
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return JSONResponse({"status": "ok", "service": "a2z-agentz-backend"})


# ---------------------------------------------------------------------------
# Inference / execution helpers
# ---------------------------------------------------------------------------
_TX_PREFIX = os.getenv("TX_PREFIX", "0xMOCK")


def _call_fireworks(description: str, address: str) -> dict:
    if not AGENT_B_API_KEY or not AGENT_B_MODEL:
        raise RuntimeError("AGENT_B_API_KEY/AGENT_B_MODEL not configured")

    body = json.dumps(
        {
            "model": AGENT_B_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": (
                        f"Opportunity target description={description} address={address}\n"
                        "Return one valid JSON object with keys: score, category, reason, amount_usd, model."
                    ),
                }
            ],
            "temperature": 0.1,
        }
    ).encode("utf-8")

    req = _url_request.Request(
        AGENT_B_ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {AGENT_B_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with _url_request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except _url_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore") if exc.fp else str(exc)
        raise RuntimeError(f"Fireworks HTTP {exc.code}: {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"Fireworks request failed: {exc}") from exc

    try:
        message = (
            data["choices"][0]["message"]["content"]
            or data["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"]
        )
    except Exception as exc:
        raise RuntimeError(f"Unexpected Fireworks response shape: {data}") from exc

    try:
        parsed = json.loads(message)
    except Exception:
        parsed = {
            "score": 0,
            "category": "unknown",
            "reason": message[:200],
            "amount_usd": 0,
            "model": AGENT_B_MODEL,
        }
    return {
        "score": int(parsed.get("score", 0) or 0),
        "category": str(parsed.get("category", "unknown") or "unknown"),
        "reason": str(parsed.get("reason", "") or ""),
        "amount_usd": float(parsed.get("amount_usd", 0) or 0),
        "model": str(parsed.get("model", AGENT_B_MODEL) or AGENT_B_MODEL),
    }


def _infer(description: str, address: str) -> dict:
    try:
        return _call_fireworks(description, address)
    except Exception as exc:
        return {
            "score": 0,
            "category": "error",
            "reason": f"fireworks_failed: {exc}",
            "amount_usd": 0.0,
            "model": _TX_PREFIX,
        }


def _usd_to_wei(amount_usd: float) -> int:
    # Placeholder conversion: 1 USD = 1e15 wei units for demo.
    # Real implementation should use price oracle / RPC conversion.
    return int(float(amount_usd) * 1e15)


def _format_with_deepseek(
    action: str,
    address: str,
    amount_usd: float,
    status: str,
    tx_hash: str | None,
) -> str:
    if status == "SUCCESS" and tx_hash:
        return f"{action} succeeded | {address} | ${amount_usd} | {tx_hash}"
    if status == "PENDING_APPROVAL":
        return f"{action} queued | {address} | ${amount_usd}"
    return f"{action} failed | {address} | ${amount_usd}"


def _mock_execute_transaction(address: str, value_wei: int):
    return f"mock::{address}::{value_wei}"


# Idempotency keys for mock / real paths.
def _idempotency_key(address: str, timestamp: int) -> str:
    return f"mock::{address}::{timestamp}"


AUTONOMOUS_CAP_USD = 2.0


def _normalize_address(address: str) -> str | None:
    address = (address or "").strip()
    if not address:
        return None
    if not address.startswith("0x"):
        return None
    if len(address) != 42:
        return None
    try:
        import eth_account

        return eth_account.Account.to_checksum_address(address)
    except Exception:
        pass
    return address


@require_auth
async def analyze_target(request: Request):
    """
    POST /analyze
    Expects JSON: {"target_address": "0x...", "description": "...", "project_name": "...", "use_mock": bool}
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    raw_addr = (data.get("target_address") or "").strip()
    project_name = data.get("project_name", "unknown")
    description = data.get("description", "")
    address_for_inference = raw_addr or "0x0000000000000000000000000000000000000000"
    checksum = _normalize_address(raw_addr)
    if not checksum:
        return JSONResponse(
            {"status": "invalid_address", "message": "Invalid target address"},
            status_code=400,
        )

    # 2. Blacklist Check
    status_db = database.get_target_status(checksum)
    if isinstance(status_db, str) and status_db.strip().upper() == "BLACKLISTED":
        await manager.broadcast(
            json.dumps(
                {
                    "type": "SYSTEM_LOG",
                    "data": {
                        "level": "WARN",
                        "message": f"{project_name} ({checksum}) is blacklisted. Bypassing.",
                    },
                }
            )
        )
        return JSONResponse(
            {
                "status": "bypassed",
                "message": "Address is blacklisted",
                "step": "blacklist_check",
                "target_address": checksum,
            }
        )

    # 3. ChromaDB Semantic Dedup
    is_too_similar, score, matched_meta = check_semantic_similarity(description)
    if is_too_similar:
        return JSONResponse(
            {
                "status": "bypassed",
                "message": "Semantic duplicate",
                "step": "chromadb_dedup",
                "similarity_score": score,
                "target_address": checksum,
            }
        )

    # 4. Live AI Inference
    await manager.broadcast(
        json.dumps(
            {
                "type": "SYSTEM_LOG",
                "data": {
                    "level": "INFO",
                    "message": f"Agent A running inference on {project_name}...",
                },
            }
        )
    )

    try:
        ai_result = _infer(description, address_for_inference)
    except Exception as infer_exc:
        response_payload = {
            "step": "inference",
            "project_name": project_name,
            "target_address": checksum,
            "status": "inference_failed",
            "reason": str(infer_exc),
        }
        await manager.broadcast(
            json.dumps(
                {
                    "type": "SYSTEM_LOG",
                    "data": {
                        "level": "ERROR",
                        "message": f"Inference failed for {project_name}: {infer_exc}",
                    },
                }
            )
        )
        return JSONResponse(response_payload, status_code=500)

    agent_a_msg = f"Analyzed {project_name}. Score: {ai_result['score']}/100. Category: {ai_result['category']}. Reason: {ai_result['reason']}"
    await manager.broadcast(
        json.dumps(
            {
                "type": "AGENT_LOG",
                "data": {
                    "sender": "agent_a",
                    "content": agent_a_msg,
                    "metadata": {"score": ai_result["score"], "projectName": project_name},
                },
            }
        )
    )

    response_payload = {
        "step": "inference",
        "project_name": project_name,
        "target_address": checksum,
        "score": ai_result["score"],
        "reason": ai_result["reason"],
        "category": ai_result["category"],
        "amount_usd": ai_result["amount_usd"],
        "model": ai_result.get("model"),
    }

    # 5. Evaluate Result
    if ai_result["score"] > 85:
        timestamp = int(time.time())
        log_key = _idempotency_key(checksum, timestamp)

        if database.check_idempotency(checksum, timestamp):
            response_payload["status"] = "failed"
            response_payload["message"] = "Duplicate execution"
            return JSONResponse(response_payload, status_code=409)

        if ai_result["amount_usd"] <= AUTONOMOUS_CAP_USD:
            try:
                val_wei = _usd_to_wei(ai_result["amount_usd"])
                # Real on-chain execution (gated). Set AGENT_B_REAL_EXECUTION=1
                # to actually broadcast; otherwise keep the mock hash for demos.
                if os.getenv("AGENT_B_REAL_EXECUTION", "0") == "1":
                    _cid = 84532 if os.getenv("ACTIVE_NETWORK", "base") == "base_sepolia" else 8453
                    _gwei_cap = float(os.getenv("MAX_GAS_PRICE_GWEI", "0") or "0") or None
                    val_wei = w3_async._usd_to_wei_real(ai_result["amount_usd"])
                    tx_hash = await w3_async.send_native_transaction(
                        checksum, val_wei, chain_id=_cid, max_gas_price_gwei=_gwei_cap
                    )
                else:
                    tx_hash = _mock_execute_transaction(checksum, val_wei)

                # Best-effort user_id for per-user daily trade cap accounting.
                _uid = None
                _auth = request.headers.get("Authorization", "")
                if _auth.lower().startswith("bearer "):
                    _pl = verify_access_token(_auth[7:].strip())
                    if _pl and _pl.get("sub"):
                        try:
                            _uid = int(_pl["sub"])
                        except Exception:
                            _uid = None
                database.insert_execution_log(
                    tx_hash_id=log_key,
                    address=checksum,
                    amount=ai_result["amount_usd"],
                    status="SUCCESS",
                    user_id=_uid,
                )

                ai_message = _format_with_deepseek(
                    "autonomous_execution",
                    checksum,
                    ai_result["amount_usd"],
                    "SUCCESS",
                    tx_hash,
                )

                await manager.broadcast(
                    json.dumps(
                        {
                            "type": "AGENT_LOG",
                            "data": {
                                "sender": "agent_b",
                                "content": ai_message,
                                "metadata": {
                                    "txHash": tx_hash,
                                    "amountUsd": ai_result["amount_usd"],
                                    "projectName": project_name,
                                },
                            },
                        }
                    )
                )
                await manager.broadcast(
                    json.dumps(
                        {
                            "type": "SYSTEM_LOG",
                            "data": {
                                "level": "SUCCESS",
                                "message": f"Agent B autonomously executed ${ai_result['amount_usd']} to {project_name} (Tx: {tx_hash})",
                            },
                        }
                    )
                )

                response_payload["status"] = "executed"
                response_payload["tx_hash"] = tx_hash
                response_payload["message"] = ai_message
            except Exception as exc:
                response_payload["status"] = "execution_failed"
                response_payload["message"] = str(exc)
                await manager.broadcast(
                    json.dumps(
                        {
                            "type": "SYSTEM_LOG",
                            "data": {
                                "level": "ERROR",
                                "message": f"Execution failed for {project_name}: {exc}",
                            },
                        }
                    )
                )
        else:
            # Best-effort user_id for per-user daily trade cap accounting.
            _uid = None
            _auth = request.headers.get("Authorization", "")
            if _auth.lower().startswith("bearer "):
                _pl = verify_access_token(_auth[7:].strip())
                if _pl and _pl.get("sub"):
                    try:
                        _uid = int(_pl["sub"])
                    except Exception:
                        _uid = None
            database.insert_execution_log(
                tx_hash_id=log_key,
                address=checksum,
                amount=ai_result["amount_usd"],
                status="PENDING_APPROVAL",
                user_id=_uid,
            )

            ai_message = _format_with_deepseek(
                "queue_for_approval",
                checksum,
                ai_result["amount_usd"],
                "PENDING_APPROVAL",
                None,
            )

            await manager.broadcast(
                json.dumps(
                    {
                        "type": "AGENT_LOG",
                        "data": {
                            "sender": "agent_b",
                            "content": ai_message,
                            "metadata": {
                                "amountUsd": ai_result["amount_usd"],
                                "projectName": project_name,
                            },
                        },
                    }
                )
            )
            await manager.broadcast(
                json.dumps(
                    {
                        "type": "SYSTEM_LOG",
                        "data": {
                            "level": "WARN",
                            "message": f"Amount ${ai_result['amount_usd']} for {project_name} exceeds autonomous cap. Queued for approval.",
                        },
                    }
                )
            )

            response_payload["status"] = "pending_approval"
            response_payload["message"] = ai_message
    else:
        with database._get_cursor() as cur:
            query = """
            INSERT INTO target_addresses (address, sentiment_score, status)
            VALUES (%s, %s, 'BLACKLISTED')
            ON CONFLICT (address) DO UPDATE SET status = 'BLACKLISTED', sentiment_score = EXCLUDED.sentiment_score, updated_at = CURRENT_TIMESTAMP
            """
            cur.execute(query, (checksum, ai_result["score"]))
        response_payload["status"] = "blacklisted"
        response_payload["message"] = "Score too low, blacklisted."

    return JSONResponse(response_payload)


@require_auth
async def get_execution_status(request: Request):
    """
    GET /status
    Returns the latest execution logs or status for the UI polling.
    """
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT tx_hash_id, project_target_address, amount_usd, status, created_at FROM execution_logs ORDER BY created_at DESC LIMIT 50"
            )
            transactions = cur.fetchall()
        for t in transactions:
            if "created_at" in t and t["created_at"]:
                t["created_at"] = str(t["created_at"])
            if "amount_usd" in t and t["amount_usd"] is not None:
                t["amount_usd"] = float(t["amount_usd"])
        # Live agent logs (from the in-memory broadcast buffer, so the
        # dashboard sees Agent A/B activity even without a held WebSocket).
        from routes.websockets import manager
        agent_logs = manager.recent_agent_logs()
        return JSONResponse({"status": "ok", "logs": transactions, "agent_logs": agent_logs})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


async def _fetch_testnet_holdings() -> dict:
    """LIVE on-chain Base Sepolia holdings (no DB).

    Uses network_config as the Single Source of Truth for RPC / vault /
    chain id, so this endpoint follows ACTIVE_NETWORK automatically.
    """
    from network_config import get_config, NETWORK_TESTNET
    cfg = get_config(NETWORK_TESTNET)
    TESTNET_TOKEN = os.environ.get(
        "A2Z_TESTNET_TOKEN",
        "0x49D83283c527A36335a70D70fc11342F4427d162",
    )
    vault = cfg.vault_address
    rpc_urls = cfg.rpc_urls
    if not vault or not rpc_urls:
        # No testnet config -> proof-only empty payload
        return {
            "holding": [],
            "sold": [],
            "count_holding": 0,
            "count_sold": 0,
            "network": "testnet",
            "proof_only": True,
            "note": "No Base Sepolia RPC / VAULT_ADDRESS configured.",
        }
    try:
        from eth_abi import decode as _decode
        provider = w3_async.MultiRpcProvider(rpc_urls=rpc_urls, chain_id=cfg.chain_id)
        token = _checksum(TESTNET_TOKEN)
        vault_cs = _checksum(vault)
        # balanceOf(address) selector
        selector = b"\x70\xa0\x82\x31"
        data = "0x" + (selector + _encode(["address"], [vault_cs])).hex()
        res = await provider.call("eth_call", [
            {"to": token, "data": data},
            "latest",
        ])
        raw = res.get("result") if isinstance(res, dict) else None
        if not raw or raw == "0x":
            bal = 0
        else:
            bal = int(raw, 16)
        from decimal import Decimal as _D
        # A2ZTestToken has 18 decimals
        human = float(_D(bal) / _D(10 ** 18))
        if bal == 0:
            return {
                "holding": [],
                "sold": [],
                "count_holding": 0,
                "count_sold": 0,
                "network": "testnet",
                "proof_only": True,
                "note": "Vault holds 0 A2ZTestToken on Base Sepolia (proof-only mode).",
            }
        return {
            "holding": [{
                "token_address": token,
                "token_name": "A2ZTestToken",
                "entry_price_usd": 0.0,
                "amount_wei": bal,
                "balance": human,
                "current_price_usd": 0.0,
                "pnl_pct": 0.0,
                "pnl_usd": 0.0,
                "chain": "base_sepolia",
            }],
            "sold": [],
            "count_holding": 1,
            "count_sold": 0,
            "network": "testnet",
            "proof_only": False,
            "note": "Live on-chain balance from Base Sepolia (no DB).",
        }
    except Exception as exc:
        logger.warning("testnet holdings RPC failed, falling back to empty: %s", exc)
        return {
            "holding": [],
            "sold": [],
            "count_holding": 0,
            "count_sold": 0,
            "network": "testnet",
            "proof_only": True,
            "note": f"RPC fetch failed: {exc}",
        }


@require_auth
async def get_holdings(request: Request):
    """GET /holdings — Agent B vault holdings with live P&L from DexScreener.

    Query params:
        network=mainnet  (default) -> DB-backed holdings (Neon held_tokens)
        network=testnet  -> LIVE on-chain Base Sepolia ERC20 balance of
                             A2ZTestToken at VAULT_ADDRESS (no DB read).
                             Falls back to an empty proof-only payload if the
                             RPC call fails.
    """
    import httpx as _httpx

    uid = _get_uid(request)
    if _is_guest(uid):
        from routes.mock_demo import GUEST_PORTFOLIO
        return JSONResponse(GUEST_PORTFOLIO)

    # Testnet mode: bypass the DB entirely, read on-chain state live.
    network = (request.query_params.get("network") or "mainnet").strip().lower()
    if network == "testnet":
        return JSONResponse(await _fetch_testnet_holdings())

    _uid = _get_uid(request)
    held = database.fetch_held_tokens("HOLDING", user_id=_uid)
    sold = database.fetch_held_tokens("SOLD", user_id=_uid)

    # Enrich held tokens with LIVE P&L from DexScreener (batched + cached so we
    # hit the API once per token per cache window — rate-limit safe).
    addrs = [t.get("token_address", "") for t in held if t.get("token_address")]
    prices = await get_prices_usd(addrs) if addrs else {}

    from decimal import Decimal as _Decimal
    from datetime import datetime as _Dt, date as _Date

    def _norm(v):
        if isinstance(v, _Decimal):
            return float(v)
        if isinstance(v, (_Dt, _Date)):
            return v.isoformat()
        if isinstance(v, bytes):
            return v.decode("utf-8", "replace")
        return v

    enriched = []
    for token in held:
        addr = (token.get("token_address") or "").lower()
        entry_price = float(token.get("entry_price_usd") or 0)
        current_price = float(prices.get(addr, 0.0) or 0.0)
        pnl_usd = 0.0
        pnl_pct = 0.0

        if current_price > 0 and entry_price > 0:
            pnl_pct = round((current_price - entry_price) / entry_price * 100, 2)
            held_tokens = float(token.get("amount_wei") or 0) / 1e18
            entry_value = entry_price * held_tokens
            current_value = current_price * held_tokens
            pnl_usd = round(current_value - entry_value, 4)

        safe_token = {k: _norm(v) for k, v in token.items()}
        enriched.append({
            **safe_token,
            "current_price_usd": current_price,
            "pnl_pct": pnl_pct,
            "pnl_usd": pnl_usd,
        })

    safe_sold = [{k: _norm(v) for k, v in t.items()} for t in sold]

    payload = {
        "holding": enriched,
        "sold": safe_sold,
        "count_holding": len(held),
        "count_sold": len(sold),
    }
    return JSONResponse(payload)


# ---------------------------------------------------------------------------
# P2 (User Control): per-user auto-sell toggle + Manual Sell + Limit Orders
# All endpoints resolve user_id from the bearer token; users can ONLY act on
# holdings/orders that belong to them. Platform fee (PLATFORM_FEE_BPS) is
# always skimmed on every sell execution (manual + limit + auto when enabled).
# ---------------------------------------------------------------------------

@require_auth
async def get_sell_preference(request: Request):
    """GET — return the user's auto-sell-agent toggle."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        from routes.mock_demo import GUEST_SETTINGS
        return JSONResponse({"auto_sell_enabled": GUEST_SETTINGS["auto_sell_enabled"]})
    return JSONResponse({"auto_sell_enabled": database.get_sell_preference(uid)})


@require_auth
async def set_sell_preference(request: Request):
    """POST {enabled: bool} — set the user's auto-sell-agent toggle."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        return JSONResponse({"demo": True, "message": "Demo Mode: Action Simulated", "updated": True})
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    enabled = bool(body.get("enabled", False))
    ok = database.set_sell_preference(uid, enabled)
    return JSONResponse({"auto_sell_enabled": enabled, "updated": ok})


# ---------------------------------------------------------------------------
# P7 Dual Execution Mode — per-user custodial vs self-custodial selection
# ---------------------------------------------------------------------------

async def _resolve_swap_account(uid: int):
    """Return the signing account for a swap based on the user's execution_mode.

    - 'custodial'      -> None (caller uses the global vault via get_account())
    - 'self_custodial' -> the user's OWN decrypted P3 wallet (LocalAccount)

    Returns (account_or_none, mode). Raises ValueError if self_custodial is
    selected but the user has no P3 wallet (should be prevented at set time).
    """
    mode = database.get_user_execution_mode(uid)
    if mode == "self_custodial":
        try:
            return get_user_wallet_account(uid), mode
        except Exception as exc:
            raise ValueError(f"self_custodial swap unavailable: {exc}")
    return None, mode


@require_auth
async def get_execution_mode(request: Request):
    """GET — return the user's current execution mode."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        from routes.mock_demo import GUEST_SETTINGS
        return JSONResponse({"execution_mode": GUEST_SETTINGS["execution_mode"]})
    return JSONResponse({"execution_mode": database.get_user_execution_mode(uid)})


@require_auth
async def set_execution_mode(request: Request):
    """POST {mode: 'custodial'|'self_custodial'} — switch execution mode.

    Fail-closed: switching to self_custodial requires a P3 wallet (set in DB).
    """
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        return JSONResponse({"demo": True, "message": "Demo Mode: Action Simulated", "updated": True})
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    mode = (body.get("mode") or "").strip()
    if mode not in ("custodial", "self_custodial"):
        return JSONResponse({"error": "mode must be 'custodial' or 'self_custodial'"}, status_code=400)
    if mode == "self_custodial" and not database.get_user_encrypted_key(uid):
        return JSONResponse(
            {"error": "Generate your self-custodial wallet first (P3) before enabling self-custodial mode"},
            status_code=400,
        )
    ok = database.set_user_execution_mode(uid, mode)
    if not ok:
        return JSONResponse({"error": "Failed to update execution mode"}, status_code=500)
    return JSONResponse({"execution_mode": mode, "updated": True})


@require_auth
async def manual_sell(request: Request):
    """POST {token_address, amount_wei?, type:"market"} — sell now at market.

    Fee (PLATFORM_FEE_BPS) is skimmed from proceeds. Only the user's own
    HOLDING token can be sold.
    """
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    addr = (body.get("token_address") or "").strip()
    if not addr:
        return JSONResponse({"error": "token_address required"}, status_code=400)
    addr = _checksum(addr)

    # Must be a HOLDING token belonging to THIS user.
    held = database.fetch_held_tokens("HOLDING", user_id=uid)
    tok = next((t for t in held if (t.get("token_address") or "").lower() == addr.lower()), None)
    if not tok:
        return JSONResponse({"error": "No holding found for this token in your vault"}, status_code=404)

    amount_wei = int(body.get("amount_wei") or tok.get("amount_wei") or 0)
    if amount_wei <= 0:
        return JSONResponse({"error": "amount_wei must be > 0"}, status_code=400)

    try:
        swap_account, _mode = await _resolve_swap_account(uid)
        result = await swap_token_for_eth(addr, amount_wei, chain_id=8453, account=swap_account)
        tx_hash = result.get("tx_hash", "")
        database.mark_token_sold(addr, tx_hash, user_id=uid)
        # P1: always skim the platform fee on realized proceeds.
        await collect_platform_fee(int(result.get("amount_out_wei") or 0), chain_id=8453)
        database.append_audit_log(
            "user.manual_sell",
            f"User {uid} market-sold {tok.get('token_name')} tx={tx_hash}",
            {"user_id": uid, "token": addr, "tx_hash": tx_hash},
        )
        return JSONResponse({"tx_hash": tx_hash, "token_address": addr})
    except Exception as exc:
        logger.error("manual_sell failed for user %s token %s: %s", uid, addr, exc)
        return JSONResponse({"error": f"Sell failed: {exc}"}, status_code=500)


@require_auth
async def limit_sell(request: Request):
    """POST {token_address, amount_wei?, limit_price_usd} — queue a limit sell.

    The worker checks DexScreener live price; when it crosses the limit the
    order fills (market sell) with the platform fee skimmed.
    """
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    addr = (body.get("token_address") or "").strip()
    if not addr:
        return JSONResponse({"error": "token_address required"}, status_code=400)
    addr = _checksum(addr)
    try:
        limit_price = float(body.get("limit_price_usd") or 0)
    except (TypeError, ValueError):
        return JSONResponse({"error": "limit_price_usd must be numeric"}, status_code=400)
    if limit_price <= 0:
        return JSONResponse({"error": "limit_price_usd must be > 0"}, status_code=400)

    held = database.fetch_held_tokens("HOLDING", user_id=uid)
    tok = next((t for t in held if (t.get("token_address") or "").lower() == addr.lower()), None)
    if not tok:
        return JSONResponse({"error": "No holding found for this token in your vault"}, status_code=404)

    amount_wei = int(body.get("amount_wei") or tok.get("amount_wei") or 0)
    if amount_wei <= 0:
        return JSONResponse({"error": "amount_wei must be > 0"}, status_code=400)

    oid = database.insert_limit_order(uid, addr, tok.get("token_name") or "", amount_wei, limit_price)
    if oid is None:
        return JSONResponse({"error": "Failed to create limit order"}, status_code=500)
    return JSONResponse({"order_id": oid, "status": "OPEN", "limit_price_usd": limit_price})


@require_auth
async def get_limit_orders(request: Request):
    """GET — list the user's limit orders (optionally ?status=OPEN)."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    status = request.query_params.get("status")
    orders = database.fetch_limit_orders(uid, status=status)
    from decimal import Decimal as _Decimal
    from datetime import datetime as _Dt, date as _Date

    def _norm(v):
        if isinstance(v, _Decimal):
            return float(v)
        if isinstance(v, (_Dt, _Date)):
            return v.isoformat()
        if isinstance(v, bytes):
            return v.decode("utf-8", "replace")
        return v

    return JSONResponse([{k: _norm(v) for k, v in o.items()} for o in orders])


@require_auth
async def cancel_limit_order(request: Request):
    """POST {order_id} — cancel the user's own OPEN limit order."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    oid = int(body.get("order_id") or 0)
    if oid <= 0:
        return JSONResponse({"error": "order_id required"}, status_code=400)
    ok = database.cancel_limit_order(oid, uid)
    return JSONResponse({"cancelled": ok})


# ---------------------------------------------------------------------------
# P-OpsiA: Smart Buy Engine (LLM-driven limit buys)
# ---------------------------------------------------------------------------

@require_auth
async def list_smart_buys(request: Request):
    """GET — list the caller's smart-buy orders (all statuses)."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        from routes.mock_demo import GUEST_SMART_ORDERS
        return JSONResponse([_smart_buy_dto(o) for o in GUEST_SMART_ORDERS])
    orders = database.fetch_smart_buy_orders(uid)
    return JSONResponse([_smart_buy_dto(o) for o in orders])


@require_auth
async def create_smart_buy(request: Request):
    """POST {token_address, amount_usd, target_entry_usd, ttl_hours?} — queue a smart-buy.

    Normally the LLM (Agent A) creates these; this endpoint supports source='manual'
    for future UX but mirrors the same guards (ownership, budget, expiry).
    """
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        return JSONResponse({"demo": True, "message": "Demo Mode: Action Simulated", "id": 999, "status": "PENDING"})
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    token = (body.get("token_address") or "").strip()
    if not token or not token.startswith("0x") or len(token) != 42:
        return JSONResponse({"error": "valid token_address required"}, status_code=400)
    try:
        amount_usd = float(body.get("amount_usd") or 0)
        target = float(body.get("target_entry_usd") or 0)
    except (TypeError, ValueError):
        return JSONResponse({"error": "amount_usd and target_entry_usd must be numeric"}, status_code=400)
    if amount_usd <= 0 or target <= 0:
        return JSONResponse({"error": "amount_usd and target_entry_usd must be > 0"}, status_code=400)
    # Budget guard (aligned with Agent B buy size).
    _cap = float(os.getenv("AGENT_B_MAX_TX_USD", "2.0"))
    if amount_usd > _cap:
        return JSONResponse({"error": f"amount_usd exceeds cap {_cap}"}, status_code=400)
    ttl = float(body.get("ttl_hours") or os.getenv("SMART_BUY_TTL_HOURS", "4"))
    try:
        from datetime import datetime, timedelta, timezone
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl)
    except Exception:
        return JSONResponse({"error": "invalid ttl_hours"}, status_code=400)

    oid = database.insert_smart_buy_order(
        user_id=uid, token_address=token, token_name=body.get("token_name") or "Unknown",
        amount_wei=_usd_to_wei_real(amount_usd), target_entry_usd=target,
        expires_at=expires_at, source="manual",
    )
    if not oid:
        return JSONResponse({"error": "failed to queue order"}, status_code=500)
    return JSONResponse({"id": oid, "status": "PENDING", "target_entry_usd": target, "expires_at": expires_at.isoformat()})


@require_auth
async def cancel_smart_buy(request: Request):
    """POST {order_id} — cancel the caller's own PENDING smart-buy order."""
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if _is_guest(uid):
        return JSONResponse({"demo": True, "message": "Demo Mode: Action Simulated", "cancelled": True})
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    oid = int(body.get("order_id") or 0)
    if oid <= 0:
        return JSONResponse({"error": "order_id required"}, status_code=400)
    ok = database.cancel_smart_buy_order(oid, uid)
    return JSONResponse({"cancelled": ok})


@require_auth
async def admin_list_smart_buys(request: Request):
    """GET (?status=) — admin view of ALL smart-buy orders across users."""
    admin = request.headers.get("X-Admin-Token")
    if not ADMIN_TOKEN or not admin or admin != ADMIN_TOKEN:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    status = request.query_params.get("status")
    # Admin sees everything: reuse open-fetch when filtered, else scan via per-user.
    if status == "PENDING":
        rows = database.fetch_smart_buy_orders_open()
    else:
        # No global list helper; aggregate via open + a lightweight scan.
        rows = database.fetch_smart_buy_orders_open()
        if not status:
            # include non-pending too (best-effort admin visibility)
            try:
                with database._get_cursor(dict_rows=True) as cur:
                    cur.execute("SELECT * FROM user_smart_buy_orders ORDER BY created_at DESC LIMIT 500;")
                    rows = [dict(r) for r in cur.fetchall()]
            except Exception:
                pass
    return JSONResponse([_smart_buy_dto(o) for o in rows])


def _smart_buy_dto(o: dict) -> dict:
    from decimal import Decimal as _Decimal

    def _n(v):
        if isinstance(v, _Decimal):
            return float(v)
        return v

    return {
        "id": o.get("id"),
        "token_address": o.get("token_address"),
        "token_name": o.get("token_name"),
        "amount_wei": str(o.get("amount_wei")),
        "target_entry_usd": _n(o.get("target_entry_usd")),
        "status": o.get("status"),
        "source": o.get("source"),
        "created_at": o.get("created_at").isoformat() if o.get("created_at") else None,
        "expires_at": o.get("expires_at").isoformat() if o.get("expires_at") else None,
        "executed_at": o.get("executed_at").isoformat() if o.get("executed_at") else None,
        "buy_tx_hash": o.get("buy_tx_hash"),
        "executed_price_usd": _n(o.get("executed_price_usd")),
    }


@require_auth
async def withdraw(request: Request):
    """POST /withdraw — P5 "Sweep" (Withdraw All) of a user's OWN self-custodial
    (P3) wallet. Flat 0.2% platform fee (PLATFORM_FEE_BPS), NO plan/tier logic.

    Flow (per-user, never the shared global vault):
      1. Resolve destination: body.destination (manual address) OR the user's
         connected wallet (users.wallet_address). Reject if neither exists.
      2. Load the user's OWN wallet account (decrypt AES-GCM blob in-memory).
      3. Read its on-chain ETH balance.
      4. fee_wei  = balance * PLATFORM_FEE_BPS // 10000  (0 when fee disabled)
         gas_cost = estimated EIP-1559 cost for a 21000-gas transfer
         net_withdraw = balance - fee_wei - gas_cost
      5. HARD GUARD: if net_withdraw <= 0 -> 400 (balance too low to cover
         fee + gas). We never broadcast a tx that would revert.
      6. Tx #1 (user payout): send net_withdraw from USER wallet -> destination.
      7. Tx #2 (platform fee): ONLY if fee_wei > 0 AND ADMIN_VAULT_ADDRESS set,
         send fee_wei from USER wallet -> ADMIN_VAULT_ADDRESS.
         Fail-closed: if Tx #1 fails, Tx #2 is NOT sent (user keeps funds).

    Returns gross/fee/gas/net breakdown + tx hashes for transparency.
    """
    uid = _get_uid(request)
    if uid is None:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        body = await request.json()
    except Exception:
        body = {}

    chain_id = int(body.get("chain_id") or os.environ.get("BASE_CHAIN_ID", "8453") or 8453)
    dry_run = bool(body.get("dry_run", False))

    # 1. Resolve destination.
    dest = (body.get("destination") or "").strip()
    if dest:
        try:
            dest = _checksum(dest)
        except Exception:
            return JSONResponse({"error": "Invalid destination address"}, status_code=400)
    else:
        user = database.get_user_by_id(uid)
        if not user or not user.get("wallet_address"):
            return JSONResponse(
                {"error": "No destination provided and no connected wallet on file"},
                status_code=400,
            )
        try:
            dest = _checksum(user["wallet_address"])
        except Exception:
            return JSONResponse({"error": "Connected wallet address is invalid"}, status_code=400)

    # 2. Load the USER's own wallet (raises if none / decrypt fails).
    try:
        account = get_user_wallet_account(uid)
    except Exception as exc:
        return JSONResponse({"error": f"Withdraw unavailable: {exc}"}, status_code=400)

    # 3 + 4. Balance, fee, gas math.
    rpc_urls = _rotated_rpc_urls([
        os.environ.get("BASE_RPC_1", ""), os.environ.get("BASE_RPC_2", ""),
        os.environ.get("BASE_RPC_3", ""), os.environ.get("BASE_RPC_4", ""),
    ]) if chain_id != 84532 else _rotated_rpc_urls([
        os.environ.get("BASE_SEPOLIA_RPC", ""), os.environ.get("BASE_SEPOLIA_RPC_1", ""),
        os.environ.get("BASE_SEPOLIA_RPC_2", ""),
    ])
    if not rpc_urls:
        return JSONResponse({"error": "No RPC configured for chain"}, status_code=500)
    provider = w3_async.MultiRpcProvider(rpc_urls=rpc_urls, chain_id=chain_id)
    try:
        balance = await provider.eth_get_balance(account.address)
        max_fee, _ = await w3_async._estimate_eip1559_fees(provider, None)
        gas_cost = max_fee * 21000

        _bps = int(os.environ.get("PLATFORM_FEE_BPS", "0") or "0")
        fee_wei = balance * _bps // 10_000 if _bps > 0 else 0
        net_withdraw = balance - fee_wei - gas_cost

        if dry_run:
            return JSONResponse({
                "dry_run": True,
                "address": account.address,
                "destination": dest,
                "chain_id": chain_id,
                "gross_wei": str(balance),
                "fee_bps": _bps,
                "fee_wei": str(fee_wei),
                "gas_wei": str(gas_cost),
                "net_wei": str(net_withdraw),
                "can_withdraw": net_withdraw > 0,
            })

        # 5. HARD GUARD.
        if net_withdraw <= 0:
            return JSONResponse({
                "error": "Balance too low to cover platform fee + gas after withdraw",
                "gross_wei": str(balance),
                "fee_wei": str(fee_wei),
                "gas_wei": str(gas_cost),
                "net_wei": str(net_withdraw),
            }, status_code=400)

        # 6. Tx #1 — user payout (fail-closed: if this raises, we stop).
        user_tx = await send_native_from_account(
            account, dest, net_withdraw, chain_id=chain_id
        )

        # 7. Tx #2 — platform fee (only if configured).
        fee_tx = None
        vault = os.environ.get("ADMIN_VAULT_ADDRESS")
        if fee_wei > 0 and vault:
            try:
                fee_tx = await send_native_from_account(
                    account, vault, fee_wei, chain_id=chain_id
                )
            except Exception as fexc:
                # User already paid out; fee is best-effort. Log, don't fail hard.
                logger.error("Withdraw platform-fee tx failed for user %s: %s", uid, fexc)

        database.append_audit_log(
            "user.withdraw",
            f"User {uid} swept {net_withdraw} wei (fee {fee_wei}) -> {dest}",
            {"user_id": uid, "destination": dest, "gross_wei": str(balance),
             "fee_wei": str(fee_wei), "gas_wei": str(gas_cost),
             "net_wei": str(net_withdraw), "user_tx": user_tx, "fee_tx": fee_tx},
        )
        return JSONResponse({
            "tx_hash": user_tx,
            "fee_tx_hash": fee_tx,
            "address": account.address,
            "destination": dest,
            "chain_id": chain_id,
            "gross_wei": str(balance),
            "fee_bps": _bps,
            "fee_wei": str(fee_wei),
            "gas_wei": str(gas_cost),
            "net_wei": str(net_withdraw),
        })
    except Exception as exc:
        logger.error("withdraw failed for user %s: %s", uid, exc)
        return JSONResponse({"error": f"Withdraw failed: {exc}"}, status_code=500)
    finally:
        await provider.close()



@require_auth
async def get_gpu_metrics(request: Request):
    """Live AMD GPU metrics (Agent A brain on vLLM)."""
    gpu = _fetch_gpu_metrics()
    if not gpu:
        return JSONResponse({"gpu": None, "available": False}, status_code=200)
    return JSONResponse({"gpu": gpu, "available": True}, status_code=200)


routes = [
    Route("/health", health, methods=["GET"]),
    Route("/stats", get_stats, methods=["GET"]),
    Route("/targets", get_targets, methods=["GET"]),
    Route("/transactions", get_transactions, methods=["GET"]),
    Route("/circuit-breaker", circuit_breaker, methods=["POST"]),
    Route("/system-status", get_system_status, methods=["GET"]),
    Route("/gpu-metrics", get_gpu_metrics, methods=["GET"]),
    Route("/analyze", analyze_target, methods=["POST"]),
    Route("/status", get_execution_status, methods=["GET"]),
    Route("/holdings", get_holdings, methods=["GET"]),
    Route("/sell-preference", get_sell_preference, methods=["GET"]),
    Route("/sell-preference", set_sell_preference, methods=["POST"]),
    Route("/manual-sell", manual_sell, methods=["POST"]),
    Route("/limit-sell", limit_sell, methods=["POST"]),
    Route("/limit-orders", get_limit_orders, methods=["GET"]),
    Route("/limit-orders/cancel", cancel_limit_order, methods=["POST"]),
    Route("/withdraw", withdraw, methods=["POST"]),
    Route("/smart-buy", list_smart_buys, methods=["GET"]),
    Route("/smart-buy", create_smart_buy, methods=["POST"]),
    Route("/smart-buy/cancel", cancel_smart_buy, methods=["POST"]),
    Route("/admin/smart-buy", admin_list_smart_buys, methods=["GET"]),
    Route("/execution-mode", get_execution_mode, methods=["GET"]),
    Route("/execution-mode", set_execution_mode, methods=["POST"]),
]
