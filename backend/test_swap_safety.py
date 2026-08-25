"""
Diagnostic harness for AaaS money-path safety (B1 + M1).

Run:  python3 test_swap_safety.py
No live DB / Neon / real RPC required — everything is mocked.

Validates:
  B1 - swap_token_for_eth MUST route to the ACTIVE network's RPC set
       (mainnet -> BASE_RPC_*, never BASE_SEPOLIA_RPC_*) even when the
       testnet env vars are accidentally populated.
  M1 - on MAINNET, if getAmountsOut (the slippage quote) fails, the
       swap MUST raise (strict reject). It must NEVER proceed with
       amountOutMin=1 (which = MEV bait).

Exit 0 = both guarantees hold. Non-zero = regression.
"""
from __future__ import annotations

import asyncio
import os
import sys
import types

# --- Force deterministic env so the test is hermetic -----------------------
os.environ["ACTIVE_NETWORK"] = "base"          # mainnet
os.environ["BASE_RPC_1"] = "https://mainnet-rpc-1.example"
os.environ["BASE_RPC_2"] = "https://mainnet-rpc-2.example"
os.environ["BASE_RPC_3"] = "https://mainnet-rpc-3.example"
# Enable real-execution gate so the swap reaches the broadcast step
# (the safety_interlock is the FINAL gate; here we prove ROUTING, so we
#  satisfy it deliberately — the interlock itself is tested elsewhere).
os.environ["AGENT_B_REAL_EXECUTION"] = "1"
os.environ["MAINNET_CONFIRM"] = "1"
os.environ["AGENT_B_DRY_RUN"] = "0"
# A dangerous misconfiguration the old code would have fallen into:
os.environ["BASE_SEPOLIA_RPC_1"] = "https://sepolia-evil.example"
os.environ["BASE_SEPOLIA_RPC_2"] = "https://sepolia-evil2.example"

# Track which RPC host the broadcast actually hit.
BROADCAST_HOSTS: list[str] = []
QUOTE_FAILED = False  # flip to True to simulate M1 mainnet quote failure

# --- Minimal stand-ins ------------------------------------------------
# We stub the heavy web3 pieces so the harness runs without a real chain.

class _FakeAccount:
    address = "0x" + "11" * 20
    def sign_transaction(self, tx):
        class _R:
            raw_transaction = b"\x01" * 32
        return _R()

def _fake_get_account():
    return _FakeAccount()

async def _fake_estimate_eip1559_fees(provider, cap):
    return 2_000_000_000, 1_000_000_000  # 2 gwei / 1 gwei

async def _fake_preflight(provider, address, est_gas, label=""):
    return 10**18  # plenty of balance

def _make_multi_rpc(monkeypatch_provider):
    """Build a FakeMultiRpcProvider that records broadcast hosts."""
    class _FakeEndpoint:
        def __init__(self, url):
            self.url = url
            self.fail_count = 0
            self.suspended_until = 0.0
        def is_available(self, now):
            return True

    class _FakeMultiRpc:
        def __init__(self, rpc_urls=None, chain_id=8453, **kw):
            urls = rpc_urls or []
            self._endpoints = [_FakeEndpoint(u) for u in urls]
            self.chain_id = chain_id
        async def call(self, method, params):
            # getAmountsOut quote for the sell path — selector 0x0d3648bd.
            if method == "eth_call":
                _blob = str(params)
                if "0d3648bd" in _blob:
                    if QUOTE_FAILED:
                        raise RuntimeError("simulated mainnet getAmountsOut failure")
                    # Return a REAL abi-encoded uint256[] = [in, out] -> 0.5 ETH out.
                    from eth_abi.abi import encode as _enc
                    _payload = _enc(["uint256[]"], [[0, 5 * 10**17]]).hex()
                    return "0x" + _payload
            if method == "eth_getTransactionCount":
                return "0x" + format(7, "064x")
            if method == "eth_estimateGas":
                return "0x" + format(300_000, "064x")
            if method == "eth_getBalance":
                return "0x" + format(10**18, "064x")
            if method == "eth_gasPrice":
                return "0x" + format(10**9, "064x")
            if method == "eth_maxPriorityFeePerGas":
                return "0x" + format(1_500_000_000, "064x")
            return "0x"
        async def eth_get_balance(self, addr, block="latest"):
            return 10**18
        def health(self):
            return {"endpoints": []}
        async def close(self):
            pass
    return _FakeMultiRpc

# --- Wire stubs into the module under test -----------------------------
import web3_async as w3

# Replace the live pieces with fakes.
w3.get_account = _fake_get_account
w3._estimate_eip1559_fees = _fake_estimate_eip1559_fees
w3._preflight_eth_balance = _fake_preflight
# Replace MultiRpcProvider used inside swap_token_for_eth.
_FakeMultiRpc = _make_multi_rpc(None)
w3.MultiRpcProvider = _FakeMultiRpc

