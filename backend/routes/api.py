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

# Read-only judge bypass token (hackathon judges); GET-only, never mutations.
JUDGE_TOKEN = os.getenv("JUDGE_TOKEN")


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
        return False
    if token and verify_access_token(token):
        return True

    # Allow read-only judge access via cookie OR header.
    # The dashboard forwards the JUDGE_TOKEN as ``X-Judge-Token`` when the
    # public ``NEXT_PUBLIC_JUDGE_TOKEN`` env is set. The token is also still
    # accepted as the cookie value to permit curl / scripted use.
    judge_token_header = request.headers.get("X-Judge-Token")
    if (
        request.method in ("GET", "HEAD", "OPTIONS")
        and JUDGE_TOKEN
        and (
            (token and token == JUDGE_TOKEN)
            or (judge_token_header and judge_token_header == JUDGE_TOKEN)
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


@require_auth
async def get_stats(request: Request):
    """Returns global statistics for the dashboard."""
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
    """Returns list of execution logs / transaction history."""
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT tx_hash_id, project_target_address, amount_usd, status, created_at FROM execution_logs ORDER BY created_at DESC LIMIT 100"
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

    AI_ENDPOINT is e.g. https://tunnel/v1 -> metrics live at https://tunnel/metrics.
    Parses the Prometheus exposition format for the fields the dashboard shows.
    Returns None if AI_ENDPOINT is unset or the metrics endpoint is unreachable.
    """
    endpoint = os.getenv("AI_ENDPOINT", "").strip().rstrip("/")
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
            "agent_a_model": os.getenv("AI_MODEL", "") or os.getenv("AGENT_A_MODEL", ""),
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
    """Lightweight healthcheck for judges / uptime monitoring (judge token optional)."""
    judge = request.headers.get("X-Judge-Token")
    if JUDGE_TOKEN and judge and judge != JUDGE_TOKEN:
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

                database.insert_execution_log(
                    tx_hash_id=log_key,
                    address=checksum,
                    amount=ai_result["amount_usd"],
                    status="SUCCESS",
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
            database.insert_execution_log(
                tx_hash_id=log_key,
                address=checksum,
                amount=ai_result["amount_usd"],
                status="PENDING_APPROVAL",
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


@require_auth
async def get_holdings(request: Request):
    """GET /holdings — Agent B vault holdings with live P&L from DexScreener."""
    import httpx as _httpx
    held = database.fetch_held_tokens("HOLDING")
    sold = database.fetch_held_tokens("SOLD")

    # Enrich held tokens with live market price + P&L
    enriched = []
    for token in held:
        addr = token.get("token_address", "")
        entry_price = float(token.get("entry_price_usd") or 0)
        current_price = 0.0
        pnl_usd = 0.0
        pnl_pct = 0.0

        if addr and entry_price > 0:
            try:
                async with _httpx.AsyncClient(timeout=8) as client:
                    resp = await client.get(
                        f"https://api.dexscreener.com/latest/dex/tokens/{addr}"
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        pairs = (data.get("pairs") or []) if isinstance(data, dict) else []
                        if pairs:
                            current_price = float(pairs[0].get("priceUsd") or 0)
            except Exception:
                pass

        if current_price > 0 and entry_price > 0:
            pnl_pct = round((current_price - entry_price) / entry_price * 100, 2)
            # Approximate P&L: entry was $0.50 worth, scale by price change
            entry_value = 0.50  # micro trade amount
            current_value = entry_value * (current_price / entry_price)
            pnl_usd = round(current_value - entry_value, 4)

        # Normalize Postgres types that are not JSON-serializable by default
        # (Decimal -> float, datetime -> isoformat string, bytes -> utf-8 str).
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

        safe_token = {k: _norm(v) for k, v in token.items()}

        enriched.append({
            **safe_token,
            "current_price_usd": current_price,
            "pnl_pct": pnl_pct,
            "pnl_usd": pnl_usd,
        })

    # Normalize the SOLD list too (same Postgres types).
    safe_sold = [{k: _norm(v) for k, v in t.items()} for t in sold]

    payload = {
        "holding": enriched,
        "sold": safe_sold,
        "count_holding": len(held),
        "count_sold": len(sold),
    }
    # All values are now JSON-native (float/str/int) thanks to _norm above,
    # so Starlette can serialize the dict directly without a custom default.
    return JSONResponse(payload)


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
]
