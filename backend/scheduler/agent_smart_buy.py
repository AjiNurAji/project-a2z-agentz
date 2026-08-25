"""P-OpsiA: Smart Buy Engine worker.

Polls PENDING smart-buy orders (LLM-driven limit buys). For each open order:
  1. Expire orders past `expires_at` (guardrail: capital not stuck forever).
  2. Fetch the token's live USD price (DexScreener).
  3. If live price <= target_entry_usd -> execute a MARKET buy via
     swap_eth_for_token (amount locked at order creation). The fill happens at
     the current market price, which by definition is <= the LLM's target.
  4. Record the REAL executed price (anti-hallucination audit trail).

Idempotent: status flips PENDING -> EXECUTED atomically; a crashed worker
re-polls and skips already-resolved orders.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone

import aiohttp

from database import (
    fetch_smart_buy_orders_open,
    expire_smart_buy_orders,
    mark_smart_buy_executed,
)
from lib.dexscreener import get_price_usd
from web3_async import swap_eth_for_token, _usd_to_wei_real

logger = logging.getLogger("a2z.smart_buy")

# Poll cadence (seconds). 30s keeps RPC cost low while reacting fast enough
# for a 4h-window limit order.
POLL_INTERVAL = int(os.getenv("SMART_BUY_POLL_INTERVAL", "30"))
# Hard safety cap on concurrent buys per poll cycle (avoid RPC stampede).
MAX_FILLS_PER_CYCLE = int(os.getenv("SMART_BUY_MAX_FILLS_PER_CYCLE", "5"))
# Reject hallucinated targets: live price must be within this factor of target.
# If target > live * (1+SLIP), the LLM likely hallucinated a lower price -> skip.
ANTI_HALLU_FACTOR = float(os.getenv("SMART_BUY_ANTI_HALLU_FACTOR", "0.5"))


async def _try_fill(order: dict) -> None:
    """Attempt to fill one PENDING smart-buy order at market if price is right."""
    order_id = order["id"]
    token = order["token_address"]
    target = float(order["target_entry_usd"] or 0)
    amount_wei = int(order["amount_wei"] or 0)
    if target <= 0 or amount_wei <= 0:
        return

    try:
        live = await get_price_usd(token)
    except Exception as exc:
        logger.warning("smart-buy price fetch failed order=%s: %s", order_id, exc)
        return

    if live <= 0:
        logger.debug("smart-buy no price order=%s (skipped)", order_id)
        return

    # Anti-hallucination guard: if the LLM target is far BELOW live price
    # (e.g. target $0.0001 but live $0.01), the target is nonsensical -> skip
    # this cycle (do NOT buy at 100x the intended entry). The order can still
    # fill later if price legitimately drops, or expires.
    if target < live * ANTI_HALLU_FACTOR:
        logger.info(
            "smart-buy SKIP (hallucinated target) order=%s target=$%.8f live=$%.8f",
            order_id, target, live,
        )
        return

    if live > target:
        # Not yet at entry. Wait for next poll.
        return

    # Price at/below target -> market buy now (fill <= target by definition).
    logger.info("smart-buy FILL order=%s token=%s live=$%.8f target=$%.8f", order_id, token, live, target)
    try:
        swap_res = await swap_eth_for_token(token, amount_wei, chain_id=8453)
        tx_hash = swap_res.get("tx_hash") or swap_res.get("tx_hash_id")
        if not tx_hash:
            raise RuntimeError(f"swap returned no tx_hash: {swap_res}")
        # Executed price = real per-token cost from receipt when available,
        # else fall back to the live trigger price.
        executed_price = float(swap_res.get("executed_price_usd") or live)
        ok = mark_smart_buy_executed(order_id, tx_hash, executed_price)
        if ok:
            logger.info("smart-buy EXECUTED order=%s tx=%s price=$%.8f", order_id, tx_hash, executed_price)
        else:
            logger.warning("smart-buy mark_executed failed (race?) order=%s tx=%s", order_id, tx_hash)
    except Exception as exc:
        # Fail-closed: leave order PENDING so the next cycle retries (unless expired).
        logger.error("smart-buy FILL failed order=%s: %s", order_id, exc)


async def run_smart_buy_cycle() -> None:
    """One poll cycle: expire stale, then attempt fills (bounded)."""
    try:
        expired = expire_smart_buy_orders()
        if expired:
            logger.info("smart-buy expired %d stale order(s)", expired)
    except Exception as exc:
        logger.error("smart-buy expire step failed: %s", exc)

    try:
        open_orders = fetch_smart_buy_orders_open()
    except Exception as exc:
        logger.error("smart-buy fetch open failed: %s", exc)
        return

    if not open_orders:
        return

    # Bound concurrent fills to avoid RPC/nonce stampede.
    tasks = [_try_fill(o) for o in open_orders[:MAX_FILLS_PER_CYCLE]]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def run_smart_buy_daemon() -> None:
    """Long-running loop. Guarded by caller (agent_runner) for serverless."""
    logger.info("smart-buy daemon started (poll=%ds)", POLL_INTERVAL)
    while True:
        try:
            await run_smart_buy_cycle()
        except Exception as exc:
            logger.exception("smart-buy cycle crashed (continuing): %s", exc)
        await asyncio.sleep(POLL_INTERVAL)


def run_smart_buy_once() -> None:
    """Synchronous entry for a single cycle (cron / serverless friendly)."""
    asyncio.run(run_smart_buy_cycle())
