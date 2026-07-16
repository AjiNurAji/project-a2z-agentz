"""Shared DexScreener client with batch fetch + TTL cache.

Used by /api/holdings (live P&L) and the Agent B limit-order worker so we
only ever hit DexScreener once per token per cache window (rate-limit safe).
"""
from __future__ import annotations

import asyncio
import time
from typing import Dict, Optional

import httpx

_BASE = "https://api.dexscreener.com/latest/dex/tokens"
_CACHE_TTL = 12.0  # seconds — DexScreener data is near-real-time; 12s is gentle
_cache: Dict[str, tuple[float, float]] = {}  # addr_lower -> (ts, price_usd)
_lock = asyncio.Lock()


async def get_price_usd(token_address: str, timeout: float = 8.0) -> float:
    """Return the live USD price for one token (0.0 if unknown/unavailable)."""
    addr = token_address.lower()
    now = time.monotonic()
    cached = _cache.get(addr)
    if cached and (now - cached[0]) < _CACHE_TTL:
        return cached[1]
    # Batch of one reuses the same batch path (keeps a single code path).
    prices = await get_prices_usd([token_address], timeout=timeout)
    return prices.get(addr, 0.0)


async def get_prices_usd(token_addresses: list[str], timeout: float = 10.0) -> Dict[str, float]:
    """Fetch live USD prices for MANY tokens in a single DexScreener call.

    DexScreener's ``/tokens/{addr1,addr2,...}`` endpoint accepts a
    comma-separated list and returns all pairs in one response, so we batch
    to minimise HTTP round-trips (rate-limit safe for the worker + API).
    Returns {address_lower: price_usd}. Falls back to cache / 0.0 on error.
    """
    if not token_addresses:
        return {}
    now = time.monotonic()
    # Serve everything we can from cache first; only fetch the misses.
    out: Dict[str, float] = {}
    missing: list[str] = []
    for a in token_addresses:
        al = a.lower()
        c = _cache.get(al)
        if c and (now - c[0]) < _CACHE_TTL:
            out[al] = c[1]
        else:
            missing.append(a)
    if not missing:
        return out

    async with _lock:
        # Re-check cache after acquiring lock (another coroutine may have filled).
        for a in list(missing):
            al = a.lower()
            c = _cache.get(al)
            if c and (time.monotonic() - c[0]) < _CACHE_TTL:
                out[al] = c[1]
                missing.remove(a)
        if not missing:
            return out

        joined = ",".join(missing)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(f"{_BASE}/{joined}")
            if resp.status_code == 200:
                data = resp.json()
                pairs = data.get("pairs") or [] if isinstance(data, dict) else []
                # Pick the most-liquid base/quote pair per token.
                best: Dict[str, tuple[float, float]] = {}  # addr -> (liquidity, price)
                for p in pairs:
                    try:
                        base = (p.get("baseToken") or {}).get("address", "").lower()
                        price = float(p.get("priceUsd") or 0)
                        liq = float((p.get("liquidity") or {}).get("usd") or 0)
                    except (TypeError, ValueError):
                        continue
                    if not base or price <= 0:
                        continue
                    if base not in best or liq > best[base][0]:
                        best[base] = (liq, price)
                for base, (_liq, price) in best.items():
                    _cache[base] = (time.monotonic(), price)
                    out[base] = price
        except Exception as exc:
            # On failure, return whatever we have (cache hits) + 0.0 for misses.
            import logging
            logging.getLogger("a2z.dexscreener").warning("DexScreener batch fetch failed: %s", exc)
        return out
