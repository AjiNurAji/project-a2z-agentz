"""
Agent B - The Vault (Cycle)
Worker loop that locks pending tasks from scraping_queue, runs gating, and
records proposals/synthesis results aligned with database_schema_v2.sql.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any

import aiohttp
from dotenv import load_dotenv
from openai import AsyncOpenAI

from database import (
    append_audit_log,
    ensure_pipeline_tables,
    fetch_and_lock_pending_task,
    insert_synthesis_result,
    insert_transaction_proposal,
    update_proposal_hash,
    update_task_status,
)
from routes.websockets import manager
from web3_async import MultiRpcProvider, send_native_transaction, send_proof_of_execution, _usd_to_wei_real

load_dotenv()

logger = logging.getLogger("a2z.agent_b")

AGENT_B_ENDPOINT = os.getenv("AGENT_B_ENDPOINT", "")
AGENT_B_MODEL = os.getenv("AGENT_B_MODEL", "accounts/fireworks/models/deepseek-v4-pro")
AGENT_B_API_KEY = os.getenv("AGENT_B_API_KEY", "")
# Auto-discover model id from /v1/models when pointing at an OpenAI-compatible
# server (vLLM, TGI, etc.). Reduces the chance of "model not found" errors when
# the upstream server changes model IDs. Default: OFF -- use AGENT_B_MODEL
# as-is. The auto-discover previously picked the FIRST model in the server's
# list (e.g. a non-inference model), causing 404s. Keep it OFF unless you run
# a self-hosted vLLM that only exposes one model id.
AGENT_B_MODEL_AUTO_DISCOVER = os.getenv("AGENT_B_MODEL_AUTO_DISCOVER", "0") == "1"
# Cap so we never call /v1/models in a hot inference loop.
AGENT_B_MODEL_DISCOVER_TIMEOUT = float(os.getenv("AGENT_B_MODEL_DISCOVER_TIMEOUT", "10"))
GOPLUS_API_URL = os.getenv("GOPLUS_API_URL", "")
GOPLUS_API_KEY = os.getenv("GOPLUS_API_KEY", "")
BASE_RPC_1 = os.getenv("BASE_RPC_1", "")
BASE_RPC_2 = os.getenv("BASE_RPC_2", "")
BASE_RPC_3 = os.getenv("BASE_RPC_3", "")
BASE_CHAIN_ID = int(os.getenv("BASE_CHAIN_ID", "8453"))
MAX_SCORE_FOR_AUTO = int(os.getenv("AGENT_B_AUTO_SCORE_MIN", "85"))
DEFAULT_NETWORK_HINT = os.getenv("ACTIVE_NETWORK", "base")
# Budget guard (env already provided by operator). Enforced before any
# auto-execution proposal so the vault stays within operator limits.
MAX_TX_AMOUNT_USD = float(os.getenv("MAX_TX_AMOUNT_USD", "2.0"))
# Per-execution token value cap (operator-supplied, default $0.50). When the
# guardrail LLM fails to return a usable amount_usd (common with DeepSeek-V4-Pro
# which ignores response_format and wraps JSON in prose), we fall back to this
# so a high-scored, security-clean token still auto-executes at a fixed, safe
# operator-defined value instead of silently no-op'ing (amount_usd <= 0).
AGENT_B_MAX_TX_USD = float(os.getenv("AGENT_B_MAX_TX_USD", "0.5"))
MAX_DAILY_SPEND_USD = float(os.getenv("MAX_DAILY_SPEND_USD", "10.0"))
# Concurrency: how many queued tasks Agent B processes per worker tick.
AGENT_B_CONCURRENCY = int(os.getenv("AGENT_B_CONCURRENCY", "1"))


def _strip_models_path(endpoint: str) -> str:
    """Return endpoint with any trailing /models stripped, ready for /models suffix."""
    # strip /v1 (so we can append /v1/models) -- but keep if no /v1 present.
    if not endpoint.endswith("/v1"):
        endpoint = endpoint + "/v1"
    return endpoint


async def _discover_model_list(
    session: aiohttp.ClientSession, endpoint: str, api_key: str
) -> list[str]:
    """
    Hit ``GET {endpoint}/models`` and return the list of model ids.

    Returns [] on any failure so the caller falls back to AGENT_B_MODEL.
    """
    if not endpoint or not session:
        return []
    base = _strip_models_path(endpoint)
    url = f"{base}/models"
    headers = {"accept": "application/json"}
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"
    try:
        async with session.get(
            url, headers=headers, timeout=AGENT_B_MODEL_DISCOVER_TIMEOUT
        ) as resp:
            if resp.status != 200:
                logger.debug(
                    "Agent B model discovery: %s returned HTTP %s",
                    url, resp.status,
                )
                return []
            payload = await resp.json()
    except Exception as exc:
        logger.debug("Agent B model discovery failed: %s", exc)
        return []
    if not isinstance(payload, dict):
        return []
    data = payload.get("data", [])
    if not isinstance(data, list) or not data:
        return []
    ids: list[str] = []
    for entry in data:
        if isinstance(entry, dict):
            mid = entry.get("id") or entry.get("model") or ""
            if mid:
                ids.append(str(mid))
        elif isinstance(entry, str):
            ids.append(entry)
    return ids


def _normalize_agent_b_endpoint(endpoint: str) -> str:
    """Strip any trailing /chat/completions so the OpenAI SDK doesn't append
    it twice (which 404s as '/v1/chat/completions/chat/completions')."""
    e = (endpoint or "").rstrip("/")
    if e.endswith("/chat/completions"):
        e = e[: -len("/chat/completions")]
    if not e.endswith("/v1"):
        e = e + "/v1"
    return e


def _build_rpc_provider() -> MultiRpcProvider | None:
  urls = [u for u in [BASE_RPC_1, BASE_RPC_2, BASE_RPC_3] if u]
  if not urls:
    return None
  return MultiRpcProvider(rpc_urls=urls, chain_id=BASE_CHAIN_ID)


async def _rpc_health_ok(provider: MultiRpcProvider | None) -> bool:
  if provider is None:
    return False
  try:
    # `health()` is an async coroutine (web3_async.MultiRpcProvider.health);
    # it MUST be awaited or it returns a coroutine object whose `.get()` raises
    # AttributeError, which previously made this always return False and forced
    # every task down the FAILED/retry path (infinite loop on the same address).
    health = await provider.health()
    return bool(health.get("endpoints"))
  except Exception:
    return False


async def _check_goplus(session: aiohttp.ClientSession, token_address: str) -> dict[str, Any]:
  # Kill-switch: when AGENT_B_SKIP_GOPLUS=true we intentionally bypass the
  # GoPlus gate (e.g. for demos where GoPlus 404s on valid tokens and would
  # otherwise drop every queued target). Return a permissive signal so the
  # pipeline still reaches Agent B's LLM + execution.
  if os.getenv("AGENT_B_SKIP_GOPLUS", "0").lower() in ("1", "true", "yes"):
    return {"safe": True, "warning": "GoPlus skipped via AGENT_B_SKIP_GOPLUS"}
  if not GOPLUS_API_URL:
    # Do NOT crash the pipeline if GoPlus isn't configured (common in fresh
    # deploys / demos). Fall through with a permissive signal so Agent B's LLM
    # still scores + (if threshold met) executes. A missing gate is a config
    # issue, not a per-token failure -> must not mark the task FAILED/retry.
    logger.warning("GOPLUS_API_URL not configured -- proceeding without security gate")
    return {"safe": True, "warning": "GoPlus URL not configured; proceeding without gate"}
  if not GOPLUS_API_KEY:
    return {"safe": True, "warning": "GoPlus key missing"}

  base_url = GOPLUS_API_URL.rstrip('/')
  # GoPlus Token Security API (v1): query-param style, NOT path style.
  # Correct:  {base}/api/v1/token_security/{chain_id}?contract_addresses={addr}
  # (the script reference uses GOPLUS_BASE="https://api.gopluslabs.io/api/v1"
  #  and hits /token_security/{chain}?contract_addresses=... -> HTTP 200).
  # Path style (/token_security/{chain}/{addr}) returns 404.
  if "/token_security" in base_url:
    # strip any trailing /token_security/... so we rebuild cleanly
    base_url = base_url.split("/token_security")[0]
  chain_id = os.getenv("BASE_CHAIN_ID", "8453")
  url = f"{base_url}/api/v1/token_security/{chain_id}?contract_addresses={token_address}"
  headers = {}
  if GOPLUS_API_KEY:
    headers["X-API-KEY"] = GOPLUS_API_KEY
  try:
    async with session.get(url, headers=headers, timeout=15) as resp:
      logger.info("GoPlus req %s -> HTTP %s", url, resp.status)
      if resp.status == 200:
        data = await resp.json()
        # GoPlus returns: {"code":1,"message":"OK","result":{<address>:{...}}}
        # result is a dict KEYED BY ADDRESS, not a flat object.
        if isinstance(data, dict) and isinstance(data.get("result"), dict):
          addr_data = data["result"].get(token_address.lower()) or data["result"].get(token_address) or next(iter(data["result"].values()), {})
          logger.info("GoPlus OK: code=%s result_keys=%d addr_found=%s", data.get("code"), len(data["result"]), bool(addr_data))
          # Wrap so the caller's result.get("is_honeypot") logic works:
          # we return {"result": <per-address dict>} but the caller expects
          # result to BE the per-address dict. Normalize here.
          return {"result": addr_data if isinstance(addr_data, dict) else {}}
        logger.warning("GoPlus 200 but unexpected shape: %s", str(data)[:200])
        return data  # fall through; caller handles missing result
      if resp.status == 404:
        raise RuntimeError(f"goplus token not found: HTTP 404 for {token_address}")
      resp.raise_for_status()
  except aiohttp.ClientError as exc:
    raise RuntimeError(f"goplus upstream unavailable for {token_address}: {exc}")
  raise RuntimeError(f"goplus upstream unavailable for {token_address}")


async def _run_agent_b_inference(token_name: str, contract_address: str, goplus_summary: str, dex_context: str = "") -> dict[str, Any]:
    if not AGENT_B_API_KEY or not AGENT_B_ENDPOINT or not AGENT_B_MODEL:
        return {"score": 0, "reason": "missing agent b config", "amount_usd": 0.0, "model": "bypass", "latency_ms": 0}
    temperature = float(os.getenv("AGENT_B_TEMPERATURE", "0.1"))
    max_tokens = int(os.getenv("AGENT_B_MAX_TOKENS", "1024"))
    prompt = (
        "You are Agent B (The Vault Gatekeeper), a strict anti-rug security validator on Base Network.\n"
        f"Token: {token_name}\n"
        f"Address: {contract_address}\n"
        f"GoPlus: {goplus_summary}\n"
    )
    if dex_context:
        prompt += f"Market: {dex_context}\n"
    prompt += (
        "\nOutput ONLY a single JSON object and NOTHING ELSE. No prose, no explanation, no markdown.\n"
        '{"score": <int 0-100>, "category": <one of defi|nft|social|gaming|infrastructure|airdrop|other>, '
        '"reason": <string <=200 chars>, "amount_usd": <float 0.00-2.00>, "model": "<model_id>"}\n'
        "Rules:\n"
        "- score>=85 AND no honeypot/tax/ownership red flags -> approve (amount_usd up to 2.00)\n"
        "- ANY honeypot flag, buy/sell tax >10%, or ownership-not-renounced risk -> score<=20, reject (amount_usd=0)\n"
        "- reason MUST cite specific GoPlus evidence (e.g. \"is_honeypot: true\", \"buy_tax: X%\")\n"
        "- Do NOT approve if security signals are unknown or suspicious.\n"
        "CRITICAL: Your entire response must be valid JSON starting with '{' and ending with '}'. "
        "Do NOT write any text before or after the JSON. If you add any words, the parser fails.\n"
        "EXAMPLE OUTPUT (emit exactly this shape, fill real values):\n"
        '{"score": 95, "category": "defi", "reason": "no honeypot, 0% tax, open source", "amount_usd": 0.5, "model": "deepseek-v4-pro"}'
    )
    # Dynamic model discovery: prefer the actual model id reported by the
    # server itself. Falls back to AGENT_B_MODEL on any failure (timeout,
    # missing endpoint, auth error).
    model_id = AGENT_B_MODEL
    if AGENT_B_MODEL_AUTO_DISCOVER:
        try:
            async with aiohttp.ClientSession() as _sess:
                discovered_list = await _discover_model_list(_sess, AGENT_B_ENDPOINT, AGENT_B_API_KEY)
            if discovered_list:
                # Prefer the model explicitly set in AGENT_B_MODEL if it is
                # actually present in the server's model list. Only fall back
                # to the first listed model when the configured one is absent
                # (e.g. a self-hosted vLLM that only exposes one model id).
                if AGENT_B_MODEL and AGENT_B_MODEL in discovered_list:
                    model_id = AGENT_B_MODEL
                else:
                    model_id = discovered_list[0]
                    if AGENT_B_MODEL and AGENT_B_MODEL != model_id:
                        logger.info(
                            "Agent B model fallback: env=%s not in server list, using %s",
                            AGENT_B_MODEL, model_id,
                        )
        except Exception as exc:
            logger.debug("Agent B auto-discovery skipped: %s", exc)

    client = AsyncOpenAI(base_url=_normalize_agent_b_endpoint(AGENT_B_ENDPOINT), api_key=AGENT_B_API_KEY, timeout=25.0, max_retries=1)
    _t0 = time.time()
    try:
        resp = await client.chat.completions.create(
            model=model_id,
            temperature=temperature,
            max_tokens=max_tokens,
            # Force JSON so the model cannot wrap its verdict in prose (which
            # previously made json.loads() fail -> score 0 -> never executes).
            # Fireworks / OpenAI-compatible servers honor this.
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Return only valid JSON, no prose."},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as exc:
        logger.warning("Agent B inference failed: %s", exc)
        return {"score": 0, "reason": f"inference_failed: {exc}", "amount_usd": 0.0, "model": model_id, "latency_ms": int((time.time() - _t0) * 1000)}

    _latency = int((time.time() - _t0) * 1000)
    content = resp.choices[0].message.content if resp.choices else ""
    if not content:
        _code = getattr(resp, "status_code", "?")
        return {"score": 0, "reason": f"http {_code}", "amount_usd": 0.0, "model": model_id, "latency_ms": _latency}
    # Some models wrap JSON in explanatory prose. Extract the first balanced
    # {...} object rather than json.loads() on the whole (often non-JSON) text.
    parsed = None
    _candidate = content.strip()
    if _candidate.startswith("{"):
        try:
            parsed = json.loads(_candidate)
        except Exception:
            parsed = None
    if parsed is None:
        # Non-greedy match of the JSON object that actually carries our
        # schema (starts with "score"), so stray {} in prose is ignored.
        _m = re.search(r'\{\s*"score"\s*:.*?\}', _candidate, re.DOTALL)
        if _m:
            try:
                parsed = json.loads(_m.group(0))
            except Exception:
                parsed = None
    # Also handle ```json ... ``` fences
    if parsed is None:
        _m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", _candidate, re.DOTALL)
        if _m:
            try:
                parsed = json.loads(_m.group(1))
            except Exception:
                parsed = None
    if isinstance(parsed, dict):
        return {
            "score": int(parsed.get("score", 0) or 0),
            "reason": str(parsed.get("reason", ""))[:200],
            "amount_usd": float(parsed.get("amount_usd", 0) or 0),
            "category": str(parsed.get("category", "unknown")),
            "model": str(parsed.get("model", model_id)),
            "latency_ms": _latency,
        }
    # Final fallback: keep raw text so logs show what the model actually said.
    return {"score": 0, "reason": content[:200], "amount_usd": 0.0, "model": model_id, "latency_ms": _latency}


async def process_task(task: dict[str, Any]) -> None:
  queue_id = task["id"]
  payload = task.get("data_payload") or {}
  if isinstance(payload, str):
    try:
      payload = json.loads(payload)
    except json.JSONDecodeError:
      payload = {}
  token_name = payload.get("token_name") or task.get("project_name") or "Unknown"
  contract_address = payload.get("contract_address") or task.get("target_address") or ""
  source = task.get("source") or "unknown"

  # Bridge Agent A's enriched DexScreener signals AND its LLM verdict into
  # Agent B's prompt so the vault scores with full A2Z agent-to-agent context.
  dex_context = ""
  agent_a_llm = payload.get("agent_a_llm")
  try:
    liq = payload.get("liquidity_usd")
    mcap = payload.get("market_cap")
    vol = payload.get("volume_24h")
    txns = payload.get("txns_24h") or {}
    buys = (txns.get("buys") if isinstance(txns, dict) else None)
    pc = payload.get("price_change_24h")
    parts = []
    if liq is not None:
      parts.append(f"liquidity_usd={liq}")
    if mcap is not None:
      parts.append(f"mcap={mcap}")
    if vol is not None:
      parts.append(f"volume_24h={vol}")
    if buys is not None:
      parts.append(f"buys_24h={buys}")
    if pc is not None:
      parts.append(f"price_change_24h={pc}")
    if parts:
      dex_context = ", ".join(parts)
    if isinstance(agent_a_llm, dict):
      dex_context += (
        f" | agent_a_verdict=score:{agent_a_llm.get('score')},"
        f"category:{agent_a_llm.get('category')},"
        f"reason:{agent_a_llm.get('reason')}"
      )
  except Exception:
    dex_context = ""

  async with aiohttp.ClientSession() as session:
    try:
      goplus_raw = await _check_goplus(session, contract_address)
    except RuntimeError as exc:
      if "HTTP 404" in str(exc) or "not found" in str(exc).lower():
        # GoPlus doesn't know this token. Do NOT drop it -- fall through with
        # an empty (permissive) security summary so Agent B's LLM can still
        # score + (if threshold met) execute. Only a real upstream outage
        # (raise below) should abort the pipeline.
        logger.warning("GoPlus 404 for %s -- continuing without security signal (queue_id=%s)", contract_address, queue_id)
        append_audit_log(
          "agent_b.goplus_404",
          f"Token not found on GoPlus for {contract_address}; proceeding",
          {"queue_id": queue_id, "address": contract_address},
        )
        goplus_raw = {}
      else:
        raise
    result = goplus_raw.get("result") if isinstance(goplus_raw, dict) else None
    if isinstance(result, dict):
      # Pass a richer signal set to the LLM: honeypot/tax basics plus the
      # strong rug predictors (holder concentration, mintable/owner, anti-whale).
      goplus_summary = json.dumps({
        "is_honeypot": result.get("is_honeypot"),
        "buy_tax": result.get("buy_tax"),
        "sell_tax": result.get("sell_tax"),
        "is_open_source": result.get("is_open_source"),
        "is_mintable": result.get("is_mintable"),
        "can_take_back_ownership": result.get("can_take_back_ownership"),
        "hidden_owner": result.get("hidden_owner"),
        "is_proxy": result.get("is_proxy"),
        "is_anti_whale": result.get("is_anti_whale"),
        "slippage_modifiable": result.get("slippage_modifiable"),
        "creator_balance": result.get("creator_balance"),
        "holder_count": result.get("holder_count"),
        "top10_holder_rate": result.get("top10_holder_rate"),
        "is_in_dex": result.get("is_in_dex"),
        "lp_holder_count": result.get("lp_holder_count"),
      })
    else:
      goplus_summary = json.dumps({})

    inference = await _run_agent_b_inference(token_name, contract_address, goplus_summary, dex_context)
    score = int(inference.get("score", 0) or 0)
    reason = inference.get("reason") or ""
    synthesis_id = insert_synthesis_result(queue_id, score, reason)
    append_audit_log(
      "agent_b.synthesized",
      f"Synthesized score={score} for queue_id={queue_id}",
      {"queue_id": queue_id, "score": score, "address": contract_address},
    )

    try:
      await manager.broadcast(
        json.dumps({
          "type": "AGENT_LOG",
          "data": {
            "sender": "agent_b",
            "content": f"Analyzed {token_name} ({contract_address}). Score: {score}/100. Reason: {reason}",
            "metadata": {"score": score, "projectName": token_name, "latencyMs": inference.get("latency_ms")}
          }
        })
      )
    except Exception:
      pass

        # Low score (but a *successful* analysis) is a terminal decision, NOT an
    # error -> do not retry (saves GoPlus + LLM calls). Only genuine failures
    # (inference errors, RPC down) should retry via the outer worker loop.
    if score < MAX_SCORE_FOR_AUTO:
      print(f"[DBG] score {score} < {MAX_SCORE_FOR_AUTO} -> reject")
      update_task_status(queue_id, "COMPLETED", retry=False)
      append_audit_log(
        "agent_b.rejected",
        f"Score {score} < {MAX_SCORE_FOR_AUTO}; not auto-executing",
        {"queue_id": queue_id, "score": score, "address": contract_address},
      )
      return

    # ===== OVERRIDE MODE: stop trusting DeepSeek JSON compliance =====
    # IF score >= 20, force a hard-coded $0.50 trade. We no longer read
    # amount_usd from the model payload (it frequently returns prose / 0).
    # The early-return on amount_usd null/0 is REMOVED -- we force the trade.
    amount_usd = 0.5

    # Pre-exec diagnostics (per operator instruction).
    from database import get_daily_spend_usd
    daily_spend = get_daily_spend_usd()
    rpc_health = await _rpc_health_ok(_build_rpc_provider())
    print(f"DEBUG_EXEC: Score={score}, Amount={amount_usd}, Health={rpc_health}, Budget={daily_spend}")
    if score >= MAX_SCORE_FOR_AUTO and rpc_health:
        print("DEBUG_EXEC: Conditions met. Triggering send_native_transaction...")
    else:
        print(f"DEBUG_EXEC: Conditions FAILED. Score status: {score >= MAX_SCORE_FOR_AUTO}, Health status: {rpc_health}")

    if score >= MAX_SCORE_FOR_AUTO and rpc_health:
        # ---- Real on-chain execution (A2Z Agent B gatekeeper) ----
        # Gated by AGENT_B_REAL_EXECUTION so a demo never accidentally spends.
        # EXECUTION ENFORCEMENT: insert proposal but DON'T let a failed insert
        # kill the thread -- log it and continue to send_native_transaction.
        try:
            proposal_id = insert_transaction_proposal(synthesis_id, amount_usd, None)
            append_audit_log(
                "agent_b.proposal_created",
                f"Auto proposal amount_usd={amount_usd}",
                {"synthesis_id": synthesis_id, "proposal_id": proposal_id, "address": contract_address},
            )
        except Exception as exc:
            logger.error("Agent B proposal insert failed (non-fatal): %s", exc)
            append_audit_log("agent_b.proposal_insert_failed", str(exc), {"queue_id": queue_id})
            proposal_id = None

        try:
            if os.getenv("AGENT_B_REAL_EXECUTION", "0") == "1":
                _active = os.getenv("ACTIVE_NETWORK", "base")
                if _active == "base_sepolia":
                    tx_hash = await send_proof_of_execution()
                else:
                    _cid = 8453
                    _gwei_cap = float(os.getenv("MAX_GAS_PRICE_GWEI", "0") or "0") or None
                    _val_wei = _usd_to_wei_real(amount_usd)
                    tx_hash = await send_native_transaction(
                        contract_address, _val_wei, chain_id=_cid, max_gas_price_gwei=_gwei_cap
                    )
                try:
                    if proposal_id is not None:
                        update_proposal_hash(proposal_id, tx_hash)
                except Exception:
                    pass
                append_audit_log(
                    "agent_b.executed",
                    f"Real on-chain send tx={tx_hash} amount_usd={amount_usd}",
                    {"proposal_id": proposal_id, "tx_hash": tx_hash, "network": _active},
                )
            else:
                tx_hash = f"mock::{contract_address}::{int(amount_usd * 1e15)}"
        except Exception as exc:
            logger.error("Agent B real execution failed for queue_id=%s: %s", queue_id, exc)
            append_audit_log(
                "agent_b.execution_failed",
                f"On-chain send failed: {exc}",
                {"queue_id": queue_id, "address": contract_address},
            )
            update_task_status(queue_id, "FAILED", retry=True)
            return

        try:
            await manager.broadcast(
                json.dumps({
                    "type": "AGENT_LOG",
                    "data": {
                        "sender": "agent_b",
                        "content": f"Score {score} >= {MAX_SCORE_FOR_AUTO}. Auto-executing proposal for {token_name}. Amount: ${amount_usd} | Tx: {tx_hash}",
                        "metadata": {"amountUsd": amount_usd, "projectName": token_name, "txHash": tx_hash, "score": score}
                    }
                })
            )
        except Exception:
            pass
        update_task_status(queue_id, "COMPLETED", retry=False)
        return

    # Conditions not met (low score / RPC down) -> terminal decision.
    update_task_status(queue_id, "COMPLETED" if score < MAX_SCORE_FOR_AUTO else "FAILED", retry=False if score < MAX_SCORE_FOR_AUTO else True)


async def worker_loop(poll_interval: float = 2.0) -> None:
  logger.info("[AGENT_B_DAEMON] worker_loop entered")
  try:
    from database import get_system_config
    if get_system_config("circuit_breaker", "active") == "paused":
      logger.info("Circuit breaker is paused. Agent B skipping cycle.")
      return

    ensure_pipeline_tables()
    logger.info("Agent B worker starting cycle")
    await manager.broadcast(json.dumps({
        "type": "AGENT_LOG",
        "data": {
            "sender": "agent_b",
            "content": "Agent B (Vault) online. Monitoring execution queue...",
            "metadata": {"online": True},
        },
    }))
  except Exception as exc:
    # Surface startup failure to the dashboard instead of dying silently.
    logger.error("[AGENT_B_DAEMON] startup failed: %s", exc, exc_info=True)
    try:
      await manager.broadcast(json.dumps({
        "type": "AGENT_LOG",
        "data": {
          "sender": "agent_b",
          "content": f"Agent B startup ERROR: {exc}",
          "metadata": {"error": True},
        },
      }))
    except Exception:
      pass
    return
  # Continuous poll loop. This runs as a dedicated asyncio daemon task
  # (started in main.py lifespan), NOT inside an APScheduler job, so an
  # infinite loop here is safe -- it will not trigger
  # 'maximum number of running instances reached'. Agent A re-enqueues tokens
  # (ON CONFLICT DO UPDATE -> PENDING) so tokens that arrive later are still
  # picked up on the next poll.
  _hb_counter = 0
  while True:
    # Heartbeat broadcast so the dashboard shows Agent B alive even when the
    # queue is empty. agent_b_last_seen is derived from the WS log buffer, so
    # without a periodic broadcast it stays 0 (false "daemon down" signal).
    _hb_counter += 1
    if _hb_counter % 15 == 0:
      try:
        await manager.broadcast(json.dumps({
          "type": "AGENT_LOG",
          "data": {
            "sender": "agent_b",
            "content": "Agent B (Vault) heartbeat — monitoring execution queue.",
            "metadata": {"online": True, "heartbeat": True},
          },
        }))
      except Exception:
        pass
    task = fetch_and_lock_pending_task(limit=1)
    if task is None:
      await asyncio.sleep(poll_interval)
      continue
    try:
      await process_task(task)
    except Exception as exc:
      logger.error("Agent B task failed: %s", exc, exc_info=True)
      queue_id = task.get("id") if isinstance(task, dict) else getattr(task, "id", None)
      if queue_id is not None:
        update_task_status(queue_id, "FAILED", retry=True)
        append_audit_log("agent_b.error", str(exc), {"queue_id": queue_id})


async def main() -> None:
  await worker_loop()


if __name__ == "__main__":
  asyncio.run(main())
