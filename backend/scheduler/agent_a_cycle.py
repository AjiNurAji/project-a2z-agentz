"""
Agent A - The Scout (Cycle)
==============================

Minimal producer that enqueues discovered Base-network token targets into
``scraping_queue`` for Agent B's GoPlus + AI gatekeeping pipeline.

OSINT PIVOT (overhaul)
-----------------------
Farcaster / Neynar social scraping has been REMOVED. Agent A now ingests
deterministic, real-time on-chain data from the DexScreener REST API:

  1. /token-profiles/latest/v1  -> list of newly created token profiles
     (each carries {chainId, tokenAddress}). We keep only chainId == "base".
  2. /token-pairs/v1/base/{addresses} -> full pair stats (liquidity.usd,
     volume.h24, priceUsd, pairCreatedAt) for the Base token addresses we
     collected in step 1. This is the authoritative "newly created / trending
     Base pairs" source (the search endpoint is free-text and returns mostly
     non-Base junk).

Strict Alpha Filter (applied before enqueue):
  * chainId MUST == "base"
  * liquidity.usd MUST be > $5,000 (drop dead/dust tokens)
  * volume.h24 MUST be > 0
  * baseToken.address MUST be a valid EVM address

Payload Enrichment for DeepSeek (Agent B):
  content field is formatted as a single dense line:
    DEX_ALPHA_SIGNAL | Network: Base | Symbol: {sym} | Token Address: {addr} |
    Liquidity USD: ${liq} | 24h Volume USD: ${vol} | Pair Age: {age} | Price USD: ${price}

This gives DeepSeek the hard numerical backing to issue a 90+ score
confidently (social prose lacked technical facts and produced score 0).

Agent B logic (GoPlus, score>=85, $0.5 override) is NOT touched by this file.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

import aiohttp
from dotenv import load_dotenv

from database import ensure_pipeline_tables, enqueue_target, append_audit_log
from routes.websockets import manager
# Opsi 2 (A2Z Agent-to-Agent): Agent A calls the LLM brain on the AMD GPU
# server (via Cloudflare tunnel) to extract + score the signal BEFORE handing
# the target to Agent B. run_ai_inference() is the shared entrypoint.
from agent_a_inference import run_ai_inference, generate_testnet_narrative

load_dotenv()

logger = logging.getLogger("a2z.agent_a")

BATCH_SIZE = int(os.getenv("AGENT_A_BATCH_SIZE", "20"))
DEFAULT_USER_ID = int(os.getenv("AGENT_A_DEFAULT_USER_ID", "1"))
# LLM brain for Agent A (Llama on AMD via Cloudflare tunnel). Falls back to the
# generic AI_MODEL env if AGENT_A_MODEL is not set. Empty endpoint -> mock.
AI_MODEL = os.getenv("AGENT_A_MODEL", os.getenv("AI_MODEL", ""))
AGENT_A_LLM_THRESHOLD = int(os.getenv("AGENT_A_LLM_THRESHOLD", "60"))  # >= 60 = eligible

# --- Strict Alpha Filter thresholds ---
MIN_LIQUIDITY_USD = float(os.getenv("AGENT_A_MIN_LIQUIDITY_USD", "5000"))
MIN_PAIR_AGE_SECONDS = int(os.getenv("AGENT_A_MIN_PAIR_AGE_SECONDS", "0"))  # 0 = no age floor (new pairs welcome)
MAX_PAIR_AGE_SECONDS = int(os.getenv("AGENT_A_MAX_PAIR_AGE_SECONDS", "0"))  # 0 = unbounded

_BASE_CHAIN_ID = "base"

# Strict Base Network / EVM contract address gatekeeper.
_EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def _is_valid_evm_address(address: str | None) -> bool:
    """Return True only for strict 0x-prefixed 40-hex EVM addresses."""
    if not address or not isinstance(address, str):
        return False
    return bool(_EVM_ADDRESS_RE.match(address.strip()))


async def _get(session: aiohttp.ClientSession, url: str, params: dict[str, Any] | None = None, timeout: int = 15, headers: dict[str, str] | None = None) -> Any | None:
    _headers = {"accept": "application/json"}
    if headers:
        _headers.update(headers)
    try:
        async with session.get(url, params=params, headers=_headers, timeout=timeout) as resp:
            if resp.status == 200:
                return await resp.json()
            logger.warning("Agent A upstream %s -> %s", url, resp.status)
            return None
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Agent A upstream fetch failed %s: %s", url, exc)
        return None


async def fetch_new_base_token_addresses(session: aiohttp.ClientSession, limit: int = 50) -> list[str]:
    """
    Step 1: pull recently-updated token profiles and keep only Base ones.

    /token-profiles/recent-updates/v1 returns a JSON array of
    {chainId, tokenAddress, ...} for tokens that were recently updated on
    DexScreener (new pairs / metadata changes). We filter chainId == "base"
    and return the list of Base token addresses (deduped, capped at `limit`).

    NOTE: /token-profiles/latest/v1 tends to surface non-Base chains (ethereum,
    solana, robinhood), so recent-updates is the reliable Base source here.
    """
    data = await _get(session, "https://api.dexscreener.com/token-profiles/recent-updates/v1")
    if not isinstance(data, list):
        return []
    addrs: list[str] = []
    seen: set[str] = set()
    for prof in data:
        if prof.get("chainId") != _BASE_CHAIN_ID:
            continue
        addr = (prof.get("tokenAddress") or "").strip()
        if not _is_valid_evm_address(addr):
            continue
        if addr.lower() in seen:
            continue
        seen.add(addr.lower())
        addrs.append(addr)
        if len(addrs) >= limit:
            break
    return addrs


async def fetch_base_pair_stats(session: aiohttp.ClientSession, addresses: list[str]) -> list[dict[str, Any]]:
    """
    Step 2: enrich Base token addresses with full pair stats.

    The multi-address form (/token-pairs/v1/base/a,b,c) frequently returns an
    empty list, so we fetch ONE address per request (reliable) and merge. Each
    call returns an array of pair objects (chainId, baseToken, liquidity.usd,
    volume.h24, priceUsd, pairCreatedAt, ...). We keep pairs that pass the
    Strict Alpha Filter and build the normalized token dict Agent A enqueues.
    """
    if not addresses:
        return []

    from time import time as _now
    now_ms = _now() * 1000

    tokens: list[dict[str, Any]] = []
    seen: set[str] = set()
    for address in addresses:
        if not _is_valid_evm_address(address):
            continue
        if address.lower() in seen:
            continue
        data = await _get(session, f"https://api.dexscreener.com/token-pairs/v1/base/{address}")
        if not isinstance(data, list):
            continue
        for pair in data:
            if pair.get("chainId") != _BASE_CHAIN_ID:
                continue
            token = pair.get("baseToken", {}) or {}
            pa = (token.get("address") or "").strip()
            if not _is_valid_evm_address(pa):
                continue
            if pa.lower() != address.lower():
                # pair's baseToken isn't the address we asked about; skip
                continue

            liquidity = float((pair.get("liquidity") or {}).get("usd", 0) or 0)
            volume_h24 = float((pair.get("volume") or {}).get("h24", 0) or 0)

            # --- Strict Alpha Filter ---
            if liquidity < MIN_LIQUIDITY_USD:
                logger.debug("Dropped low-liquidity %s (%.0f < %.0f)", address, liquidity, MIN_LIQUIDITY_USD)
                continue
            if volume_h24 <= 0:
                logger.debug("Dropped zero-volume %s", address)
                continue

            pair_created = pair.get("pairCreatedAt")
            age_seconds = (now_ms - pair_created) / 1000.0 if pair_created else None
            if age_seconds is not None:
                if MIN_PAIR_AGE_SECONDS and age_seconds < MIN_PAIR_AGE_SECONDS:
                    logger.debug("Dropped too-new %s (age %.0fs)", address, float(age_seconds))
                    continue
                if MAX_PAIR_AGE_SECONDS and age_seconds > MAX_PAIR_AGE_SECONDS:
                    logger.debug("Dropped too-old %s (age %.0fs)", address, float(age_seconds))
                    continue

            seen.add(address.lower())
            price_usd = float(pair.get("priceUsd", 0) or 0)
            tokens.append({
                "token_name": token.get("name") or token.get("symbol") or address,
                "token_symbol": token.get("symbol") or "",
                "contract_address": address,
                "volume_24h": volume_h24,
                "price_change_24h": float((pair.get("priceChange") or {}).get("h24", 0) or 0),
                "market_cap": pair.get("marketCap", 0),
                "liquidity_usd": liquidity,
                "fdv": pair.get("fdv", 0),
                "pair_created_at": pair_created,
                "pair_created_age_s": int(age_seconds) if age_seconds is not None else None,
                "price_usd": price_usd,
                "txns_24h": (pair.get("txns") or {}).get("h24") or {},
                "dex_id": pair.get("dexId", ""),
                "chain": pair.get("chainId"),
            })
            if len(tokens) >= BATCH_SIZE:
                return tokens
    return tokens


def build_alpha_payload(token: dict[str, Any]) -> dict[str, Any]:
    """
    Build the enriched payload for Agent B.

    `content` is the dense DEX_ALPHA_SIGNAL line DeepSeek needs. We also keep
    the structured numeric fields so Agent B's dex_context bridge works.
    """
    sym = token.get("token_symbol") or token.get("token_name") or "UNKNOWN"
    addr = token.get("contract_address", "")
    liq = token.get("liquidity_usd", 0) or 0
    vol = token.get("volume_24h", 0) or 0
    price = token.get("price_usd", 0) or 0
    age = token.get("pair_created_at") or token.get("pair_created_age_s") or "unknown"

    content = (
        f"DEX_ALPHA_SIGNAL | Network: Base | Symbol: {sym} | "
        f"Token Address: {addr} | Liquidity USD: ${liq:,.2f} | "
        f"24h Volume USD: ${vol:,.2f} | Pair Age: {age} | Price USD: ${price:,.8f}"
    )

    payload = {
        "source": "agent_a_scout",
        "asset_type": "token",  # Agent B passes this through the GoPlus audit
        "token_name": token.get("token_name"),
        "token_symbol": sym,
        "contract_address": addr,
        "content": content,  # dense signal for DeepSeek
        "volume_24h": vol,
        "price_change_24h": token.get("price_change_24h"),
        "market_cap": token.get("market_cap"),
        "liquidity_usd": liq,
        "fdv": token.get("fdv"),
        "price_usd": price,
        "pair_created_at": token.get("pair_created_at"),
        "pair_created_age_s": token.get("pair_created_age_s"),
        "txns_24h": token.get("txns_24h"),
        "dex_id": token.get("dex_id"),
        "chain": token.get("chain"),
        # Testnet: carry the LLM-generated OSINT narrative for the UI / Agent B.
        "narrative": token.get("_narrative", ""),
        "agent_a_reason": token.get("_narrative", ""),
    }
    return payload


def _load_factory_token() -> dict[str, Any]:
    """STRICT MIRRORING (testnet): read the latest Factory-deployed token.

    The Factory (vault 0xd6d8...79d3) deploys a randomized ERC20 and writes
    {ca, name, ticker} to factory-latest.json (or FACTORY_TOKEN_CA env). Returns
    a fully-formed token dict that Agent A wraps in an LLM narrative -> BUY.
    Falls back to the static A2ZTestToken if no factory output is found.
    """
    import json as _json
    import time as _t
    token_addr = os.getenv("A2Z_TESTNET_TOKEN", "0x49D83283c527A36335a70D70fc11342F4427d162")
    name = os.getenv("A2Z_TESTNET_TOKEN_NAME", "A2ZTestToken")
    ticker = os.getenv("A2Z_TESTNET_TOKEN_TICKER", "A2ZT")
    # Prefer live factory output file (written by scripts/factory.js).
    try:
        with open("factory-latest.json") as _f:
            _d = _json.load(_f)
            token_addr = _d.get("ca", token_addr)
            name = _d.get("name", name)
            ticker = _d.get("ticker", ticker)
    except Exception:
        pass
    now_ms = int(_t.time() * 1000)
    return {
        "token_name": name,
        "token_symbol": ticker,
        "contract_address": token_addr,
        "volume_24h": 25000.0,
        "price_change_24h": 42.0,
        "market_cap": 500000,
        "liquidity_usd": 80000.0,
        "fdv": 500000,
        "pair_created_at": now_ms - 3600 * 1000,
        "pair_created_age_s": 3600,
        "price_usd": 0.00006,
        "txns_24h": {"h24": {"buys": 120, "sells": 30}},
        "dex_id": "uniswap_v2_sepolia",
        "chain": "base_sepolia",
        # Carried-through identity for the LLM narrative step:
        "_factory_name": name,
        "_factory_ticker": ticker,
    }


async def run_cycle() -> None:
    from database import get_system_config
    if get_system_config("circuit_breaker", "active") == "paused":
        logger.info("Circuit breaker is paused. Agent A skipping cycle.")
        return

    _is_testnet = os.getenv("ACTIVE_NETWORK", "base").strip().lower() == "base_sepolia"

    ensure_pipeline_tables()
    async with aiohttp.ClientSession() as session:
        if _is_testnet:
            # === TESTNET MOCK OSINT FEEDER (no mainnet API calls) ===
            # Step 1: ingest the Factory-deployed token identity.
            logger.info("TESTNET MODE: ingesting Factory-deployed token (no DexScreener/Farcaster API)")
            raw = _load_factory_token()
            # Step 2: wrap the CA + name in an LLM-generated OSINT narrative.
            narrative = agent_a_inference.generate_testnet_narrative(
                raw["contract_address"], raw.get("_factory_name", raw["token_name"]),
                raw.get("_factory_ticker", raw["token_symbol"]),
            )
            raw["_narrative"] = narrative
            logger.info("TESTNET narrative: %s", narrative[:120])
            tokens = [raw]
        else:
            # Step 1: newly-created Base token addresses
            addresses = await fetch_new_base_token_addresses(session, limit=BATCH_SIZE * 3)
            if not addresses:
                logger.info("Agent A: no new Base token profiles fetched")
                return

            # Step 2: enrich with pair stats + apply Strict Alpha Filter
            tokens = await fetch_base_pair_stats(session, addresses)
        if not tokens:
            logger.info("Agent A: no Base pairs passed the alpha filter")
            return

        queued = 0
        dropped = 0
        last_latency_ms = 0
        for token in tokens:
            address = token.get("contract_address", "")
            if not _is_valid_evm_address(address):
                dropped += 1
                continue

            payload = build_alpha_payload(token)

            # ---- Agent A LLM extraction + sentiment score (A2Z A2A) ----
            # Soft-fails to mock so a GPU/tunnel outage never blocks the scout.
            try:
                description = payload["content"]
                ai = run_ai_inference(description, address, AI_MODEL)
                payload["agent_a_llm"] = {
                    "score": ai.score,
                    "category": ai.category,
                    "reason": ai.reason,
                    "amount_usd": ai.amount_usd,
                    "model": ai.model,
                    "latency_ms": ai.latency_ms,
                }
                payload["agent_a_passed"] = ai.score >= AGENT_A_LLM_THRESHOLD
                last_latency_ms = ai.latency_ms
                append_audit_log(
                    "agent_a.llm",
                    f"LLM score={ai.score} passed={payload['agent_a_passed']} latency={ai.latency_ms}ms for {address}",
                    {"address": address, "score": ai.score, "model": ai.model, "latency_ms": ai.latency_ms},
                )
                try:
                    await manager.broadcast(
                        json.dumps({
                            "type": "AGENT_LOG",
                            "data": {
                                "sender": "agent_a",
                                "content": (
                                    f"[dexscreener] {token.get('token_symbol')} ({address}) "
                                    f"score={ai.score}/100 cat={ai.category} "
                                    f"liq=${token.get('liquidity_usd')} vol=${token.get('volume_24h')}"
                                ),
                                "metadata": {
                                    "score": ai.score,
                                    "category": ai.category,
                                    "target": address,
                                    "projectName": token.get("token_name"),
                                    "source": "dexscreener",
                                    "liquidity_usd": token.get("liquidity_usd"),
                                    "volume_24h": token.get("volume_24h"),
                                    "latencyMs": ai.latency_ms,
                                    "inferenceMs": ai.latency_ms,
                                    "passed": payload["agent_a_passed"],
                                },
                            },
                        })
                    )
                except Exception:
                    pass
            except Exception as exc:
                logger.warning("Agent A LLM analysis skipped (fallback mock): %s", exc)
                payload["agent_a_llm"] = None
                payload["agent_a_passed"] = None

            queue_id = enqueue_target(
                user_id=DEFAULT_USER_ID,
                source="dexscreener",
                project_name=token.get("token_name") or address,
                target_address=address,
                data_payload=payload,
            )
            if queue_id is not None:
                queued += 1
                append_audit_log("agent_a.enqueued", f"Enqueued {address}", {"queue_id": queue_id})
                try:
                    await manager.broadcast(
                        json.dumps({
                            "type": "AGENT_LOG",
                            "data": {
                                "sender": "agent_a",
                                "content": f"Found new target: {token.get('token_name')} ({address}) via DexScreener Base. Queued for Agent B analysis.",
                                "metadata": {"projectName": token.get("token_name"), "content": payload["content"]},
                            },
                        })
                    )
                except Exception:
                    pass
            else:
                logger.info("Agent A: duplicate skipped %s", address)
        logger.info(
            "Agent A cycle done: queued=%s dropped=%s scanned=%s",
            queued, dropped, len(tokens),
        )
        try:
            await manager.broadcast(json.dumps({
                "type": "AGENT_LOG",
                "data": {
                    "sender": "agent_a",
                    "content": f"Cycle complete: scanned {len(tokens)} Base pairs, queued {queued}, dropped {dropped}.",
                    "metadata": {"scanned": len(tokens), "queued": queued, "dropped": dropped, "latencyMs": last_latency_ms, "inferenceMs": last_latency_ms},
                },
            }))
        except Exception:
            pass


async def main() -> None:
    logger.info("Agent A producer starting")
    await manager.broadcast(json.dumps({
        "type": "AGENT_LOG",
        "data": {
            "sender": "agent_a",
            "content": "Agent A (Scout) online. Scanning Base network (DexScreener) for opportunities...",
            "metadata": {"online": True},
        },
    }))
    await run_cycle()


if __name__ == "__main__":
    asyncio.run(main())
