"""
A2Z Agentz - Async Multi-RPC Web3 Client (v2)

Lives alongside the legacy sync signing logic now consolidated in this file so
we don't break the existing auth backend. Agent B uses the MultiRpcProvider
below.

Design:
    MultiRpcProvider rotates through BASE_RPC_1, BASE_RPC_2, BASE_RPC_3
    on every RPC failure. Fail count thresholds demote an endpoint and
    raise the next one to the front of the queue. After max_fails the
    endpoint is suspended for cooldown_s; new calls try other endpoints
    first.

    The class is intentionally thin: rotation only. Higher-level Gnosis
    Safe operations live in `GnosisSafeClient`.

Env:
    BASE_RPC_1, BASE_RPC_2, BASE_RPC_3   - JSON-RPC endpoints for Base (8453)
    BASE_CHAIN_ID                        - default 8453
    GNOSIS_SAFE_API_URL                  - Safe Transaction Service base URL
"""

from __future__ import annotations

import asyncio
import json as _json
import logging
import os
import random
import time
from typing import Any, Optional

import aiohttp

logger = logging.getLogger("a2z.web3_async")

BASE_CHAIN_ID: int = int(os.environ.get("BASE_CHAIN_ID", "8453"))
DEFAULT_TIMEOUT: float = float(os.environ.get("BASE_RPC_TIMEOUT", "10"))
RPC_ID = 1  # JSON-RPC id field

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class AllRpcEndpointsFailed(RuntimeError):
    """Raised when every configured RPC endpoint has failed."""


class RpcEndpoint:
    """Single RPC endpoint with suspension bookkeeping."""

    __slots__ = ("url", "fail_count", "suspended_until", "label")

    def __init__(self, url: str, label: str) -> None:
        self.url = url
        self.label = label
        self.fail_count: int = 0
        self.suspended_until: float = 0.0

    def is_available(self, now: float) -> bool:
        return self.suspended_until <= now

    def suspend(self, cooldown_s: float, now: float) -> None:
        self.suspended_until = now + cooldown_s
        logger.warning(
            "suspended RPC endpoint %s until +%.1fs (%d total failures)",
            self.label, cooldown_s, self.fail_count,
        )

    def __repr__(self) -> str:
        return f"<RpcEndpoint {self.label} fails={self.fail_count}>"


# ---------------------------------------------------------------------------
# Multi-RPC rotator
# ---------------------------------------------------------------------------

