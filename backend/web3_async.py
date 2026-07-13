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

# Operator-declared EOAs that are safe for direct native transfer even though
# they carry bytecode (e.g. EIP-7702 delegated EOAs used to deploy contracts
# like BaseTenfold, but which still receive/send ETH freely). These bypass the
# smart-contract guard so Agent B executes without aborting. Operator-trusted.
EOA_WHITELIST: set[str] = {
    "0xd4714d22a338d932eec1fb38818d01ce361284dd",  # adityamlna.base.eth (EIP-7702, does NOT accept native ETH)
    "0xd6d824fd3d19e46b5e2046955d13e9fd42db79d3",  # operator clean EOA (receives native ETH)
}

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


# ---------------------------------------------------------------------------
# Real on-chain execution (Agent B / manual trigger)
# ---------------------------------------------------------------------------
from eth_utils import to_checksum_address as _to_checksum  # noqa: E402


def _fetch_eth_usd_price() -> float:
    """Live ETH/USD price from CoinGecko (no API key required).

    Falls back to a sane hardcoded price only if the network call fails, so
    execution never hard-fails on a transient price fetch error.
    """
    import urllib.request
    import json as _json
    url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    try:
        req = urllib.request.Request(url, headers={"accept": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = _json.loads(resp.read().decode("utf-8"))
        if isinstance(data, dict):
            eth = data.get("ethereum", {})
            if isinstance(eth, dict):
                price = float(eth.get("usd", 0) or 0)
                if price > 0:
                    return price
    except Exception as exc:
        logger.warning("ETH/USD price fetch from CoinGecko failed: %s", exc)
    # Fallback only on network failure (real last-resort value, not a guess).
    logger.warning("CoinGecko unavailable; using fallback ETH price $3000")
    return 3000.0


def _usd_to_wei_real(amount_usd: float) -> int:
    """Convert a USD amount to wei using the live ETH price from CoinGecko.

    The operator no longer needs to set ETH_USD_PRICE; the price is fetched
    live so the vault always sends a real, market-accurate amount.
    """
    price = _fetch_eth_usd_price()
    if price is None or price <= 0:
        raise RuntimeError("Could not resolve ETH/USD price; refusing USD->wei conversion")
    eth_amount = float(amount_usd) / price
    return int(eth_amount * 1e18)


async def send_native_transaction(
    to_address: str,
    value_wei: int,
    *,
    chain_id: int | None = None,
    max_gas_price_gwei: float | None = None,
) -> str:
    """EIP-1559 (type-2) sign + broadcast of a native (ETH) transfer.

    Built with explicit type-2 fields and live fee estimation (the web3
    ``build_transaction`` + ``sign_transaction`` equivalent), not legacy
    gasPrice. Returns the real tx hash hex.

    Gas safety (the "don't be wasteful" guard):
      * gas limit fixed to 21000 (plain native transfer - nothing cheaper)
      * maxPriorityFeePerGas = eth_maxPriorityFeePerGas (fallback 1.5 gwei)
      * maxFeePerGas = base_fee(eth_gasPrice) + priority, hard-capped at
        max_gas_price_gwei so the vault never over-pays
      * aborts if wallet balance < value + estimated gas cost (never
        broadcasts a tx that would revert for lack of funds)

    RPC selection: chain_id 84532 -> BASE_SEPOLIA_RPC / BASE_SEPOLIA_RPC_*,
    otherwise BASE_RPC_* / BASE_RPC_4. Keeps a Sepolia tx off mainnet RPCs.
    """
    if not _SIGNING_AVAILABLE:
        raise RuntimeError("eth_account not installed (on-chain sending unavailable)")
    cid = chain_id or BASE_CHAIN_ID
    if cid == 84532:
        rpc_urls = [u for u in [
            os.environ.get("BASE_SEPOLIA_RPC", ""),
            os.environ.get("BASE_SEPOLIA_RPC_1", ""),
            os.environ.get("BASE_SEPOLIA_RPC_2", ""),
        ] if u]
    else:
        rpc_urls = [u for u in [
            os.environ.get("BASE_RPC_1", ""),
            os.environ.get("BASE_RPC_2", ""),
            os.environ.get("BASE_RPC_3", ""),
            os.environ.get("BASE_RPC_4", ""),
        ] if u]
    if not rpc_urls:
        raise RuntimeError(f"No RPC endpoints configured for chain_id={cid}")
    provider = MultiRpcProvider(rpc_urls=rpc_urls, chain_id=cid)
    try:
        acct = get_account()
        to = _to_checksum(to_address)

        # Smart-contract guard: on Base chains a plain native value transfer
        # to an address WITH code reverts (EIP-7611 / OP-070), wasting gas.
        # Abort safely before signing/broadcasting.
        #
        # Exception: EIP-7702 delegated EOAs in EOA_WHITELIST (e.g. operator's
        # wallet that deployed BaseTenfold). Their code only DELEGATECALLs and
        # has a payable fallback, so it accepts ETH as long as the tx carries
        # NON-EMPTY data (the rule only blocks empty-data value transfers to
        # code-bearing addresses). We skip the abort and attach a 1-byte data
        # payload below so the chain does not revert.
        if await _is_smart_contract(provider, to):
            if to.lower() in EOA_WHITELIST:
                # whitelisted delegated EOA: allowed, but needs non-empty data
                emit_data = b"\x00"
                logger.info(
                    "Target %s is a whitelisted EIP-7702 EOA; sending with "
                    "non-empty data to satisfy OP-070 (avoid revert).",
                    to,
                )
            else:
                logger.warning(
                    "Target is a Smart Contract, skipping plain ETH transfer to avoid revert: %s",
                    to,
                )
                raise RuntimeError(
                    "Target is a Smart Contract, skipping plain ETH transfer to avoid revert"
                )
        else:
            emit_data = b""

        # Use 'latest' nonce (not 'pending') to avoid gaps when a previous
        # broadcast was dropped by a flaky RPC; this keeps the next tx valid.
        nonce = int(
            await provider.call("eth_getTransactionCount", [acct.address, "latest"]),
            16,
        )
        max_fee, max_priority = await _estimate_eip1559_fees(provider, max_gas_price_gwei)
        gas_limit = 21000 + (100 if emit_data else 0)
        estimated_gas_cost = max_fee * gas_limit

        balance = await provider.eth_get_balance(acct.address)
        if balance < value_wei + estimated_gas_cost:
            raise RuntimeError(
                f"Insufficient balance: have {balance / 1e18:.6f} ETH, need "
                f"{(value_wei + estimated_gas_cost) / 1e18:.6f} ETH (value + gas)"
            )

        tx = {
            "type": 2,
            "nonce": nonce,
            "to": to,
            "value": value_wei,
            "data": emit_data,
            "gas": gas_limit,
            "maxFeePerGas": max_fee,
            "maxPriorityFeePerGas": max_priority,
            "chainId": cid,
        }
        signed = acct.sign_transaction(tx)
        # web3 7.x renamed rawTransaction -> raw_transaction; support both
        raw_bytes = getattr(signed, "raw_transaction", None) or getattr(
            signed, "rawTransaction", None
        )
        if isinstance(raw_bytes, (bytes, bytearray)):
            raw = raw_bytes.hex()
        else:
            raw = raw_bytes
        # Fan-out broadcast: send to every configured RPC so the tx propagates
        # even if one endpoint is flaky. Success on ANY endpoint is enough.
        last_err = None
        for rpc_url in rpc_urls:
            single = None
            try:
                single = MultiRpcProvider(rpc_urls=[rpc_url], chain_id=cid)
                tx_hash = await single.call("eth_sendRawTransaction", [raw])
                logger.info(
                    "on-chain send ok: chain=%s type=2 to=%s value_wei=%d maxFee=%d priority=%d hash=%s via %s",
                    cid, to, value_wei, max_fee, max_priority, tx_hash, rpc_url[:32],
                )
                break
            except Exception as e:  # try next endpoint
                last_err = e
                logger.warning("broadcast to %s failed: %s", rpc_url[:32], str(e)[:60])
            finally:
                if single is not None:
                    await single.close()
        else:
            raise RuntimeError(f"All RPCs failed to broadcast tx: {last_err}")
        return tx_hash
    finally:
        await provider.close()


async def _estimate_eip1559_fees(provider, max_gas_price_gwei):
    """Return (maxFeePerGas, maxPriorityFeePerGas) in wei for a type-2 tx."""
    try:
        priority = int(await provider.call("eth_maxPriorityFeePerGas", []), 16)
    except Exception:
        priority = int(1.5 * 1e9)
    if priority <= 0:
        priority = int(1.5 * 1e9)
    try:
        base_fee = int(await provider.call("eth_gasPrice", []), 16)
    except Exception:
        base_fee = int(1.0 * 1e9)
    max_fee = base_fee + priority
    if max_gas_price_gwei:
        cap = int(max_gas_price_gwei * 1e9)
        max_fee = min(max_fee, cap)
        priority = min(priority, cap)
    return max_fee, priority


async def _is_smart_contract(provider, address: str) -> bool:
    """Return True if `address` holds contract bytecode.

    On Base chains (EIP-7611 / OP-070) a plain native value transfer to an
    address WITH code reverts, wasting gas. Detecting it up front lets the
    caller abort safely (no broadcast, no gas spent). EOAs return "0x"
    (len 2); contracts return longer bytecode.

    Whitelisted operator EOAs (EOA_WHITELIST, e.g. EIP-7702 delegated EOAs
    that carry bytecode but still receive/send ETH freely) are treated as safe
    and never flagged as contracts.

    Fail-closed: if eth_getCode cannot be read (RPC error), the address is
    treated AS a contract (abort) rather than assumed safe. This prevents
    accidentally broadcasting a transfer that would revert on Base and waste
    gas when the chain probe is unavailable.
    """
    try:
        addr = _to_checksum(address)
    except Exception:
        addr = address.lower()
    if addr.lower() in EOA_WHITELIST:
        return False
    try:
        code = await provider.call("eth_getCode", [address, "latest"])
    except Exception:
        # Fail closed: cannot verify -> assume contract, abort safely.
        logger.warning(
            "eth_getCode failed for %s; treating as smart contract (abort to save gas)",
            address,
        )
        return True
    if not code:
        code = "0x"
    return len(code) > 2



# ---------------------------------------------------------------------------
# Uniswap V2 DEX Swap (Agent B: swap ETH -> token via Base DEX)
# ---------------------------------------------------------------------------
UNISWAP_V2_ROUTER = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"
WETH_BASE = "0x4200000000000000000000000000000000000006"

# Minimal ABI for swapExactETHForTokensSupportingFeeOnTransferTokens
UNISWAP_V2_ROUTER_ABI_SWAP = [
    {
        "type": "function",
        "name": "swapExactETHForTokensSupportingFeeOnTransferTokens",
        "inputs": [
            {"name": "amountOutMin", "type": "uint256"},
            {"name": "path", "type": "address[]"},
            {"name": "to", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "outputs": [],
        "stateMutability": "payable",
    },
]

async def swap_eth_for_token(
    token_address: str,
    eth_value_wei: int,
    *,
    chain_id: int | None = None,
    max_gas_price_gwei: float | None = None,
    slippage_bps: int = 1000,  # 10% default — micro-caps are volatile
) -> dict:
    """Swap ETH for a token via Uniswap V2 on Base (micro-swap for Agent B).

    Uses swapExactETHForTokensSupportingFeeOnTransferTokens so tokens with
    transfer fees (common on Base meme coins) don't revert.

    SAFETY: before signing/broadcasting, we SIMULATE the swap with eth_call
    and eth_estimateGas. If the simulation reverts (bad token, fee-on-transfer
    that yields 0 output, slippage/liquidity issue), we DROP the tx so the
    vault never pays gas for a guaranteed-failed broadcast.

    Returns dict with tx_hash, token_address, eth_value_wei.
    """
    from eth_utils import to_checksum_address
    from eth_account._utils.signing import to_bytes
    from eth_abi import encode, decode as abi_decode

    if not _SIGNING_AVAILABLE:
        raise RuntimeError("eth_account not installed")

    cid = chain_id or BASE_CHAIN_ID
    if cid == 84532:
        rpc_urls = [u for u in [
            os.environ.get("BASE_SEPOLIA_RPC", ""),
            os.environ.get("BASE_SEPOLIA_RPC_1", ""),
            os.environ.get("BASE_SEPOLIA_RPC_2", ""),
        ] if u]
    else:
        rpc_urls = [u for u in [
            os.environ.get("BASE_RPC_1", ""),
            os.environ.get("BASE_RPC_2", ""),
            os.environ.get("BASE_RPC_3", ""),
            os.environ.get("BASE_RPC_4", ""),
        ] if u]

    if not rpc_urls:
        raise RuntimeError(f"No RPC endpoints for chain_id={cid}")

    # Higher slippage for micro-cap tokens (low liquidity => bigger price move)
    slip = int(os.environ.get("AGENT_B_SWAP_SLIPPAGE_BPS", str(slippage_bps)) or slippage_bps)

    provider = MultiRpcProvider(rpc_urls=rpc_urls, chain_id=cid)
    try:
        acct = get_account()
        router = to_checksum_address(UNISWAP_V2_ROUTER)
        token = to_checksum_address(token_address)
        weth = to_checksum_address(WETH_BASE)
        recipient = to_checksum_address(acct.address)

        import time as _time
        deadline = int(_time.time()) + 1200  # 20 min

        # Path: WETH -> token
        path = [weth, token]

        # --- Compute a REAL amountOutMin from on-chain quote (getAmountsOut) ---
        # Hardcoded amountOutMin=1 previously let some swaps revert (output < 1
        # wei) and others over-slippage. We now quote the expected output off
        # the live reserve and apply operator slippage (default 10%, larger for
        # micro-caps so the tx clears even with thin liquidity).
        amount_out_min = 1
        try:
            quote_params = [hex(eth_value_wei), [weth, token]]
            q = await provider.call(
                "eth_call",
                [
                    {
                        "to": router,
                        "data": "0x0d3648bd"  # getAmountsOut(uint,path)
                        + encode(["uint256", "address[]"], quote_params).hex(),
                    },
                    "latest",
                ],
            )
            if q and q != "0x":
                # getAmountsOut returns (uint256[]); decode the ABI-encoded result.
                outs = abi_decode(["uint256[]"], bytes.fromhex(q[2:]))[0]
                if outs and len(outs) >= 2 and outs[1] > 0:
                    expected = outs[1]
                    amount_out_min = max(1, int(expected * (10_000 - slip) / 10_000))
        except Exception as exc:
            logger.warning("swap quote (getAmountsOut) failed for %s: %s", token, exc)

        # Encode swapExactETHForTokensSupportingFeeOnTransferTokens
        # function signature: 0xb6f9de95
        selector = b'\xb6\xf9\xde\x95'
        encoded_params = encode(
            ['uint256', 'address[]', 'address', 'uint256'],
            [amount_out_min, path, recipient, deadline],
        )
        calldata = '0x' + (selector + encoded_params).hex()

        # --- PRE-FLIGHT SIMULATION (eth_call) ---
        # Reverts here mean the on-chain swap would fail too. We DROP the tx
        # (raise) BEFORE signing/broadcasting so no gas is ever paid.
        try:
            sim = await provider.call(
                "eth_call",
                [
                    {
                        "from": acct.address,
                        "to": router,
                        "value": hex(eth_value_wei),
                        "data": calldata,
                    },
                    "latest",
                ],
            )
            if sim is None:
                raise RuntimeError("eth_call simulation returned no result")
        except Exception as exc:
            raise RuntimeError(
                f"Swap simulation (eth_call) reverted for {token}: {exc} — dropping tx, no gas spent"
            )

        # --- GAS ESTIMATION (also reverts on bad tokens) ---
        try:
            est = await provider.call(
                "eth_estimateGas",
                [
                    {
                        "from": acct.address,
                        "to": router,
                        "value": hex(eth_value_wei),
                        "data": calldata,
                    },
                    "latest",
                ],
            )
            gas_limit = int(est, 16)
            # Pad 20% for mempool volatility so the broadcast doesn't run out.
            gas_limit = int(gas_limit * 1.2)
        except Exception as exc:
            raise RuntimeError(
                f"eth_estimateGas reverted for {token}: {exc} — dropping tx, no gas spent"
            )

        nonce = int(
            await provider.call("eth_getTransactionCount", [acct.address, "latest"]),
            16,
        )
        max_fee, max_priority = await _estimate_eip1559_fees(provider, max_gas_price_gwei)
        if gas_limit < 50_000:
            gas_limit = 300_000  # floor: swapExactETHForTokensSupportingFeeOnTransferTokens typical

        balance = await provider.eth_get_balance(acct.address)
        estimated_gas_cost = max_fee * gas_limit
        if balance < eth_value_wei + estimated_gas_cost:
            raise RuntimeError(
                f"Insufficient balance: have {balance / 1e18:.6f} ETH, "
                f"need {(eth_value_wei + estimated_gas_cost) / 1e18:.6f} ETH (value + gas)"
            )

        tx = {
            "type": 2,
            "nonce": nonce,
            "to": router,
            "value": eth_value_wei,
            "data": calldata if isinstance(calldata, bytes) else bytes.fromhex(calldata[2:]),
            "gas": gas_limit,
            "maxFeePerGas": max_fee,
            "maxPriorityFeePerGas": max_priority,
            "chainId": cid,
        }

        signed = acct.sign_transaction(tx)
        raw_bytes = getattr(signed, "raw_transaction", None) or getattr(
            signed, "rawTransaction", None
        )
        if isinstance(raw_bytes, (bytes, bytearray)):
            raw = raw_bytes.hex()
        else:
            raw = raw_bytes

        results = []
        for ep in provider._endpoints:
            try:
                session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT),
                    headers={"Content-Type": "application/json"},
                )
                async with session.post(
                    ep.url,
                    json={
                        "jsonrpc": "2.0",
                        "id": RPC_ID,
                        "method": "eth_sendRawTransaction",
                        "params": ["0x" + raw],
                    },
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if "result" in data and data["result"]:
                            tx_hash = data["result"]
                            logger.info(
                                "Uniswap swap broadcast: %s ETH -> %s, tx=%s",
                                eth_value_wei / 1e18, token_address, tx_hash,
                            )
                            return {
                                "tx_hash": tx_hash,
                                "token_address": token_address,
                                "eth_value_wei": eth_value_wei,
                            }
                        results.append(data)
            except Exception:
                pass
            finally:
                await session.close()
        if results:
            raise RuntimeError(f"Swap broadcast failed: {results[:3]}")
        raise RuntimeError("All RPC endpoints failed to broadcast swap")
    finally:
        await provider.close()


async def send_proof_of_execution() -> str:
    """A2Z Agent B - micro proof-of-execution transfer (live-demo receipt).

    Sends a tiny fixed amount of native ETH (MICRO_TX_ETH, default 0.00001)
    to the operator's VAULT_ADDRESS EXCLUSIVELY on Base Sepolia (chain 84532).
    This is the on-chain "I actually executed" receipt for judges: a valid
    TxHash on sepolia.basescan.org, no token liquidity needed, negligible gas.

    Requires: VAULT_ADDRESS (resolved 0x, not a .eth name - raw RPC cannot
    resolve ENS), MICRO_TX_ETH optional, MAX_GAS_PRICE_GWEI optional cap.
    """
    vault = os.environ.get("VAULT_ADDRESS", "").strip()
    if not vault:
        raise RuntimeError("VAULT_ADDRESS not set; cannot send proof-of-execution")
    if vault.lower().endswith(".eth"):
        raise RuntimeError(
            "VAULT_ADDRESS must be the resolved 0x address (raw RPC cannot "
            "resolve ENS names). Resolve your .eth name to its address first."
        )
    micro_eth = float(os.environ.get("MICRO_TX_ETH", "0.00001"))
    value_wei = int(micro_eth * 1e18)
    cap = float(os.environ.get("MAX_GAS_PRICE_GWEI", "0") or "0") or None
    # Proof-of-execution target chain follows ACTIVE_NETWORK:
    #   base        -> 8453 (Base mainnet)
    #   base_sepolia-> 84532 (Base Sepolia, default for live demos)
    active = os.environ.get("ACTIVE_NETWORK", "base_sepolia").strip().lower()
    if active == "base":
        chain_id = 8453
        guard_rpcs = [u for u in [
            os.environ.get("BASE_RPC_1", ""),
            os.environ.get("BASE_RPC_2", ""),
            os.environ.get("BASE_RPC_3", ""),
            os.environ.get("BASE_RPC_4", ""),
        ] if u]
    else:
        chain_id = 84532
        guard_rpcs = [u for u in [
            os.environ.get("BASE_SEPOLIA_RPC", ""),
            os.environ.get("BASE_SEPOLIA_RPC_1", ""),
            os.environ.get("BASE_SEPOLIA_RPC_2", ""),
        ] if u]
    # Smart-contract guard: a plain ETH transfer to a contract reverts on Base
    # (EIP-7611), burning gas for nothing. Abort safely before broadcasting.
    # Whitelisted EIP-7702 EOAs (e.g. operator wallet) are allowed and sent
    # with non-empty data instead (see send_native_transaction).
    _prov = MultiRpcProvider(rpc_urls=guard_rpcs, chain_id=chain_id)
    try:
        if await _is_smart_contract(_prov, _to_checksum(vault)):
            logger.warning(
                "Target is a Smart Contract, skipping plain ETH transfer to avoid revert: %s",
                vault,
            )
            raise RuntimeError(
                "Target is a Smart Contract, skipping plain ETH transfer to avoid revert"
            )
    finally:
        await _prov.close()
    return await send_native_transaction(
        vault, value_wei, chain_id=chain_id, max_gas_price_gwei=cap
    )


# ---------------------------------------------------------------------------
# Agent B Sell Side — swap token -> ETH (take-profit exit)
# ---------------------------------------------------------------------------

# Minimal ERC20 ABI for approve + balanceOf
_ERC20_ABI_APPROVE = [
    {
        "type": "function",
        "name": "approve",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
    },
]


async def _erc20_approve(
    provider: MultiRpcProvider,
    token_address: str,
    spender: str,
    amount: int,
    chain_id: int,
    max_gas_price_gwei: float | None = None,
) -> str:
    """Approve `spender` to spend `amount` of ERC20 `token_address`."""
    from eth_abi import encode
    acct = get_account()
    token = _to_checksum(token_address)
    sp = _to_checksum(spender)

    # encode approve(spender, amount)
    selector = b'\x09\x5e\xa7\xb3'  # keccak("approve(address,uint256)")[:4]
    encoded = encode(['address', 'uint256'], [sp, amount])
    data = '0x' + (selector + encoded).hex()

    nonce = int(await provider.call("eth_getTransactionCount", [acct.address, "latest"]), 16)
    max_fee, max_priority = await _estimate_eip1559_fees(provider, max_gas_price_gwei)

    tx = {
        "type": 2,
        "nonce": nonce,
        "to": token,
        "value": 0,
        "data": bytes.fromhex(data[2:]),
        "gas": 80_000,
        "maxFeePerGas": max_fee,
        "maxPriorityFeePerGas": max_priority,
        "chainId": chain_id,
    }
    signed = acct.sign_transaction(tx)
    raw_bytes = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
    raw = raw_bytes.hex() if isinstance(raw_bytes, (bytes, bytearray)) else raw_bytes

    results = []
    for ep in provider._endpoints:
        try:
            session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT),
                headers={"Content-Type": "application/json"},
            )
            async with session.post(
                ep.url,
                json={"jsonrpc": "2.0", "id": RPC_ID, "method": "eth_sendRawTransaction", "params": ["0x" + raw]},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if "result" in data and data["result"]:
                        return data["result"]
                    results.append(data)
        except Exception:
            pass
        finally:
            await session.close()
    raise RuntimeError(f"Approve broadcast failed: {results[:3]}")


async def swap_token_for_eth(
    token_address: str,
    token_amount_wei: int,
    *,
    chain_id: int | None = None,
    max_gas_price_gwei: float | None = None,
) -> dict:
    """Swap token -> ETH via Uniswap V2 on Base (Agent B take-profit exit).

    Approves the router first, then calls swapExactTokensForETHSupportingFeeOnTransferTokens.
    Returns dict with tx_hash, token_address, token_amount_wei.
    """
    from eth_abi import encode
    import time as _time

    if not _SIGNING_AVAILABLE:
        raise RuntimeError("eth_account not installed")

    cid = chain_id or BASE_CHAIN_ID
    rpc_urls = [u for u in [
        os.environ.get("BASE_RPC_1", ""), os.environ.get("BASE_RPC_2", ""),
        os.environ.get("BASE_RPC_3", ""), os.environ.get("BASE_RPC_4", ""),
    ] if u]
    if not rpc_urls:
        raise RuntimeError(f"No RPC endpoints for chain_id={cid}")

    provider = MultiRpcProvider(rpc_urls=rpc_urls, chain_id=cid)
    try:
        acct = get_account()
        router = _to_checksum(UNISWAP_V2_ROUTER)
        token = _to_checksum(token_address)
        weth = _to_checksum(WETH_BASE)
        recipient = _to_checksum(acct.address)

        # Step 1: Approve router to spend tokens (only if we haven't already)
        approve_hash = await _erc20_approve(
            provider, token_address, UNISWAP_V2_ROUTER, token_amount_wei,
            chain_id=cid, max_gas_price_gwei=max_gas_price_gwei,
        )
        logger.info("Token approval tx=%s for %s amount=%s", approve_hash, token_address, token_amount_wei)

        # Step 2: swapExactTokensForETHSupportingFeeOnTransferTokens
        deadline = int(_time.time()) + 1200
        path = [token, weth]
        selector = b'\xb6\xf9\xde\x95'
        encoded_params = encode(
            ['uint256', 'address[]', 'address', 'uint256'],
            [1, path, recipient, deadline],
        )
        calldata = '0x' + (selector + encoded_params).hex()

        nonce = int(await provider.call("eth_getTransactionCount", [acct.address, "latest"]), 16)
        max_fee, max_priority = await _estimate_eip1559_fees(provider, max_gas_price_gwei)

        tx = {
            "type": 2, "nonce": nonce, "to": router, "value": 0,
            "data": bytes.fromhex(calldata[2:]), "gas": 300_000,
            "maxFeePerGas": max_fee, "maxPriorityFeePerGas": max_priority, "chainId": cid,
        }
        signed = acct.sign_transaction(tx)
        raw_bytes = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        raw = raw_bytes.hex() if isinstance(raw_bytes, (bytes, bytearray)) else raw_bytes

        results = []
        for ep in provider._endpoints:
            try:
                session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=DEFAULT_TIMEOUT),
                    headers={"Content-Type": "application/json"},
                )
                async with session.post(
                    ep.url,
                    json={"jsonrpc": "2.0", "id": RPC_ID, "method": "eth_sendRawTransaction", "params": ["0x" + raw]},
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if "result" in data and data["result"]:
                            tx_hash = data["result"]
                            logger.info("SELL swap broadcast: %s wei of %s -> ETH, tx=%s",
                                        token_amount_wei, token_address, tx_hash)
                            return {"tx_hash": tx_hash, "token_address": token_address, "token_amount_wei": token_amount_wei}
                        results.append(data)
            except Exception:
                pass
            finally:
                await session.close()
        raise RuntimeError(f"Sell swap broadcast failed: {results[:3]}")
    finally:
        await provider.close()
