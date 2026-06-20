"""
A2Z Agentz - Agent A (The Scout): Data Scraper & Filter
=========================================================

Upstream pipeline stage that:
  1. Scrapes / fetches candidate Base-Network airdrop & Web3 projects.
  2. Validates and checksum-normalizes the on-chain target address.
  3. Filters out any address already marked BLACKLISTED in PostgreSQL
     (reuses ``database.is_blacklisted`` so Agent A and Agent B share a
     single source of truth on blacklist semantics).
  4. Emits the surviving candidates as JSON Lines on stdout, ready to be
     piped into the ChromaDB embedding + SGLang/Llama-3 inference stages.

This script is intended to be invoked by a Cron Job, e.g.:

    */5 * * * * cd /home/ubuntu/project-a2z-agentz && \
        /home/ubuntu/project-a2z-agentz/venv/bin/python agent_a_scraper.py \
            --source mock --limit 25 \
            >> /home/ubuntu/project-a2z-agentz/logs/agent_a.out 2>&1

Env:
    POSTGRES_URI          - libpq DSN (loaded by ``database.py``)
    AGENT_A_FARCASTER_API - optional Farcaster/Neynar endpoint
    AGENT_A_BASESCAN_API  - optional Basescan endpoint
    AGENT_A_USE_MOCK=1    - force mock data even if real endpoints are set

Dependencies (all already pinned in requirements.txt):
    requests, web3, psycopg2-binary
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Iterable, Iterator, Optional

import requests
try:
    from web3 import Web3
    HAS_WEB3 = True
except ImportError:
    HAS_WEB3 = False

# Reuse the project's existing DB layer so Agent A and Agent B cannot drift
# on blacklist semantics.  ``is_blacklisted`` is what Agent B uses
# (fail-closed: returns True on DB error so we never green-light a trade
# we couldn't verify).  ``get_target_status`` is the rich helper that
# lets Agent A distinguish "actually blacklisted" from "DB unreachable"
# and log the exact bypass message the spec requires.
from database import get_target_status, is_blacklisted


# ----------------------------------------------------------------------------
# Logger (matches existing a2z.db / a2z.web3 log format)
# ----------------------------------------------------------------------------
logger = logging.getLogger("a2z.agent_a")
if not logger.handlers:
    _h = logging.StreamHandler()  # stderr — keeps stdout clean for JSON Lines
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s a2z.agent_a: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


# ----------------------------------------------------------------------------
# Data model
# ----------------------------------------------------------------------------
@dataclass
class AirdropProject:
    """Raw project record as produced by the scraper layer."""

    project_name: str
    description: str
    target_address: str  # will be checksum-normalized before emission
    source: str = "unknown"           # "farcaster" | "basescan" | "mock"
    chain: str = "base"                # Base Network (chain id 8453)
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_json(self) -> str:
        """Serialize to a single-line JSON string for stdout piping."""
        return json.dumps(asdict(self), ensure_ascii=False, separators=(",", ":"))


# ----------------------------------------------------------------------------
# Scrapers — every source degrades gracefully to mock data so a Cron Job
# never silently dies when an upstream API is down.
# ----------------------------------------------------------------------------
def _safe_get(url: str, *, timeout: float = 5.0, headers: Optional[dict] = None) -> Optional[dict]:
    """Best-effort GET. Returns parsed JSON or None on any failure."""
    try:
        resp = requests.get(url, timeout=timeout, headers=headers or {})
        resp.raise_for_status()
        return resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("HTTP fetch failed for %s: %s — falling back to mock.", url, exc)
        return None


def fetch_from_farcaster(limit: int) -> list[AirdropProject]:
    """Pull recent airdrop-tagged casts from a Farcaster/Neynar-style endpoint."""
    endpoint = os.getenv("AGENT_A_FARCASTER_API", "").strip()
    if not endpoint:
        logger.info("AGENT_A_FARCASTER_API not set; using mock Farcaster feed.")
        return _mock_farcaster_feed(limit)

    payload = _safe_get(endpoint)
    if not payload:
        return _mock_farcaster_feed(limit)

    out: list[AirdropProject] = []
    # Defensive parsing — real-world responses vary across API versions.
    casts = (payload.get("result") or {}).get("casts") or payload.get("casts") or []
    for cast in casts[:limit]:
        text = (cast.get("text") or "").strip()
        addr = _extract_eth_address(text)
        if not addr:
            continue
        out.append(
            AirdropProject(
                project_name=(cast.get("author") or {}).get("display_name") or "unknown",
                description=text[:280],
                target_address=addr,
                source="farcaster",
            )
        )
    if not out:
        logger.info("Farcaster feed returned no usable casts; falling back to mock.")
        return _mock_farcaster_feed(limit)
    return out


def fetch_from_basescan(limit: int) -> list[AirdropProject]:
    """Pull recent Base-Network contract creations from a Basescan-style endpoint."""
    endpoint = os.getenv("AGENT_A_BASESCAN_API", "").strip()
    if not endpoint:
        logger.info("AGENT_A_BASESCAN_API not set; using mock Basescan feed.")
        return _mock_basescan_feed(limit)

    payload = _safe_get(endpoint)
    if not payload:
        return _mock_basescan_feed(limit)

    out: list[AirdropProject] = []
    # Defensive parsing — Basescan v2 API uses "result" (list or string-on-error).
    result = payload.get("result")
    if isinstance(result, list):
        for tx in result[:limit]:
            addr = tx.get("contractAddress") or tx.get("to")
            if not addr:
                continue
            out.append(
                AirdropProject(
                    project_name=tx.get("contractName") or "unknown",
                    description=(tx.get("tokenSymbol") or "BASE") + " contract deployment",
                    target_address=addr,
                    source="basescan",
                )
            )
    if not out:
        logger.info("Basescan feed returned no usable entries; falling back to mock.")
        return _mock_basescan_feed(limit)
    return out


# ----------------------------------------------------------------------------
# Mock data sources — deterministic enough to be useful for cron-test runs,
# but include (a) one bad address to exercise the validation skip path and
# (b) one known-blacklisted address to exercise the bypass path.
# ----------------------------------------------------------------------------
def _mock_farcaster_feed(limit: int) -> list[AirdropProject]:
    seed = [
        ("BasePaint",     "Free mint window is open for BasePaint genesis collectors.",  "0x4297bb1E8f29C84cA9F0b3cA6e1e5c7b9d3a1F22"),
        ("Virtuals",      "Early agent NFT airdrop claim — Virtuals Protocol on Base.",   "0x9eC8C5Ad6F7aC0db7d6f2c3F8e2D0Bf1c4A7D9E3"),
        # intentionally invalid (too short) — must be skipped by validator
        ("BrokenCast",    "this record has a malformed address",                           "0x1234"),
        # known-blacklisted sentinel — must be bypassed by DB filter
        ("BlacklistedCo", "looks fine but is in our blacklist table",                       "0x000000000000000000000000000000000000dEaD"),
        ("Aerodrome",     "ve(3,3) incentives campaign for new gauges.",                   "0x940181a94A35A4569E4529A3CDfB74e38FD98631"),
    ]
    out: list[AirdropProject] = []
    for i in range(limit):
        name, desc, addr = seed[i % len(seed)]
        out.append(AirdropProject(project_name=f"{name} #{i + 1}", description=desc,
                                  target_address=addr, source="mock-farcaster"))
    return out


def _mock_basescan_feed(limit: int) -> list[AirdropProject]:
    seed = [
        ("FriendTech",   "Social-graph keys v2 contract",       "0xCF205808Ed36593aa40a44F10c1f55a1873319c7"),
        ("Zora",         "Zora drops registry on Base",         "0x9d8bB7e7d8d6F7aC0db7d6f2c3F8e2D0Bf1c4A7D9"),
    ]
    out: list[AirdropProject] = []
    for i in range(limit):
        name, desc, addr = seed[i % len(seed)]
        out.append(AirdropProject(project_name=f"{name} #{i + 1}", description=desc,
                                  target_address=addr, source="mock-basescan"))
    return out


def _extract_eth_address(text: str) -> Optional[str]:
    """Best-effort: pull the first 0x-prefixed 40-hex-char token out of free text."""
    import re
    m = re.search(r"0x[a-fA-F0-9]{40}", text or "")
    return m.group(0) if m else None


# ----------------------------------------------------------------------------
# Web3 validation
# ----------------------------------------------------------------------------
def normalize_address(raw: str) -> Optional[str]:
    """
    Validate and checksum-normalize an EVM address.
    Returns the EIP-55 checksum string on success, None on failure.
    Pure crypto — does NOT need an RPC connection.
    """
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
    else:
        if candidate.startswith("0x") and len(candidate) == 42:
            return candidate
        return None


# ----------------------------------------------------------------------------
# Pipeline orchestration
# ----------------------------------------------------------------------------
def scrape_projects(source: str, limit: int) -> list[AirdropProject]:
    """Dispatch to the chosen scraper."""
    if source == "farcaster":
        return fetch_from_farcaster(limit)
    if source == "basescan":
        return fetch_from_basescan(limit)
    if source == "mock":
        # Combine both mock feeds so the cron test exercises both shapes.
        return _mock_farcaster_feed(limit) + _mock_basescan_feed(limit // 2 or 1)
    raise ValueError(f"Unknown source: {source!r}")


def run_pipeline(source: str, limit: int, dry_run: bool) -> dict:
    """
    Fetch → validate → blacklist-filter → emit.

    Returns a small summary dict (for cron log inspection / monitoring).
    """
    started = time.time()
    logger.info("Agent A pipeline start | source=%s limit=%d dry_run=%s",
                source, limit, dry_run)

    try:
        raw_projects = scrape_projects(source, limit)
    except Exception as exc:
        logger.error("Scraper crashed: %s", exc)
        return {"status": "scraper_error", "error": str(exc)}

    logger.info("Scraped %d candidate projects.", len(raw_projects))

    validated = 0
    blacklisted = 0
    emitted = 0
    invalid = 0

    for project in raw_projects:
        # ---- Stage 2: Web3 validation ----
        checksum = normalize_address(project.target_address)
        if checksum is None:
            invalid += 1
            logger.warning(
                "Invalid target_address for project=%s (raw=%r) — skipping.",
                project.project_name, project.target_address,
            )
            continue
        project.target_address = checksum
        validated += 1

        # ---- Stage 3: Blacklist bypass ----
        if not dry_run:
            try:
                status = get_target_status(checksum)
            except Exception as exc:
                # DB error — fail CLOSED (skip).  is_blacklisted() would
                # have done the same thing implicitly; we do it explicitly
                # here so the operator can see the real reason in the log.
                logger.error(
                    "DB unavailable, cannot verify %s — failing closed. reason=%s",
                    checksum, exc,
                )
                blacklisted += 1
                continue

            if isinstance(status, str) and status.strip().upper() == "BLACKLISTED":
                blacklisted += 1
                # Spec-mandated log message format:
                logger.info(
                    "Address %s is blacklisted. Bypassing project %s...",
                    checksum, project.project_name,
                )
                continue
            # status is None (address not in table) or some non-blacklist
            # status (e.g. 'active', 'pending') → safe to emit downstream.
        else:
            logger.info("[dry-run] skipping blacklist check for %s", checksum)

        # ---- Stage 4: Emit clean JSON to stdout (one object per line) ----
        print(project.to_json(), flush=True)
        emitted += 1

    duration = round(time.time() - started, 3)
    summary = {
        "status": "ok",
        "source": source,
        "scraped": len(raw_projects),
        "validated": validated,
        "invalid": invalid,
        "blacklisted_bypassed": blacklisted,
        "emitted": emitted,
        "duration_seconds": duration,
    }
    logger.info("Agent A pipeline done | %s", json.dumps(summary))
    return summary


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Agent A (The Scout) — Base Network airdrop scraper + blacklist filter.",
    )
    p.add_argument(
        "--source",
        choices=["mock", "farcaster", "basescan"],
        default=os.getenv("AGENT_A_SOURCE", "mock"),
        help="Data source (default: mock).",
    )
    p.add_argument(
        "--limit", type=int, default=10,
        help="Max projects to fetch per source per run (default: 10).",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Skip the PostgreSQL blacklist lookup (useful for local testing).",
    )
    return p.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)

    # Honor explicit opt-out via env var even if --source wasn't given.
    if os.getenv("AGENT_A_USE_MOCK") == "1" and args.source != "mock":
        logger.info("AGENT_A_USE_MOCK=1 — overriding --source=%s to 'mock'.", args.source)
        args.source = "mock"

    try:
        summary = run_pipeline(args.source, args.limit, args.dry_run)
    except Exception as exc:
        logger.exception("Fatal error in Agent A pipeline: %s", exc)
        return 2

    # Non-zero exit if nothing survived the filter — alerts the cron operator.
    return 0 if summary.get("emitted", 0) > 0 else 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())