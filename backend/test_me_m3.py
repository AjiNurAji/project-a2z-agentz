"""
WS-4 diagnostic harness for M3 (API_KEY scope) on auth.me().

Run:  python3 test_me_m3.py
No live DB / Neon / real RPC required.

Validates:
  - me() with VALID JWT -> returns that user (id from token sub).
  - me() with API_KEY ONLY (no JWT, no cookie) -> 401, NEVER impersonates
    the system/admin user (id=1). Stray API_KEY cannot masquerade.
  - me() with guest cookie only -> 401.
  - me() with no auth at all -> 401.

Exit 0 = M3 scope lock holds. Non-zero = regression.
"""
from __future__ import annotations

import os
import sys

os.environ["JWT_SECRET"] = "test-secret-00000000000000000000000000000000"
os.environ["API_KEY"] = "test-api-key-000000000000000000000000000000"
# Force a deterministic "system" user lookup to prove M3 does NOT reach it.
os.environ["BASE_CHAIN_ID"] = "8453"
os.environ["SIWE_DOMAIN"] = "project-a2z-agentz-gamma.vercel.app"

from routes import auth as auth_mod

# ---- minimal fakes --------------------------------------------------------
class _H:
    def __init__(self, d):
        self._d = {k.lower(): v for k, v in d.items()}
    def get(self, k, default=None):
        return self._d.get(k.lower(), default)

class _Req:
    def __init__(self, headers=None, cookies=None):
        self.headers = _H(headers or {})
        self.cookies = cookies or {}

FAILURES = []

def _make_jwt(sub) -> str:
    # PyJWT requires `sub` to be a string.
    import auth as root_auth
    return root_auth.create_access_token({"sub": str(sub)})

async def _check(name, req, expect_status, expect_impersonate_id=None):
    try:
        resp = await auth_mod.me(req)
        status = getattr(resp, "status_code", 200)
        import json
        body = json.loads(getattr(resp, "body", b"{}"))
    except Exception as exc:
        FAILURES.append(f"{name}: raised {type(exc).__name__}: {exc}")
        return
    if status != expect_status:
        FAILURES.append(f"{name}: expected status {expect_status}, got {status}")
        return
    if expect_impersonate_id is not None:
        got = (body.get("user") or {}).get("id")
        if got != expect_impersonate_id:
            FAILURES.append(
                f"{name}: expected user id {expect_impersonate_id}, got {got}"
            )

async def main():
    jwt_u5 = _make_jwt(5)
    jwt_u1 = _make_jwt(1)

    # 1. VALID JWT for user 5 -> 200, returns user 5 (no DB hit faked: get_user_by_id
    #    returns None in this harness, so 401 is acceptable; we only prove API_KEY
    #    path is dead). Use a stub for get_user_by_id to make this deterministic.
    import database as _db
    _orig = _db.get_user_by_id
    _db.get_user_by_id = lambda uid: {"id": uid, "email": f"u{uid}@x", "wallet_address": None}

    await _check("valid-jwt-u5", _Req(headers={"Authorization": f"Bearer {jwt_u5}"}),
            expect_status=200, expect_impersonate_id=5)
    _db.get_user_by_id = _orig

    # 2. API_KEY ONLY (the M3 vuln case) -> MUST be 401, never id=1.
    await _check("apikey-only", _Req(headers={"X-API-Key": os.environ["API_KEY"]}),
            expect_status=401)

    # 3. guest cookie only -> 401.
    await _check("guest-cookie", _Req(cookies={"a2z-token": "guest"}),
            expect_status=401)

    # 4. nothing -> 401.
    await _check("no-auth", _Req(), expect_status=401)

    # 5. API_KEY + VALID JWT for user 1 -> 200 returns user 1 via JWT path
    #    (proves JWT still works; API_KEY is simply ignored for resolution).
    _db.get_user_by_id = lambda uid: {"id": uid, "email": f"u{uid}@x", "wallet_address": None}
    await _check("jwt-u1-with-apikey",
            _Req(headers={"Authorization": f"Bearer {jwt_u1}",
                           "X-API-Key": os.environ["API_KEY"]}),
            expect_status=200, expect_impersonate_id=1)
    _db.get_user_by_id = _orig

    print("=" * 60)
    print("AaaS M3 API_KEY SCOPE DIAGNOSTIC")
    print("=" * 60)
    cases = [
        ("valid-jwt-u5", "200 + user 5"),
        ("apikey-only", "401 (NO impersonation)"),
        ("guest-cookie", "401"),
        ("no-auth", "401"),
        ("jwt-u1-with-apikey", "200 + user 1 via JWT (API_KEY ignored)"),
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
    print("  [OK] M3: X-API-Key cannot resolve/impersonate any user in /me")
    sys.exit(0)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
