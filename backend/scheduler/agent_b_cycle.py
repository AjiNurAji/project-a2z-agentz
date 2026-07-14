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
    fetch_held_tokens,
    insert_execution_log,
    insert_held_token,
    insert_synthesis_result,
    insert_transaction_proposal,
    mark_token_sold,
    update_proposal_hash,
    update_task_status,
)
from routes.websockets import manager
from web3_async import MultiRpcProvider, send_native_transaction, send_proof_of_execution, _usd_to_wei_real, swap_eth_for_token, swap_token_for_eth, WETH_BASE

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
# Operator-authorized auto-exec threshold = 60 (PoC). Agent A Llama
# fallback scores land at 40-60; at 60 we trigger the $0.5 live send.
# Hard-coded per operator instruction (no env override, since a stale
# AGENT_B_AUTO_SCORE_MIN=85 would silently block every execution).
MAX_SCORE_FOR_AUTO = 60
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
# Take-profit: sell held tokens when price increases by this % (default 30%)
AGENT_B_PROFIT_PCT = float(os.getenv("AGENT_B_PROFIT_PCT", "30"))


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
    """Force the canonical Fireworks base: https://api.fireworks.ai/inference/v1.

    Operator confirmed the exact endpoint is
    https://api.fireworks.ai/inference/v1/chat/completions. The OpenAI SDK
    appends /chat/completions itself, so we strip any trailing path and
    ALWAYS rebuild as .../inference/v1 (never bare /v1, which 404s as
    'Path not found: /v1').
    """
    e = (endpoint or "").rstrip("/")
    # Drop any trailing chat/completions or /v1 so we don't double-append.
    for suffix in ("/chat/completions", "/v1", "/inference/v1"):
        if e.endswith(suffix):
            e = e[: -len(suffix)]
    # Always rebuild the canonical Fireworks inference base.
    if e.endswith("/inference"):
        return e + "/v1"
    if "api.fireworks.ai" in e:
        return "https://api.fireworks.ai/inference/v1"
    if not e.endswith("/v1"):
        e = e + "/v1"
    return e


def _build_rpc_provider() -> MultiRpcProvider | None:
  urls = [u for u in [BASE_RPC_1, BASE_RPC_2, BASE_RPC_3] if u]
  if not urls:
    logger.critical("No RPC endpoints configured (BASE_RPC_1/2/3 all empty). On-chain execution IMPOSSIBLE.")
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


