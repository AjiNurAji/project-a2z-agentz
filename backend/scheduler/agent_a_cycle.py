"""
Agent A - The Scout (Cycle)
==============================

Minimal producer that enqueues discovered targets into ``scraping_queue``.

Responsibilities
----------------
1. Fetch Base-network token candidates from DexScreener
   (strictly filtered by ``chainId == "base"``).
2. Optionally enrich with Farcaster social signals via the Neynar V2 API
   (using the official ``x-api-key`` header, performing a graceful
   ``sleep -> retry`` on HTTP 429).
3. Validate every candidate address with the strict EVM regex
   ``^0x[a-fA-F0-9]{40}$`` before pushing it to the queue.
   Any non-Base / non-EVM / non-zero-address match is dropped with a
   DEBUG log and never touches Agent B.

Cross-system contract
---------------------
- Output rows are persisted via ``database.enqueue_target`` into the
  ``scraping_queue`` table (see ``database_schema_v2.sql``).
- The next stage (``backend/scheduler/agent_b_cycle.py``) consumes
  these rows and runs the GoPlus + AI gatekeeping pipeline.

Environment
-----------
``AGENT_A_BATCH_SIZE``           Max rows to consider per cycle (default 20).
``AGENT_A_DEX_Q``                DexScreener free-text search query (default "base").
``NEYNAR_API_KEY``               Neynar V2 API key. When empty, social signals are skipped.
``AGENT_A_NEYNAR_LIMIT``         Cast count to fetch per cycle (default 3 -- free tier safe).
``NEYNAR_RETRY_BACKOFF_SECONDS`` Base backoff seconds for HTTP 429 retries (default 5).
``NEYNAR_MAX_RETRIES``           Max retries against the Neynar API (default 2).
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

load_dotenv()

logger = logging.getLogger("a2z.agent_a")

BATCH_SIZE = int(os.getenv("AGENT_A_BATCH_SIZE", "20"))
DEXSCREENER_SEARCH = os.getenv("AGENT_A_DEX_Q", "base")
NEYNAR_API_KEY = os.getenv("NEYNAR_API_KEY", "")
NEYNAR_CAST_LIMIT = int(os.getenv("AGENT_A_NEYNAR_LIMIT", "3"))
NEYNAR_MAX_RETRIES = int(os.getenv("NEYNAR_MAX_RETRIES", "2"))
NEYNAR_BACKOFF_SECONDS = float(os.getenv("NEYNAR_RETRY_BACKOFF_SECONDS", "5"))
DEFAULT_USER_ID = int(os.getenv("AGENT_A_DEFAULT_USER_ID", "1"))

# Strict Base Network / EVM contract address gatekeeper.
# Anything not matching this regex is dropped before reaching Agent B.
_EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_BASE_CHAIN_ID = "base"  # DexScreener returns this as the chainId string for Base.


def _is_valid_evm_address(address: str | None) -> bool:
    """Return True only for strict 0x-prefixed 40-hex EVM addresses."""
    if not address or not isinstance(address, str):
        return False
    return bool(_EVM_ADDRESS_RE.match(address.strip()))


async def _get(session: aiohttp.ClientSession, url: str, params: dict[str, Any] | None = None, timeout: int = 10) -> dict[str, Any] | None:
    try:
        async with session.get(url, params=params, timeout=timeout) as resp:
            if resp.status == 200:
                return await resp.json()
            logger.warning("Agent A upstream %s -> %s", url, resp.status)
            return None
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Agent A upstream fetch failed %s: %s", url, exc)
        return None


async def fetch_dexscreener(session: aiohttp.ClientSession) -> list[dict[str, Any]]:
    """
    Fetch DexScreener pairs and strictly filter to ``chainId == "base"``.

    The DexScreener API returns pairs from many chains (solana, ethereum,
    bsc, ...). The Agent B pipeline only consumes Base contracts, so any
    non-Base pair is dropped at the source.
    """
    data = await _get(session, "https://api.dexscreener.com/latest/dex/search", {"q": DEXSCREENER_SEARCH})
    if not data:
        return []
    raw_pairs = data.get("pairs", []) or []
    tokens: list[dict[str, Any]] = []
    seen_addresses: set[str] = set()
    for pair in raw_pairs:
        chain_id = pair.get("chainId")
        if chain_id != _BASE_CHAIN_ID:
            # Drop solana / ethereum / bsc / non-Base pairs outright.
            continue
        token = pair.get("baseToken", {}) or {}
        address = (token.get("address") or "").strip()
        if not address:
            continue
        # Ensure an extra layer of defense: drop anything that doesn't
        # look like a strict EVM contract address.
        if not _is_valid_evm_address(address):
            logger.debug("Dropped non-Base address: %s", address)
            continue
        # Dedup within the same DexScreener response.
        if address.lower() in seen_addresses:
            continue
        seen_addresses.add(address.lower())
        tokens.append(
            {
                "token_name": token.get("name") or token.get("address", "Unknown"),
                "contract_address": address,
                "volume_24h": (pair.get("volume") or {}).get("h24", 0),
                "price_change_24h": (pair.get("priceChange") or {}).get("h24", 0),
                "market_cap": pair.get("marketCap", 0),
                "liquidity_usd": (pair.get("liquidity") or {}).get("usd", 0),
                "chain": chain_id,
            }
        )
        if len(tokens) >= BATCH_SIZE:
            break
    return tokens


async def fetch_recent_channel_casts(
    session: aiohttp.ClientSession,
    channel_id: str = "base",
    limit: int = 50,
) -> list[str]:
    """
    Fetch recent casts from the Neynar V2 API, with graceful HTTP 429 retry.

    Uses the official V2 endpoint and the ``x-api-key`` header per
    https://docs.neynar.com/reference/quickstart. On Free-tier 429s the
    request is retried after ``NEYNAR_BACKOFF_SECONDS`` up to
    ``NEYNAR_MAX_RETRIES`` times instead of crashing the cycle.
    """
    if not NEYNAR_API_KEY:
        return []
    # Official Neynar V2 auth header. Drafted from the public quickstart.
    headers = {"x-api-key": NEYNAR_API_KEY, "accept": "application/json"}
    url = (
        "https://api.neynar.com/v2/farcaster/feed/channels"
        f"?channel_ids={channel_id}&limit={limit}"
    )
    attempt = 0
    while True:
        try:
            async with session.get(url, headers=headers, timeout=10) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    casts = data.get("casts", []) if isinstance(data, dict) else []
                    return [str(cast.get("text", "") or "") for cast in casts]
                if resp.status == 429 and attempt < NEYNAR_MAX_RETRIES:
                    backoff = NEYNAR_BACKOFF_SECONDS * (attempt + 1)
                    logger.warning(
                        "Agent A Neynar rate-limited (429). Sleeping %.1fs before retry %d/%d",
                        backoff, attempt + 1, NEYNAR_MAX_RETRIES,
                    )
                    await asyncio.sleep(backoff)
                    attempt += 1
                    continue
                logger.warning("Agent A Neynar channels fetch failed -> %s", resp.status)
                return []
        except Exception as exc:
            logger.warning("Agent A Neynar channels fetch error: %s", exc)
            return []


def _is_opportunity(signals: list[str]) -> bool:
    keywords = [
        "airdrop",
        "mint",
        "fair launch",
        "launch",
        "new token",
        "claim",
        "deployed",
        "base",
    ]
    text = " ".join(signals).lower()
    return any(keyword in text for keyword in keywords)


async def run_cycle() -> None:
    from database import get_system_config
    if get_system_config("circuit_breaker", "active") == "paused":
        logger.info("Circuit breaker is paused. Agent A skipping cycle.")
        return

    ensure_pipeline_tables()
    async with aiohttp.ClientSession() as session:
        tokens = await fetch_dexscreener(session)
        if not tokens:
            logger.info("Agent A: no tokens fetched")
            return
        
        # Fetch Farcaster feed ONCE per cycle using the free endpoint
        recent_casts = await fetch_recent_channel_casts(session, channel_id="base", limit=50)

        queued = 0
        dropped = 0
        for token in tokens:
            address = token.get("contract_address", "")
            # Strict EVM gatekeeper: never ever queue non-EVM addresses.
            # This protects Agent B from pump.fun / solana junk addresses.
            if not _is_valid_evm_address(address):
                logger.debug("Dropped non-Base address: %s", address)
                dropped += 1
                continue
            
            token_name = (token.get("token_name") or "").lower()
            # Filter the cached casts for mentions of this token
            signals = []
            if token_name:
                signals = [cast for cast in recent_casts if token_name in cast.lower()]
            payload = {
                "source": "agent_a_scout",
                "token_name": token.get("token_name"),
                "contract_address": address,
                "volume_24h": token.get("volume_24h"),
                "price_change_24h": token.get("price_change_24h"),
                "market_cap": token.get("market_cap"),
                "liquidity_usd": token.get("liquidity_usd"),
                "chain": token.get("chain"),
                "social_signals": signals,
                "opportunity": _is_opportunity(signals),
            }
            queue_id = enqueue_target(
                user_id=DEFAULT_USER_ID,
                source="farcaster",
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
                                "content": f"Found new target: {token.get('token_name')} ({address}) via DexScreener. Queued for Agent B analysis.",
                                "metadata": {"projectName": token.get("token_name")}
                            }
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


async def main() -> None:
    logger.info("Agent A producer starting")
    await run_cycle()


if __name__ == "__main__":
    asyncio.run(main())
