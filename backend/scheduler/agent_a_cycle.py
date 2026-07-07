"""
Agent A - The Scout (Cycle)
Minimal producer that enqueues discovered targets into scraping_queue.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import aiohttp
from dotenv import load_dotenv

from database import ensure_pipeline_tables, enqueue_target, append_audit_log

load_dotenv()

logger = logging.getLogger("a2z.agent_a")

BATCH_SIZE = int(os.getenv("AGENT_A_BATCH_SIZE", "20"))
DEXSCREENER_SEARCH = os.getenv("AGENT_A_DEX_Q", "base")
NEYNAR_API_KEY = os.getenv("NEYNAR_API_KEY", "")
NEYNAR_CAST_LIMIT = int(os.getenv("AGENT_A_NEYNAR_LIMIT", "3"))
DEFAULT_USER_ID = int(os.getenv("AGENT_A_DEFAULT_USER_ID", "1"))


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
    data = await _get(session, "https://api.dexscreener.com/latest/dex/search", {"q": DEXSCREENER_SEARCH})
    if not data:
        return []
    pairs = data.get("pairs", [])[:BATCH_SIZE]
    tokens: list[dict[str, Any]] = []
    for pair in pairs:
        token = pair.get("baseToken", {})
        tokens.append(
            {
                "token_name": token.get("name") or token.get("address", "Unknown"),
                "contract_address": token.get("address", ""),
                "volume_24h": pair.get("volume", {}).get("h24", 0),
                "price_change_24h": pair.get("priceChange", {}).get("h24", 0),
                "market_cap": pair.get("marketCap", 0),
                "liquidity_usd": pair.get("liquidity", {}).get("usd", 0),
                "chain": pair.get("chainId"),
            }
        )
    return tokens


async def fetch_social_signals(session: aiohttp.ClientSession, token_name: str) -> list[str]:
    if not NEYNAR_API_KEY:
        return []
    data = await _get(
        session,
        "https://api.neynar.com/v2/farcaster/cast/search",
        {"q": token_name, "limit": NEYNAR_CAST_LIMIT},
        timeout=10,
    )
    if not data:
        return []
    return [cast.get("text", "") for cast in data.get("casts", [])]


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
    ensure_pipeline_tables()
    async with aiohttp.ClientSession() as session:
        tokens = await fetch_dexscreener(session)
        if not tokens:
            logger.info("Agent A: no tokens fetched")
            return
        queued = 0
        for token in tokens:
            address = token.get("contract_address", "")
            if not address:
                continue
            signals = await fetch_social_signals(session, token.get("token_name", ""))
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
            else:
                logger.info("Agent A: duplicate skipped %s", address)
        logger.info("Agent A cycle done: queued=%s scanned=%s", queued, len(tokens))


async def main() -> None:
    logger.info("Agent A producer starting")
    await run_cycle()


if __name__ == "__main__":
    asyncio.run(main())