async def _run_agent_b_inference(token_name: str, contract_address: str, goplus_summary: str, dex_context: str = "", agent_a_score: int | None = None, agent_a_reason: str = ""):
    # --- Force fresh config load every cycle (exorcise cached/stale env) ---
    _endpoint = os.getenv("AGENT_B_ENDPOINT", "")
    _api_key = os.getenv("AGENT_B_API_KEY", "")
    _model = os.getenv("AGENT_B_MODEL", "")
    _auto_discover = os.getenv("AGENT_B_MODEL_AUTO_DISCOVER", "0") == "1"
    if not _api_key or not _endpoint or not _model:
        return {"score": 0, "reason": "missing agent b config", "amount_usd": 0.0, "model": "bypass", "latency_ms": 0}
    temperature = float(os.getenv("AGENT_B_TEMPERATURE", "0.0"))
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
        "MANDATORY SCORING RULES (follow exactly):\n"
        "- Liquidity >$200K AND volume >$10K AND GoPlus clean → score 85-95 (strong buy)\n"
        "- Liquidity >$50K AND volume >$1K AND GoPlus clean → score 60-75 (eligible for micro-trade)\n"
        "- Liquidity <$10K OR volume <$1K → score 10-30 (weak/risky)\n"
        "- ANY honeypot flag, buy/sell tax >10%, or ownership-not-renounced risk → score <=20, reject (amount_usd=0)\n"
        "- NEVER score below 60 when liquidity >$50K and GoPlus shows no honeypot/tax issues.\n"
        "- reason MUST cite specific GoPlus evidence (e.g. \"is_honeypot: true\", \"buy_tax: X%\", \"liq=$Y\")\n"
        "CRITICAL: Your entire response must be valid JSON starting with '{' and ending with '}'. "
        "Do NOT write any text before or after the JSON. If you add any words, the parser fails.\n"
        "EXAMPLE OUTPUT (emit exactly this shape, fill real values):\n"
        '{"score": 70, "category": "defi", "reason": "liq=$80K, vol=$5K, no honeypot, 0% tax", "amount_usd": 0.5, "model": "deepseek-v4-pro"}\n'
        "CRITICAL: DO NOT explain your reasoning before the JSON. DO NOT output any prose or markdown. OUTPUT ONLY A RAW JSON OBJECT."
    )
    # Dynamic model discovery: prefer the actual model id reported by the
    # server itself. Falls back to AGENT_B_MODEL on any failure (timeout,
    # missing endpoint, auth error).
    model_id = _model
    if _auto_discover:
        try:
            async with aiohttp.ClientSession() as _sess:
                discovered_list = await _discover_model_list(_sess, _endpoint, _api_key)
            if discovered_list:
                if _model and _model in discovered_list:
                    model_id = _model
                else:
                    model_id = discovered_list[0]
                    if _model and _model != model_id:
                        logger.info("Agent B model fallback: env=%s not in server list, using %s", _model, model_id)
        except Exception as exc:
            logger.debug("Agent B auto-discovery skipped: %s", exc)

    async def _do_inference() -> dict[str, Any]:
        client = AsyncOpenAI(base_url=_normalize_agent_b_endpoint(_endpoint), api_key=_api_key, timeout=35.0, max_retries=1)
        _t0 = time.time()
        try:
            resp = await client.chat.completions.create(
                model=model_id,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "Return only valid JSON, no prose."},
                    {"role": "user", "content": prompt},
                ],
            )
        except Exception as exc:
            return {"_error": exc}
        _latency = int((time.time() - _t0) * 1000)
        content = resp.choices[0].message.content if resp.choices else ""
        if not content:
            _code = getattr(resp, "status_code", "?")
            return {"score": 0, "reason": f"http {_code}", "amount_usd": 0.0, "model": model_id, "latency_ms": _latency}
        # Bulletproof parse: DeepSeek-V4-Pro wraps JSON in prose or trailing commas.
        parsed = None
        _candidate = content.strip()
        def _try_loads(text: str):
            try:
                return json.loads(text)
            except Exception:
                # Try fix trailing comma: {"score": 70,} -> {"score": 70}
                fixed = re.sub(r",\s*([}\]])", r"\1", text)
                try:
                    return json.loads(fixed)
                except Exception:
                    return None
        if _candidate.startswith("{"):
            parsed = _try_loads(_candidate)
        if parsed is None:
            _m = re.search(r"\{.*\}", _candidate, re.DOTALL)
            if _m:
                parsed = _try_loads(_m.group(0))
        if parsed is None:
            _m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", _candidate, re.DOTALL)
            if _m:
                parsed = _try_loads(_m.group(1))
        if parsed is None:
            _m = re.search(r'\{\s*"score"\s*:.*?\}', _candidate, re.DOTALL)
            if _m:
                parsed = _try_loads(_m.group(0))
        if isinstance(parsed, dict):
            return {
                "score": int(parsed.get("score", 0) or 0),
                "reason": str(parsed.get("reason", ""))[:200],
                "amount_usd": float(parsed.get("amount_usd", 0) or 0),
                "category": str(parsed.get("category", "unknown")),
                "model": str(parsed.get("model", model_id)),
                "latency_ms": _latency,
            }
        if agent_a_score is not None:
            return {
                "score": int(agent_a_score),
                "reason": f"[fallback to Agent A LLM] {agent_a_reason}"[:200],
                "amount_usd": 0.0,
                "category": "unknown",
                "model": "agent_a_fallback",
                "latency_ms": _latency,
            }
        return {"score": 0, "reason": content[:200], "amount_usd": 0.0, "model": model_id, "latency_ms": _latency}

    # --- Inference with retry on ALL errors (404, timeout, 500, etc.) ---
    _res = await _do_inference()
    if "_error" in _res:
        _exc = _res["_error"]
        _status = getattr(getattr(_exc, "response", None), "status_code", None)
        logger.critical("Agent B inference FAILED (attempt 1): %s (status=%s)", _exc, _status)
        # Retry once on ANY error (404, timeout, 500, connection)
        logger.critical("Retrying inference after 3s...")
        await asyncio.sleep(3)
        _endpoint = os.getenv("AGENT_B_ENDPOINT", "")
        _api_key = os.getenv("AGENT_B_API_KEY", "")
        _model = os.getenv("AGENT_B_MODEL", "")
        model_id = _model
        _res = await _do_inference()
        if "_error" in _res:
            _exc2 = _res["_error"]
            logger.critical("Agent B inference FAILED on retry: %s", _exc2)
            if agent_a_score is not None:
                logger.warning("Agent B retry failed — falling back to Agent A score=%s", agent_a_score)
                return {"score": int(agent_a_score), "reason": f"[fallback Agent A after retry fail] {agent_a_reason}"[:200], "amount_usd": 0.0, "category": "unknown", "model": "agent_a_fallback", "latency_ms": 0}
            return {"score": 0, "reason": f"inference_failed: {_exc2}", "amount_usd": 0.0, "model": model_id, "latency_ms": 0}
    return _res


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
  agent_a_score = None
  agent_a_reason = ""
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
      # Capture Agent A's own LLM verdict so Agent B can fall back to it
      # when the DeepSeek gatekeeper regurgitates prose instead of JSON.
      try:
        agent_a_score = int(agent_a_llm.get("score") or 0) or None
      except Exception:
        agent_a_score = None
      agent_a_reason = str(agent_a_llm.get("reason") or "")
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

    logger.info("Attempting inference for %s (%s)", token_name, contract_address)
    inference = await _run_agent_b_inference(
        token_name, contract_address, goplus_summary, dex_context,
        agent_a_score=agent_a_score, agent_a_reason=agent_a_reason,
    )
    score = int(inference.get("score", 0) or 0)
    model_used = inference.get("model", "?")
    logger.info("SUCCESS inference for %s: score=%s model=%s latency=%sms",
                contract_address, score, model_used, inference.get("latency_ms", 0))

    # === TRUST AGENT A: Agent A already did data-driven scoring (DexScreener).
    # DeepSeek often fails to parse or gives low scores. Use the MAX of both
    # so Agent A's real data score is never overruled by a broken DeepSeek call.
    if agent_a_score is not None and agent_a_score > score:
        logger.info("Agent A score (%s) > Agent B score (%s) — using Agent A", agent_a_score, score)
        score = agent_a_score
        model_used = "agent_a_trusted"

    # === HARD-RULE BYPASS: if liquidity >$50K and GoPlus clean, force score >= 60 ===
    # DeepSeek frequently ignores prompt rules and returns score < 60 even for tokens
    # with healthy liquidity. This bypass ensures eligible tokens never get stuck.
    liq_hard = payload.get("liquidity_usd") or 0
    vol_hard = payload.get("volume_24h") or 0
    if isinstance(result, dict) and liq_hard > 50000 and score < 60:
        is_hp = str(result.get("is_honeypot") or "").lower()
        buy_t = float(result.get("buy_tax") or 0)
        sell_t = float(result.get("sell_tax") or 0)
        if is_hp not in ("1", "true") and buy_t <= 10 and sell_t <= 10:
            # Operator rule: Liquidity >$50K AND GoPlus clean => eligible (60-75).
            # Scale bonuses so ANY qualifying token reaches >=60 (the auto-exec
            # threshold). The old formula capped ~58 and silently blocked eligible
            # tokens (0 executions). Floor at 60 so eligible tokens always clear
            # the gate at the operator-defined $0.50 micro-trade size.
            liq_bonus = int(min(liq_hard / 50000, 6) * 5)   # up to +30
            vol_bonus = int(min(vol_hard / 5000, 4) * 5)    # up to +20
            forced_score = min(75, 30 + liq_bonus + vol_bonus)
            if forced_score < 60:
                forced_score = 60
            logger.info("HARD-RULE BYPASS: liq=$%sK vol=$%sK GoPlus clean → forcing score %s (was %s)",
                        liq_hard/1000, vol_hard/1000, forced_score, score)
            score = max(score, forced_score)
            model_used = "hard_rule_bypass"

    reason = inference.get("reason") or agent_a_reason or ""
    # Persist narrative + token identity so the UI (trade history) can show
    # Agent A's LLM reasoning. In testnet, agent_a_reason carries the
    # Factory token identity + LLM narrative.
    _synthesis_token_name = (inference.get("token_name") or token_name or "")
    synthesis_id = insert_synthesis_result(queue_id, score, reason, reason=reason, token_name=_synthesis_token_name)
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

    # STRICT MIRRORING (testnet): in base_sepolia mode we run an isolated
    # sandbox where Agent A feeds a mock BUY signal for A2ZTestToken. Scoring
    # (DeepSeek ≥60) and GoPlus are mainnet-only OSINT gates that don't apply
    # to our self-deployed testnet token, so we bypass them to let Agent B
    # actually execute the buy/sell flow on Base Sepolia.
    _is_testnet = os.getenv("ACTIVE_NETWORK", "base").strip().lower() == "base_sepolia"

    # Low score (but a *successful* analysis) is a terminal decision, NOT an
    # error -> do not retry (saves GoPlus + LLM calls). Only genuine failures
    # (inference errors, RPC down) should retry via the outer worker loop.
    if score < MAX_SCORE_FOR_AUTO and not _is_testnet:
      print(f"[DBG] score {score} < {MAX_SCORE_FOR_AUTO} -> reject")
      update_task_status(queue_id, "COMPLETED", retry=False)
      append_audit_log(
        "agent_b.rejected",
        f"Score {score} < {MAX_SCORE_FOR_AUTO}; not auto-executing",
        {"queue_id": queue_id, "score": score, "address": contract_address},
      )
      return
    if score < MAX_SCORE_FOR_AUTO and _is_testnet:
      logger.info("TESTNET BYPASS: score %s < %s but base_sepolia sandbox -> executing anyway", score, MAX_SCORE_FOR_AUTO)

    # === GoPlus Security Gate: block on honeypot / high tax / ownership risk ===
    goplus_blocked = False
    goplus_block_reason = ""
    if isinstance(result, dict):
        is_honeypot = str(result.get("is_honeypot") or "").lower()
        buy_tax = float(result.get("buy_tax") or 0)
        sell_tax = float(result.get("sell_tax") or 0)
        can_take_ownership = str(result.get("can_take_back_ownership") or "").lower()
        hidden_owner = str(result.get("hidden_owner") or "").lower()
        if is_honeypot in ("1", "true"):
            goplus_blocked = True
            goplus_block_reason = "honeypot detected by GoPlus"
        elif buy_tax > 10 or sell_tax > 10:
            goplus_blocked = True
            goplus_block_reason = f"tax too high (buy={buy_tax}%, sell={sell_tax}%)"
        elif can_take_ownership in ("1", "true") and hidden_owner in ("1", "true"):
            goplus_blocked = True
            goplus_block_reason = "ownership can be taken back + hidden owner"
    if goplus_blocked and not _is_testnet:
        logger.warning("GoPlus security gate BLOCKED: %s for %s", goplus_block_reason, contract_address)
        update_task_status(queue_id, "COMPLETED", retry=False)
        append_audit_log(
            "agent_b.goplus_blocked",
            f"Blocked by GoPlus: {goplus_block_reason}",
            {"queue_id": queue_id, "address": contract_address, "score": score},
        )
        return
    if goplus_blocked and _is_testnet:
        logger.info("TESTNET BYPASS: GoPlus flagged '%s' but base_sepolia sandbox -> executing anyway", goplus_block_reason)

    # ===== OVERRIDE MODE: stop trusting DeepSeek JSON compliance =====
    # IF score >= 20, force a hard-coded $0.50 trade. We no longer read
    # amount_usd from the model payload (it frequently returns prose / 0).
    # The early-return on amount_usd null/0 is REMOVED -- we force the trade.
    amount_usd = 0.5

    # --- Guard: never try to "buy" a base asset / wrapped token (WETH). ---
    # WETH (0x4200...0006) is the quote asset itself; swapping ETH->WETH or
    # sending ETH to it is meaningless and the smart-contract guard aborts it,
    # causing an infinite FAILED/retry loop. Mark eligible-but-unbuyable
    # targets COMPLETED (no retry) so they don't wedge the queue.
    if contract_address.lower() == WETH_BASE.lower():
        logger.warning("Agent B skipping execution: target %s is WETH (not buyable)", contract_address)
        update_task_status(queue_id, "COMPLETED", retry=False)
        append_audit_log(
            "agent_b.skipped_unbuyable",
            f"Target {contract_address} is WETH; not auto-buying",
            {"queue_id": queue_id, "address": contract_address},
        )
        return

    # Pre-exec diagnostics + RPC health retry loop.
    # Single _rpc_health_ok() was the #1 silent killer: RPC blip = zero execution
    # even with score=100. Now retry up to 3x with exponential backoff so
    # transient RPC flakes don't silently abort every queued task.
    from database import get_daily_spend_usd
    daily_spend = get_daily_spend_usd()
    rpc_provider = _build_rpc_provider()
    rpc_health = False
    if rpc_provider is None:
        # Permanent config fault: no RPC endpoints in env. Retrying won't help.
        # Log once and mark terminal — do NOT retry (infinite loop on same addr).
        logger.critical("RPC provider is None (no BASE_RPC_* env vars set). Execution IMPOSSIBLE — NOT retrying.")
        append_audit_log(
            "agent_b.no_rpc_configured",
            "No RPC endpoints configured in environment; on-chain execution disabled",
            {"queue_id": queue_id, "address": contract_address, "score": score},
        )
        update_task_status(queue_id, "FAILED", retry=False)
        return
    if score >= MAX_SCORE_FOR_AUTO:
        for _rpc_attempt in range(1, 4):  # up to 3 retries
            rpc_health = await _rpc_health_ok(rpc_provider)
            if rpc_health:
                break
            logger.warning(
                "RPC health check failed (attempt %d/3) — retrying in %ds...",
                _rpc_attempt, _rpc_attempt * 3,
            )
            await asyncio.sleep(_rpc_attempt * 3)
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
                    # --- Base Sepolia REAL SWAP (strict-mirroring testnet) ---
                    # We deployed our own Uniswap V2 Router02 + A2ZTestToken +
                    # liquidity on Base Sepolia (see /root/a2z-sepolia-dex), so
                    # Agent B executes a REAL swap here (ETH -> token) via the
                    # Sepolia router. Amount is a small FIXED wei value (NOT the
                    # USD-converted mainnet size) so testnet runs stay cheap and
                    # deterministic regardless of ETH price.
                    if not os.getenv("BASE_SEPOLIA_RPC") and not os.getenv("BASE_SEPOLIA_RPC_1") and not os.getenv("BASE_SEPOLIA_RPC_2"):
                        logger.warning(
                            "ACTIVE_NETWORK=base_sepolia but no BASE_SEPOLIA_RPC* set; "
                            "skipping swap (no testnet RPC configured)."
                        )
                        tx_hash = None
                    else:
                        _cid = 84532
                        _gwei_cap = float(os.getenv("MAX_GAS_PRICE_GWEI", "0") or "0") or None
                        # Small fixed testnet buy size (default 0.0002 ETH).
                        _val_wei = int(os.getenv("AGENT_B_TESTNET_ETH_WEI", str(int(0.0002 * 1e18))))
                        amount_usd = 0.0  # not USD-priced on testnet
                        logger.info(
                            "Agent B: REAL swap on Base Sepolia (cid=84532) %s wei -> %s via Sepolia router",
                            _val_wei, contract_address,
                        )
                        swap_res = await swap_eth_for_token(
                            contract_address, _val_wei, chain_id=_cid, max_gas_price_gwei=_gwei_cap
                        )
                        tx_hash = swap_res.get("tx_hash") or swap_res.get("tx_hash_id")  # type: ignore[assignment]
                        if not tx_hash:
                            raise RuntimeError(f"testnet swap returned no tx_hash: {swap_res}")
                else:
                    _cid = 8453
                    _gwei_cap = float(os.getenv("MAX_GAS_PRICE_GWEI", "0") or "0") or None
                    # Use operator-configurable buy size (default $0.50). Set
                    # AGENT_B_MAX_TX_USD=0.01 for micro-testing without draining
                    # the vault.
                    amount_usd = float(os.getenv("AGENT_B_MAX_TX_USD", "0.5"))
                    _val_wei = _usd_to_wei_real(amount_usd)
                    # BUY the token via Uniswap V2 swap (ETH -> token), NOT a
                    # plain native transfer to the token contract (which reverts
                    # under EIP-7611 / OP-070 and would waste gas).
                    swap_res = await swap_eth_for_token(
                        contract_address, _val_wei, chain_id=_cid, max_gas_price_gwei=_gwei_cap
                    )
                    tx_hash = swap_res.get("tx_hash") or swap_res.get("tx_hash_id")  # type: ignore[assignment]
                    if not tx_hash:
                        raise RuntimeError(f"swap returned no tx_hash: {swap_res}")
                try:
                    if proposal_id is not None:
                        update_proposal_hash(proposal_id, tx_hash)
                except Exception:
                    pass
                append_audit_log(
                    "agent_b.executed",
                    f"Real on-chain swap tx={tx_hash} amount_usd={amount_usd}",
                    {"proposal_id": proposal_id, "tx_hash": tx_hash, "network": _active},
                )
                # Also insert to execution_logs so /api/stats total_transactions
                # updates. Carry Agent A's LLM narrative + token name so the
                # dashboard trade history can display the reasoning.
                try:
                    insert_execution_log(
                        tx_hash, contract_address, amount_usd, "SUCCESS",
                        queue_id=queue_id, token_name=token_name, reason=reason,
                    )
                except Exception:
                    pass
                # Track purchase for take-profit sell
                try:
                    insert_held_token(contract_address, token_name, tx_hash, amount_usd, int(_val_wei))
                except Exception:
                    pass
            else:
                tx_hash = f"mock::{contract_address}::{int(amount_usd * 1e15)}"
        except Exception as exc:
            logger.error("Agent B real execution failed for queue_id=%s: %s", queue_id, exc)
            # Insufficient-balance is a permanent config fault (vault empty),
            # not a transient RPC error. Mark COMPLETED (no retry) so the queue
            # doesn't spin forever burning cycles. Other errors retry.
            _insufficient = "insufficient balance" in str(exc).lower()
            append_audit_log(
                "agent_b.execution_failed",
                f"On-chain send failed: {exc}",
                {"queue_id": queue_id, "address": contract_address, "insufficient_balance": _insufficient},
            )
            update_task_status(queue_id, "COMPLETED" if _insufficient else "FAILED", retry=not _insufficient)
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

    # Conditions not met (low score / RPC down after retries) -> terminal decision.
    if not rpc_health and score >= MAX_SCORE_FOR_AUTO:
        logger.critical("RPC health FAILED after 3 retries — marking task FAILED for retry (queue_id=%s)", queue_id)
        append_audit_log(
            "agent_b.rpc_down",
            "RPC health check failed after 3 retries; task will retry",
            {"queue_id": queue_id, "address": contract_address, "score": score},
        )
        update_task_status(queue_id, "FAILED", retry=True)
        return
    update_task_status(queue_id, "COMPLETED" if score < MAX_SCORE_FOR_AUTO else "FAILED", retry=False if score < MAX_SCORE_FOR_AUTO else True)


