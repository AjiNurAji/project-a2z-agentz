"""
A2Z Agentz - Agent A (The Scout) — combined v4 + legacy
=========================================================

Pipeline:
  DexScreener (trending) + Basescan (new contracts, optional)
    -> per token: address validation -> social search (X + Telegram)
    -> WARNING keyword? -> blacklist shortcut, skip emit
    -> emit JSON Line ke stdout utk ChromaDB / LLM stage

Usage:
    python agent_a.py
"""

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from apify_client import ApifyClient
from dotenv import load_dotenv

try:
    from web3 import Web3
    HAS_WEB3 = True
except ImportError:
    HAS_WEB3 = False


load_dotenv()


OPPORTUNITY_KEYWORDS = [
    "base network",
    "airdrop",
    "defi",
    "base",
    "new token base",
    "just deployed base",
    "mint live base",
    "fair launch base",
    "stealth launch",
    "farcaster miniapp",
    "base miniapp",
    "buildathon base",
    "early base",
    "base gem",
    "100x base",
    "base alpha",
    "low cap base",
    "mint now base",
    "claim airdrop",
    "whitelist base",
    "free mint base",
]

WARNING_KEYWORDS = [
    "rug base",
    "scam base",
    "honeypot base",
    "avoid base",
    "rugpull",
    "do not buy",
    "warned base",
    "flagged base",
    "drain wallet",
    "fake airdrop",
]


def _resolve_agent_a_limit() -> int:
    raw = os.getenv("AGENT_A_SCRAPER_LIMIT")
    try:
        parsed = int(raw) if raw else 2
        if parsed < 1:
            raise ValueError("must be >= 1")
        return parsed
    except (TypeError, ValueError) as exc:
        print(f"[WARN] Invalid AGENT_A_SCRAPER_LIMIT={raw!r} ({exc}); fallback to 2")
        return 2


LIMIT = _resolve_agent_a_limit()


logger = logging.getLogger("a2z.agent_a")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s a2z.agent_a: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


@dataclass
class ScoutProject:
    project_name: str
    description: str = ""
    target_address: Optional[str] = None
    chain: str = "base"
    source: str = "scout"
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    volume_24h: Optional[float] = None
    price_change_24h: Optional[float] = None
    market_cap: Optional[float] = None
    has_opportunity_signal: bool = False
    total_signals: int = 0

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, separators=(",", ":"))


def normalize_address(raw: Any) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if HAS_WEB3:
        if not Web3.is_address(candidate):
            return None
        try:
            return Web3.to_checksum_address(candidate)
        except (ValueError, TypeError):
            return None
    return candidate if candidate.startswith("0x") and len(candidate) == 42 else None


def fetch_trending_tokens_dexscreener(limit: int = 10) -> list[dict]:
    url = "https://api.dexscreener.com/latest/dex/search"
    response = requests.get(url, params={"q": "base"}, timeout=15)
    response.raise_for_status()
    pairs = response.json().get("pairs", [])
    return [
        {
            "token_name": p.get("baseToken", {}).get("name"),
            "contract_address": p.get("baseToken", {}).get("address"),
            "volume_24h": p.get("volume", {}).get("h24"),
            "price_change_24h": p.get("priceChange", {}).get("h24"),
            "market_cap": p.get("marketCap"),
        }
        for p in pairs[:limit]
    ]


def fetch_new_contracts_basescan(limit: int = 10) -> list[dict]:
    endpoint = os.getenv("AGENT_A_BASESCAN_API", "").strip()
    if not endpoint:
        return []
    try:
        resp = requests.get(endpoint, timeout=10)
        resp.raise_for_status()
        result = resp.json().get("result")
        if not isinstance(result, list):
            return []
        return [
            {
                "token_name": tx.get("contractName") or "unknown",
                "contract_address": tx.get("contractAddress") or tx.get("to"),
                "volume_24h": None,
                "price_change_24h": None,
                "market_cap": None,
            }
            for tx in result[:limit]
            if tx.get("contractAddress") or tx.get("to")
        ]
    except Exception as exc:
        logger.warning("Basescan fetch failed: %s", exc)
        return []


def search_x(keyword: str, max_items: int = 5) -> list[dict]:
    client = ApifyClient(os.getenv("APIFY_API_TOKEN"))
    run = client.actor("apify/twitter-scraper").call(
        run_input={"searchTerms": [keyword], "maxItems": max_items}
    )
    dataset_id = run.default_dataset_id
    items_page = client.dataset(dataset_id).list_items()
    return [
        {
            "platform": "x",
            "text": item.get("text", ""),
            "author": (item.get("author") or {}).get("userName", "unknown"),
        }
        for item in items_page.items
    ]


def search_telegram(keywords: list[str], max_items: int = 5) -> list[dict]:
    client = ApifyClient(os.getenv("APIFY_API_TOKEN"))
    run = client.actor("lofomachines/telegram-keyword-search-scraper").call(
        run_input={
            "mode": "keyword",
            "keywords": keywords if keywords else OPPORTUNITY_KEYWORDS,
            "maxItems": max_items,
        }
    )
    dataset_id = run.default_dataset_id
    items_page = client.dataset(dataset_id).list_items()
    return [
        {
            "platform": "telegram",
            "text": item.get("text", ""),
            "author": (item.get("sender") or {}).get("username", "unknown"),
        }
        for item in items_page.items
    ]


def run_scout_cycle() -> None:
    started = time.time()
    logger.info("Agent A pipeline start | limit=%d", LIMIT)

    dex_tokens = fetch_trending_tokens_dexscreener(limit=LIMIT)
    bs_tokens = fetch_new_contracts_basescan(limit=LIMIT)
    all_tokens = dex_tokens + bs_tokens
    logger.info("Fetched %d tokens (%d DexScreener + %d Basescan)",
                len(all_tokens), len(dex_tokens), len(bs_tokens))

    emitted = 0
    warning_shortcut = 0
    invalid = 0

    for token in all_tokens:
        token_name = token.get("token_name")
        contract = token.get("contract_address")

        if not token_name:
            continue

        checksum = normalize_address(contract) if contract else None
        if contract and checksum is None:
            invalid += 1
            logger.warning("Invalid address for %s: %s", token_name, contract)
            continue

        all_mentions = (
            search_x(token_name, max_items=5)
            + search_telegram([token_name], max_items=5)
        )
        all_texts = " ".join([m["text"].lower() for m in all_mentions])

        is_warning = any(w.lower() in all_texts for w in WARNING_KEYWORDS)
        if is_warning:
            warning_shortcut += 1
            logger.info("[WARNING] %s — blacklisting, skip emit", token_name)
            continue

        has_opportunity = any(o.lower() in all_texts for o in OPPORTUNITY_KEYWORDS)

        project = ScoutProject(
            project_name=token_name,
            description=f"vol_24h={token.get('volume_24h')}",
            target_address=checksum,
            volume_24h=token.get("volume_24h"),
            price_change_24h=token.get("price_change_24h"),
            market_cap=token.get("market_cap"),
            has_opportunity_signal=has_opportunity,
            total_signals=len(all_mentions),
        )
        print(project.to_json(), flush=True)
        emitted += 1

    duration = round(time.time() - started, 3)
    summary = {
        "status": "ok",
        "fetched": len(all_tokens),
        "invalid_address": invalid,
        "warning_shortcut_blacklist": warning_shortcut,
        "emitted": emitted,
        "duration_seconds": duration,
    }
    logger.info("Agent A pipeline done | %s", json.dumps(summary))


def main() -> None:
    run_scout_cycle()


if __name__ == "__main__":
    main()