"""
A2Z Agentz - Web3 Client (Base Network)
Thread-safe-ish provider with Multi-RPC Fallback + dry-run simulation.

Env:
    BASE_RPC_URL_PRIMARY   - Alchemy or other primary RPC endpoint URL
    BASE_RPC_URL_FALLBACK  - Secondary RPC endpoint URL
    PRIVATE_KEY            - Hex private key (0x...). NEVER logged.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.exceptions import Web3Exception
from web3.middleware import geth_poa_middleware
from web3.providers.rpc import HTTPProvider

# ----------------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------------
BASE_CHAIN_ID: int = 8453
DEFAULT_REQUEST_TIMEOUT: float = 10.0  # seconds
DEFAULT_MAX_RETRIES: int = 2
GAS_BUFFER_MULTIPLIER: float = 1.2     # 20% buffer over estimate


# ----------------------------------------------------------------------------
# Logger (private key NEVER touches this)
# ----------------------------------------------------------------------------
logger = logging.getLogger("a2z.web3")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s a2z.web3: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


# ----------------------------------------------------------------------------
# Private-key handling (masked display helper)
# ----------------------------------------------------------------------------
def _mask_key(pk: str) -> str:
    """Return a safe, masked representation of a private key for logging only."""
    if not pk:
        return "<empty>"
    s = pk if pk.startswith("0x") else "0x" + pk
    if len(s) <= 10:
        return "0x***"
    return f"{s[:6]}…{s[-4:]}  (len={len(s)})"


def _load_account() -> LocalAccount:
    raw = os.getenv("PRIVATE_KEY", "").strip()
    if not raw:
        raise RuntimeError("PRIVATE_KEY env var is not set.")
    if not raw.startswith("0x"):
        raw = "0x" + raw
    try:
        acct = Account.from_key(raw)
    except Exception as exc:
        # Do NOT print the key on failure.
        raise RuntimeError(f"Invalid PRIVATE_KEY format: {exc}") from exc
    logger.info("Loaded signer account %s…", acct.address[:10])
    return acct


# ----------------------------------------------------------------------------
# Multi-RPC Web3 provider with fallback
# ----------------------------------------------------------------------------
class _RPCState:
    _lock: threading.Lock = threading.Lock()
    _w3: Optional[Web3] = None
    _endpoint_label: Optional[str] = None
    _account: Optional[LocalAccount] = None


def _build_w3(url: str, label: str, timeout: float) -> Web3:
    if not url:
        raise RuntimeError(f"RPC URL for '{label}' is empty")
    provider = HTTPProvider(endpoint_url=url, request_kwargs={"timeout": timeout})
    w3 = Web3(provider)
    # Base is post-merge PoS; POA middleware is not strictly required, but is
    # safe to inject in case a fallback RPC fronts PoA-style infra.
    try:
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    except ValueError:
        pass  # already injected
    if not w3.is_connected():
        raise RuntimeError(f"Cannot reach {label} RPC at {url}")
    chain_id = w3.eth.chain_id
    if chain_id != BASE_CHAIN_ID:
        raise RuntimeError(
            f"{label} RPC returned chainId={chain_id}, expected Base ({BASE_CHAIN_ID})"
        )
    logger.info("Connected to %s RPC (chainId=%s)", label, chain_id)
    return w3


def _get_w3(timeout: float = DEFAULT_REQUEST_TIMEOUT) -> Web3:
    """Return a cached Web3 instance, trying primary then fallback."""
    if _RPCState._w3 is not None:
        return _RPCState._w3

    with _RPCState._lock:
        if _RPCState._w3 is not None:
            return _RPCState._w3

        primary = os.getenv("BASE_RPC_URL_PRIMARY", "").strip()
        fallback = os.getenv("BASE_RPC_URL_FALLBACK", "").strip()

        if not primary and not fallback:
            raise RuntimeError(
                "Neither BASE_RPC_URL_PRIMARY nor BASE_RPC_URL_FALLBACK is set."
            )

        candidates: list[tuple[str, str]] = []
        if primary:
            candidates.append((primary, "primary"))
        if fallback:
            candidates.append((fallback, "fallback"))

        last_err: Optional[Exception] = None
        for url, label in candidates:
            try:
                w3 = _build_w3(url, label, timeout)
                _RPCState._w3 = w3
                _RPCState._endpoint_label = label
                return w3
            except Exception as exc:
                logger.warning(
                    "RPC '%s' init failed: %s — trying next endpoint.",
                    label, exc,
                )
                last_err = exc

        raise RuntimeError(
            f"All Base RPC endpoints failed. Last error: {last_err}"
        )


def _reset_w3() -> None:
    """Drop the cached Web3 so the next call rebuilds via fallback."""
    with _RPCState._lock:
        _RPCState._w3 = None
        _RPCState._endpoint_label = None


def _with_retry(callable_, *args, **kwargs):
    """Run a JSON-RPC call with bounded retry against the same provider."""
    last_exc: Optional[Exception] = None
    for attempt in range(1, DEFAULT_MAX_RETRIES + 1):
        try:
            return callable_(*args, **kwargs)
        except Web3Exception as exc:
            last_exc = exc
            logger.warning(
                "RPC call failed (attempt %d/%d): %s",
                attempt, DEFAULT_MAX_RETRIES, exc,
            )
            _reset_w3()
            time.sleep(0.5 * attempt)
    assert last_exc is not None
    raise last_exc


def get_account() -> LocalAccount:
    if _RPCState._account is None:
        with _RPCState._lock:
            if _RPCState._account is None:
                _RPCState._account = _load_account()
    return _RPCState._account


# ----------------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------------
def simulate_and_execute_tx(
    target_address: str,
    amount_usd,
) -> str:
    """
    Simulate first, then broadcast a native ETH transfer on Base.

    Args:
        target_address: 0x-prefixed destination address (string).
        amount_usd:     Wei amount to send as the tx 'value' (caller is
                        responsible for any USD -> wei conversion upstream).

    Returns:
        Hex string of the broadcast transaction hash.

    Raises:
        ValueError on bad inputs.
        RuntimeError on RPC failure.
        Web3Exception / ContractLogicError if simulation reverts (honeypot
        signal) — caller should treat this as a hard stop.
    """
    # ---- input validation ----
    if not isinstance(target_address, str) or not Web3.is_address(target_address):
        raise ValueError(f"Invalid target_address: {target_address!r}")
    to_addr = Web3.to_checksum_address(target_address)

    try:
        value_wei = int(amount_usd)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"amount_usd must be coercible to int (wei): {exc}") from exc
    if value_wei <= 0:
        raise ValueError("amount_usd (wei) must be > 0")

    account = get_account()
    w3 = _get_w3()

    # ---- build skeleton tx for simulation ----
    nonce = _with_retry(w3.eth.get_transaction_count, account.address, "pending")
    base_fee = _with_retry(w3.eth.gas_price)
    # EIP-1559 (type 2) priority
    max_priority_fee_per_gas = max(int(base_fee * 0.1), 1_000_000)  # >= 0.001 gwei
    max_fee_per_gas = int(base_fee * 2) + max_priority_fee_per_gas

    skeleton_tx = {
        "from": account.address,
        "to": to_addr,
        "value": value_wei,
        "chainId": BASE_CHAIN_ID,
        "nonce": nonce,
        "maxFeePerGas": max_fee_per_gas,
        "maxPriorityFeePerGas": max_priority_fee_per_gas,
        "type": 2,
    }

    # ---- (1) dry-run: estimate_gas on Base ----
    try:
        estimated_gas = _with_retry(w3.eth.estimate_gas, skeleton_tx)
    except Web3Exception as exc:
        # Revert / insufficient funds / blacklisted-from-pool => treat as
        # honeypot / unsafe and DO NOT broadcast.
        logger.error(
            "Simulation REVERTED for target=%s amount_wei=%s — aborting. reason=%s",
            to_addr, value_wei, exc,
        )
        raise

    if estimated_gas <= 0:
        raise RuntimeError("estimate_gas returned 0 — refusing to broadcast.")

    gas_limit = int(estimated_gas * GAS_BUFFER_MULTIPLIER)

    # ---- (2) build, sign, broadcast ----
    signed = account.sign_transaction({
        **skeleton_tx,
        "gas": gas_limit,
    })
    raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
    if raw_tx is None:
        raise RuntimeError("Signed transaction has no raw payload.")

    try:
        tx_hash = _with_retry(w3.eth.send_raw_transaction, raw_tx)
    except Web3Exception as exc:
        logger.error("Broadcast failed: %s", exc)
        raise

    tx_hash_hex = tx_hash.hex()
    logger.info(
        "Broadcast OK | endpoint=%s target=%s amount_wei=%s gas=%s tx=%s",
        _RPCState._endpoint_label, to_addr, value_wei, gas_limit, tx_hash_hex,
    )
    return tx_hash_hex


# ----------------------------------------------------------------------------
# Optional smoke test: `python web3_client.py`
# ----------------------------------------------------------------------------
if __name__ == "__main__":  # pragma: no cover
    print("Base Web3 client ready. Signer key:", _mask_key(os.getenv("PRIVATE_KEY", "")))
    print("ChainId sanity:", _get_w3().eth.chain_id)