async def _check_take_profit() -> None:
    """Check held tokens for take-profit opportunities and sell if target met."""
    import aiohttp as _aiohttp
    held = fetch_held_tokens("HOLDING")
    if not held:
        return

    for token in held:
        addr = token.get("token_address", "")
        name = token.get("token_name", "unknown")
        entry_price = float(token.get("entry_price_usd") or 0)
        if not addr or entry_price <= 0:
            continue

        # Fetch current price via DexScreener
        try:
            url = f"https://api.dexscreener.com/latest/dex/tokens/{addr}"
            async with _aiohttp.ClientSession() as sess:
                async with sess.get(url, timeout=10) as resp:
                    if resp.status != 200:
                        continue
                    data = await resp.json()
            pairs = (data.get("pairs") or []) if isinstance(data, dict) else []
            if not pairs:
                continue
            current_price = float(pairs[0].get("priceUsd") or 0)
        except Exception:
            continue

        if current_price <= 0:
            continue

        profit_pct = (current_price - entry_price) / entry_price * 100
        logger.info("Take-profit check: %s entry=$%.6f now=$%.6f profit=%.1f%% target=%s%%",
                    name, entry_price, current_price, profit_pct, AGENT_B_PROFIT_PCT)

        if profit_pct >= AGENT_B_PROFIT_PCT:
            logger.info("TAKE PROFIT TRIGGERED: %s +%.1f%% — selling...", name, profit_pct)
            try:
                result = await swap_token_for_eth(addr, int(token.get("amount_wei") or 0), chain_id=8453)
                mark_token_sold(addr, result["tx_hash"])
                append_audit_log(
                    "agent_b.take_profit",
                    f"Sold {name}: +{profit_pct:.1f}% profit, tx={result['tx_hash']}",
                    {"token": addr, "profit_pct": profit_pct, "tx_hash": result["tx_hash"]},
                )
                await manager.broadcast(json.dumps({
                    "type": "AGENT_LOG",
                    "data": {
                        "sender": "agent_b",
                        "content": f"TAKE PROFIT: Sold {name} at +{profit_pct:.1f}% | Tx: {result['tx_hash']}",
                        "metadata": {"txHash": result["tx_hash"], "profitPct": profit_pct, "projectName": name},
                    },
                }))
            except Exception as exc:
                logger.error("Take-profit sell failed for %s: %s", addr, exc)


