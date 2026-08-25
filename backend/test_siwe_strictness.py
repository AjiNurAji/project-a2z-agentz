"""
WS-4 diagnostic harness for SIWE M2 strictness (auth.siwe_verify).

Run:  python3 test_siwe_strictness.py
No live DB / Neon / real RPC required.

Validates EIP-4361 strict checks in _siwe_verify_strict:
  - Chain ID MUST match BASE_CHAIN_ID (8453)  -> reject mismatch
  - URI MUST match request Origin (or SIWE_DOMAIN) -> reject mismatch
  - Issued-At MUST NOT be in the future (>5m skew) -> reject
  - Expiration-Time in the past -> reject
  - Not-Before in the future -> reject
  - Valid message passes strict check (returns lowercased address)

Exit 0 = all strict guards hold. Non-zero = regression.
"""
from __future__ import annotations

import os
import sys

# Hermetic env.
os.environ["BASE_CHAIN_ID"] = "8453"
os.environ["SIWE_DOMAIN"] = "project-a2z-agentz-gamma.vercel.app"
# auth.py refuses to import without JWT_SECRET / API_KEY.
os.environ["JWT_SECRET"] = "test-secret-00000000000000000000000000000000"
os.environ["API_KEY"] = "test-api-key-000000000000000000000000000000"

import auth as _root_auth  # noqa: F401  (ensures root auth importable)
from routes import auth as auth_mod

# ---- helpers --------------------------------------------------------------
def _build_msg(chain_id="8453", uri="https://project-a2z-agentz-gamma.vercel.app",
               issued_at="2024-01-01T00:00:00Z", nonce="abc123",
               exp=None, not_before=None, address="0xabc000000000000000000000000000000000000"):
    lines = [
        f"{uri} wants you to sign in with your Ethereum account:",
        f"Address: {address}",
        "",
        "Sign in to A2Z Agentz. This request will not trigger a blockchain transaction.",
        "",
        f"URI: {uri}",
        "Version: 1",
        f"Chain ID: {chain_id}",
        f"Nonce: {nonce}",
        f"Issued At: {issued_at}",
    ]
    if exp:
        lines.append(f"Expiration Time: {exp}")
    if not_before:
        lines.append(f"Not Before: {not_before}")
    return "\n".join(lines)

class _FakeReq:
    def __init__(self, origin=None):
        self.headers = {}
        if origin:
            self.headers["origin"] = origin

FAILURES = []

def _check(name, msg, origin=None, expect_ok=False):
    req = _FakeReq(origin=origin)
    try:
        addr = auth_mod._siwe_verify_strict(msg, req)
        if expect_ok:
            if addr != "0xabc000000000000000000000000000000000000":
                FAILURES.append(f"{name}: returned wrong address {addr}")
            else:
                pass  # ok
        else:
            FAILURES.append(f"{name}: EXPECTED reject but passed (addr={addr})")
    except ValueError as exc:
        if expect_ok:
            FAILURES.append(f"{name}: EXPECTED pass but rejected: {exc}")
        else:
            pass  # ok - correctly rejected
    except Exception as exc:
        FAILURES.append(f"{name}: wrong exception {type(exc).__name__}: {exc}")


async def main():
    # 1. VALID mainnet message, matching Origin -> PASS
    _check(
        "valid-mainnet",
        _build_msg(chain_id="8453",
                   uri="https://project-a2z-agentz-gamma.vercel.app",
                   issued_at="2024-01-01T00:00:00Z"),
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=True,
    )

    # 2. WRONG chain id (cross-chain replay) -> REJECT
    _check(
        "wrong-chain",
        _build_msg(chain_id="1"),  # Ethereum mainnet, not Base
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=False,
    )

    # 3. URI mismatch vs Origin (cross-domain replay) -> REJECT
    _check(
        "uri-mismatch",
        _build_msg(uri="https://evil.example.com"),
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=False,
    )

    # 4. Issued-At in the FUTURE (>5m skew) -> REJECT
    _check(
        "future-issued",
        _build_msg(issued_at="2999-01-01T00:00:00Z"),
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=False,
    )

    # 5. Expiration-Time in the PAST -> REJECT
    _check(
        "expired",
        _build_msg(exp="2020-01-01T00:00:00Z"),
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=False,
    )

    # 6. Not-Before in the FUTURE -> REJECT
    _check(
        "not-before-future",
        _build_msg(not_before="2999-01-01T00:00:00Z"),
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=False,
    )

    # 7. No URI field -> REJECT (malformed)
    _check(
        "no-uri",
        "URI: x\nVersion: 1\nChain ID: 8453\nNonce: n\nIssued At: 2024-01-01T00:00:00Z",
        origin="https://project-a2z-agentz-gamma.vercel.app",
        expect_ok=False,
    )

    print("=" * 60)
    print("AaaS SIWE M2 STRICTNESS DIAGNOSTIC")
    print("=" * 60)
    cases = [
        ("valid-mainnet", "PASS (expect_ok)"),
        ("wrong-chain", "REJECT (cross-chain)"),
        ("uri-mismatch", "REJECT (cross-domain)"),
        ("future-issued", "REJECT (future issued-at)"),
        ("expired", "REJECT (expired)"),
        ("not-before-future", "REJECT (not-before future)"),
        ("no-uri", "REJECT (malformed)"),
    ]
    for name, expect in cases:
        status = "OK " if not any(name in f for f in FAILURES) else "FAIL"
        print(f"  [{status}] {name}: {expect}")
    if FAILURES:
        print("\nRESULT: FAILED")
        for f in FAILURES:
            print(f"  [X] {f}")
        sys.exit(1)
    print("\nRESULT: PASS - exit 0")
    print("  [OK] M2: EIP-4361 strictness enforced (chain/uri/issued/exp/not-before)")
    sys.exit(0)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