# Intercept the broadcast loop's aiohttp POST so we capture the target host
# and never touch the network.
import aiohttp

class _FakeResp:
    status = 200
    def __init__(self, payload):
        self._p = payload
    async def json(self):
        return self._p
    async def __aenter__(self):
        return self
    async def __aexit__(self, *a):
        return False

class _FakeSession:
    def __init__(self, *a, **k):
        pass
    def __enter__(self):
        return self
    def __exit__(self, *a):
        return False
    async def __aenter__(self):
        return self
    async def __aexit__(self, *a):
        return False
    def post(self, url, json=None, **k):
        BROADCAST_HOSTS.append(url)
        return _FakeResp({"jsonrpc": "2.0", "id": 1, "result": "0xdeadbeef"})
    async def close(self):
        return

aiohttp.ClientSession = _FakeSession

# eth_abi encode/decode stubs (only shapes the swap code touches).
import eth_abi
_orig_encode = eth_abi.encode
def _encode_stub(types, vals):
    return b"\x00" * 32
eth_abi.encode = _encode_stub

def _decode_stub(types, data):
    from eth_abi import decode as _real
    return _real(types, data)
# The swap reads getAmountsOut result via abi_decode(['uint256[]'], ...).
# Our fake eth_call already returns a 64-zero + 0.5ETH hex; decode needs
# to surface [in, out]. Provide a real-shaped decode for uint256[].
def _fake_abi_decode(types, data):
    # data is bytes (hex-decoded by caller). Return [in, out] == [0, 0.5 ETH].
    return [0, 5 * 10**17]
w3.abi_decode = _fake_abi_decode

# --- Tests ------------------------------------------------------------
FAILURES: list[str] = []

async def test_b1_mainnet_routing():
    """B1: mainnet swap must broadcast to MAINNET RPCs only."""
    BROADCAST_HOSTS.clear()
    global QUOTE_FAILED
    QUOTE_FAILED = False
    swap_tx = []
    try:
        res = await w3.swap_token_for_eth(
            "0x" + "22" * 20,
            10**18,
            chain_id=8453,
        )
        swap_tx.append(res.get("tx_hash"))
    except Exception as exc:  # pragma: no cover
        FAILURES.append(f"B1: swap raised unexpectedly: {exc}")
        return
    # Only the final SWAP broadcast (result 0xdeadbeef) proves routing.
    if not swap_tx or swap_tx[0] != "0xdeadbeef":
        FAILURES.append(f"B1: swap did not return a tx hash: {swap_tx}")
        return
    for host in BROADCAST_HOSTS:
        if "sepolia" in host.lower():
            FAILURES.append(f"B1 VIOLATION: broadcast hit SEPOLIA host {host}")
    if not any("mainnet-rpc" in h for h in BROADCAST_HOSTS):
        FAILURES.append(
            f"B1 VIOLATION: mainnet swap did NOT hit mainnet RPCs. hosts={BROADCAST_HOSTS}"
        )

async def test_m1_strict_reject():
    """M1: mainnet quote failure MUST raise (never proceed w/ amountOutMin=1)."""
    global QUOTE_FAILED
    QUOTE_FAILED = True
    BROADCAST_HOSTS.clear()
    swap_succeeded = False
    try:
        res = await w3.swap_token_for_eth(
            "0x" + "33" * 20,
            10**18,
            chain_id=8453,
        )
        if res.get("tx_hash") == "0xdeadbeef":
            swap_succeeded = True
    except RuntimeError as exc:
        # Expected: strict reject. Confirm the message signals rejection.
        msg = str(exc).lower()
        if "reject" not in msg and "mev" not in msg and "unavailable" not in msg:
            FAILURES.append(f"M1: raised but message unclear: {exc}")
    except Exception as exc:  # pragma: no cover
        FAILURES.append(f"M1: wrong exception type: {type(exc).__name__}: {exc}")
    finally:
        QUOTE_FAILED = False
    if swap_succeeded:
        FAILURES.append(
            "M1 VIOLATION: mainnet swap PROCEEDED despite failed quote "
            "(would broadcast with amountOutMin=1 -> MEV bait)"
        )

async def main():
    await test_b1_mainnet_routing()
    await test_m1_strict_reject()
    print("=" * 60)
    print("AaaS SWAP SAFETY DIAGNOSTIC (B1 + M1)")
    print("=" * 60)
    print(f"B1 mainnet routing broadcast hosts : {BROADCAST_HOSTS or 'NONE'}")
    if FAILURES:
        print("\nRESULT: FAILED")
        for f in FAILURES:
            print(f"  [X] {f}")
        sys.exit(1)
    print("\nRESULT: PASS — exit 0")
    print("  [OK] B1: mainnet swap routed to mainnet RPCs only (no Sepolia leakage)")
    print("  [OK] M1: mainnet quote failure -> strict RuntimeError reject (no amountOutMin=1)")
    sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())