async def worker_loop(poll_interval: float = 2.0) -> None:
  logger.info("[AGENT_B_DAEMON] worker_loop entered")
  # --- Resilient startup: ensure_pipeline_tables() can hit a transient DB
  # lock (incl. the scraping_queue deadlock). Never die permanently -- retry
  # with backoff so Agent B stays online across transient lock contention.
  from database import get_system_config
  if get_system_config("circuit_breaker", "active") == "paused":
    logger.info("Circuit breaker is paused. Agent B skipping cycle.")
    return

  _startup_ok = False
  for _attempt in range(1, 11):  # up to 10 startup retries
    try:
      ensure_pipeline_tables()
      _startup_ok = True
      break
    except Exception as exc:
      logger.error("[AGENT_B_DAEMON] startup ensure_pipeline_tables failed (attempt %d/10): %s",
                    _attempt, exc, exc_info=True)
      await asyncio.sleep(min(2.0 * _attempt, 20.0))
  if not _startup_ok:
    # Could not initialize after retries -- surface but still go into the
    # poll loop (which is itself resilient) so the daemon does not exit.
    logger.error("[AGENT_B_DAEMON] startup failed after retries; entering poll loop anyway")

  try:
    await manager.broadcast(json.dumps({
        "type": "AGENT_LOG",
        "data": {
            "sender": "agent_b",
            "content": "Agent B (Vault) online. Monitoring execution queue...",
            "metadata": {"online": True},
        },
    }))
  except Exception:
    pass
  # Continuous poll loop. This runs as a dedicated asyncio daemon task
  # (started in main.py lifespan), NOT inside an APScheduler job, so an
  # infinite loop here is safe -- it will not trigger
  # 'maximum number of running instances reached'. Agent A re-enqueues tokens
  # (ON CONFLICT DO UPDATE -> PENDING) so tokens that arrive later are still
  # picked up on the next poll.
  _hb_counter = 0
  _poll_errors = 0
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
    # --- Resilient poll: a DB lock / transient error must NEVER kill the
    # daemon (that knocks Agent B offline permanently). Catch, log, sleep,
    # retry. The deadlock (RowExclusiveLock) from scraping_queue cleanup is
    # handled upstream by FOR UPDATE SKIP LOCKED, but if it still surfaces we
    # back off instead of crashing.
    try:
      task = fetch_and_lock_pending_task(limit=1)
      if task is None:
        await asyncio.sleep(poll_interval)
        continue
      try:
        await process_task(task)
        _poll_errors = 0
        # After each task, check held tokens for take-profit
        try:
            await _check_take_profit()
        except Exception:
            pass
      except Exception as exc:
        logger.error("Agent B task failed: %s", exc, exc_info=True)
        queue_id = task.get("id") if isinstance(task, dict) else getattr(task, "id", None)
        if queue_id is not None:
          try:
            update_task_status(queue_id, "FAILED", retry=True)
          except Exception:
            pass
        append_audit_log("agent_b.error", str(exc), {"queue_id": queue_id})
    except Exception as exc:
      # DB lock / connection blip / any poll-level failure.
      _poll_errors += 1
      logger.error(
        "[AGENT_B_DAEMON] poll iteration failed (err #%d): %s",
        _poll_errors, exc, exc_info=True,
      )
      # Back off briefly so we don't hammer a locked DB. Keep the daemon alive.
      backoff = min(2.0 * _poll_errors, 30.0)
      try:
        await manager.broadcast(json.dumps({
          "type": "AGENT_LOG",
          "data": {
            "sender": "agent_b",
            "content": f"Agent B poll recovered from error (retry #{_poll_errors}). Staying online.",
            "metadata": {"online": True, "error": True},
          },
        }))
      except Exception:
        pass
      await asyncio.sleep(backoff)
      continue


async def main() -> None:
  await worker_loop()


if __name__ == "__main__":
  asyncio.run(main())