class MultiRpcProvider:
    """
    Dynamically rotates between BASE_RPC_1/2/3.

    Behaviour:
        * On success: reset fail_count on that endpoint.
        * On failure: increment fail_count, suspend for backoff_s after
          max_fail_threshold consecutive failures, try the next available
          endpoint on the same call.
        * If every endpoint is exhausted, raise AllRpcEndpointsFailed.
    """

    def __init__(
        self,
        rpc_urls: Optional[list[str]] = None,
        *,
        chain_id: int = BASE_CHAIN_ID,
        timeout: float = DEFAULT_TIMEOUT,
        backoff_ms: int = 5_000,
        max_fail_threshold: int = 5,
    ) -> None:
        urls = rpc_urls if rpc_urls is not None else self._load_default_urls()
        if not urls:
            raise RuntimeError(
                "No RPC endpoints configured. Set BASE_RPC_1/2/3 in env."
            )

        self.chain_id = chain_id
        self.timeout = timeout
        self.backoff_s = backoff_ms / 1000.0
        self.max_fail_threshold = max_fail_threshold

        self._endpoints: list[RpcEndpoint] = [
            RpcEndpoint(url, label=f"RPC#{i+1}") for i, url in enumerate(urls)
        ]
        # Slight shuffle to break ties between deployments
        random.shuffle(self._endpoints)
        self._lock = asyncio.Lock()
        self._session: Optional[aiohttp.ClientSession] = None

    # ---------- env loading -------------------------------------------------

    @staticmethod
    def _load_default_urls() -> list[str]:
        urls: list[str] = []
        for key in ("BASE_RPC_1", "BASE_RPC_2", "BASE_RPC_3"):
            v = os.environ.get(key, "").strip()
            if v:
                urls.append(v)
        return urls

    # ---------- session lifecycle ------------------------------------------

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout),
                headers={"Content-Type": "application/json"},
            )
        return self._session

    async def close(self) -> None:
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None

    # ---------- core: issue the call ---------------------------------------

    async def call(
        self,
        method: str,
        params: Optional[list[Any] | dict[str, Any]] = None,
    ) -> Any:
        """
        Execute a JSON-RPC call against the rotator.

        Tries every available endpoint. Raises AllRpcEndpointsFailed if none
        are available or all attempts raise.
        """
        params = list(params or [])
        last_err: Optional[BaseException] = None

        # Snapshot under lock so we don't see partial state mid-failure
        async with self._lock:
            attempts = self._endpoints[:]
        random.shuffle(attempts)

        session = await self._ensure_session()
        now = time.monotonic()
        for ep in attempts:
            if not ep.is_available(now):
                continue
            try:
                payload = {
                    "jsonrpc": "2.0",
                    "id": RPC_ID,
                    "method": method,
                    "params": params,
                }
                async with session.post(ep.url, json=payload) as resp:
                    if resp.status != 200:
                        raise ConnectionError(
                            f"HTTP {resp.status} from {ep.label}"
                        )
                    data = await resp.json()
                if "error" in data and data["error"]:
                    raise RuntimeError(
                        f"RPC error from {ep.label}: {data['error']}"
                    )
                ep.fail_count = 0
                return data.get("result")
            except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
                last_err = exc
                ep.fail_count += 1
                logger.warning(
                    "RPC %s failed (label=%s, n=%d): %s",
                    method, ep.label, ep.fail_count, exc,
                )
                if ep.fail_count >= self.max_fail_threshold:
                    ep.suspend(self.backoff_s, time.monotonic())
            except Exception as exc:  # pragma: no cover - defensive
                last_err = exc
                ep.fail_count += 1
                logger.exception(
                    "Unexpected RPC failure on %s for %s", ep.label, method,
                )

        raise AllRpcEndpointsFailed(
            f"All RPC endpoints failed for {method!r}; last_err={last_err!r}"
        )

    # ---------- convenience wrappers ---------------------------------------

    async def eth_block_number(self) -> int:
        return int(await self.call("eth_blockNumber", []), 16)

    async def eth_chain_id(self) -> int:
        return int(await self.call("eth_chainId", []), 16)

    async def eth_get_balance(self, address: str, block: str = "latest") -> int:
        return int(
            await self.call("eth_getBalance", [address, block]),
            16,
        )

    async def health(self) -> dict[str, Any]:
        """Quick health snapshot of all endpoints for dashboards / debugging."""
        now = time.monotonic()
        return {
            "chain_id": self.chain_id,
            "endpoints": [
                {
                    "label": ep.label,
                    "fail_count": ep.fail_count,
                    "suspended_for_s": max(0.0, ep.suspended_until - now),
                }
                for ep in self._endpoints
            ],
        }


# ---------------------------------------------------------------------------
# Gnosis Safe helper (used by Agent B)
# ---------------------------------------------------------------------------

class GnosisSafeClient:
    """Thin async wrapper for proposing a transaction to a Gnosis Safe."""

    def __init__(
        self,
        rpc: MultiRpcProvider,
        safe_tx_service_url: Optional[str] = None,
    ) -> None:
        self.rpc = rpc
        self.safe_tx_service_url = (
            safe_tx_service_url
            or os.environ.get("GNOSIS_SAFE_API_URL", "").strip()
        )
        if not self.safe_tx_service_url:
            raise RuntimeError("GNOSIS_SAFE_API_URL is not configured")
        self._session: Optional[aiohttp.ClientSession] = None

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT),
                headers={"Content-Type": "application/json"},
            )
        return self._session

    async def close(self) -> None:
        if self._session is not None and not self._session.closed:
            await self._session.close()
            self._session = None

    async def propose_transaction(
        self,
        *,
        safe_address: str,
        to: str,
        value_wei: int,
        data_hex: str,
        sender: str = "a2z-agent-b",
    ) -> str:
        """
        Propose a transaction to a Gnosis Safe via Safe Transaction Service.
        Returns the generated safeTxHash.

        Body shape follows Safe's
            /api/v1/safes/{address}/multisig-transactions/
        POST endpoint. Adjust if your service uses the v2 schema.
        """
        url = (
            f"{self.safe_tx_service_url.rstrip('/')}"
            f"/api/v1/safes/{safe_address}/multisig-transactions/"
        )
        session = await self._ensure_session()

        # Pull the live pending nonce via the rotator so the service validates
        # against on-chain reality, not stale local state.
        nonce = int(
            await self.rpc.call(
                "eth_getTransactionCount",
                [safe_address, "pending"],
            ),
            16,
        )

        body = {
            "to": to,
            "value": str(value_wei),
            "data": data_hex or "0x",
            "operation": 0,
            "safeTxGas": "0",
            "baseGas": "0",
            "gasPrice": "0",
            "gasToken": "0x0000000000000000000000000000000000000000",
            "refundReceiver": "0x0000000000000000000000000000000000000000",
            "nonce": nonce,
            "sender": sender,
            "signature": None,
        }

        async with session.post(url, json=body) as resp:
            text = await resp.text()
            if resp.status not in (200, 201):
                raise RuntimeError(
                    f"Safe proposal rejected: HTTP {resp.status} body={text[:500]}"
                )
            try:
                parsed = _json.loads(text) if text else {}
            except _json.JSONDecodeError:
                parsed = {}
            return (
                parsed.get("safeTxHash")
                or parsed.get("txHash")
                or _json.dumps(parsed)
            )


# ---------------------------------------------------------------------------
# Agent A signing helpers (canonical format shared with the dashboard)
# ---------------------------------------------------------------------------
# These used to live in the legacy sync `web3_client.py`. That module is gone,
# so they are consolidated here to keep the backend import graph self-contained.
try:
    from eth_account import Account as _EthAccount
    from eth_utils import keccak as _keccak
    _SIGNING_AVAILABLE = True
except Exception:  # pragma: no cover - import guard for lightweight environments
    _SIGNING_AVAILABLE = False


def _agent_a_private_key() -> str:
    return os.environ.get("PRIVATE_KEY", "").strip()


def get_account():
    """Return an eth_account.LocalAccount derived from PRIVATE_KEY.

    Raises RuntimeError if the key is missing or malformed.
    """
    if not _SIGNING_AVAILABLE:
        raise RuntimeError("eth_account is not installed (signing unavailable)")
    key = _agent_a_private_key()
    if not key:
        raise RuntimeError("PRIVATE_KEY is not configured")
    if not key.startswith("0x"):
        key = "0x" + key
    return _EthAccount.from_key(key)


def canonical_message_for_signing(
    project_target_address: str,
    timestamp: int,
    amount_usd: float,
    reason: str,
) -> str:
    """Deterministic, human-readable message that gets signed/verified.

    Must match exactly between signing (Agent A) and verification so the
    dashboard / contracts can never disagree on what was authorized.
    """
    return (
        f"A2Z_AGENT_A_AUTHORIZE\n"
        f"target={project_target_address}\n"
        f"timestamp={int(timestamp)}\n"
        f"amount_usd={float(amount_usd):.2f}\n"
        f"reason={reason}\n"
    )


def sign_payload(
    project_target_address: str,
    timestamp: int,
    amount_usd: float,
    reason: str,
) -> str:
    """Return a hex signature (0x...) over the canonical message.

    Raises RuntimeError if PRIVATE_KEY is missing.
    """
    account = get_account()
    canonical = canonical_message_for_signing(
        project_target_address=project_target_address,
        timestamp=timestamp,
        amount_usd=amount_usd,
        reason=reason,
    )
    # eth_account.sign_message expects EIP-191 typed data via encode_defunct
    from eth_account.messages import encode_defunct

    message = encode_defunct(text=canonical)
    signed = account.sign_message(message)
    return signed.signature.hex()
