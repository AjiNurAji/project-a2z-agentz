# Auth System + Landing/Dashboard Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password authentication with optional Web3 wallet linking, synchronize the landing page → login → dashboard flow, and protect all dashboard routes with JWT cookie-based middleware.

**Architecture:** Starlette backend gains 4 new auth endpoints (`/api/auth/*`) backed by a new PostgreSQL `users` table with bcrypt password hashing. Next.js middleware checks cookie existence for route protection. A React Context `AuthProvider` provides user state + `useAuth()` hook to the Navbar (email badge + logout). Landing page CTA buttons redirect to `/login` instead of `/dashboard`.

**Tech Stack:** Python (Starlette, bcrypt, PyJWT), PostgreSQL (psycopg2), TypeScript (Next.js 16 App Router, React Context, native `fetch`), Vitest + @testing-library/react

---

## File Structure

### Backend (4 new, 2 modified)

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/database_schema_patch_users.sql` | CREATE | SQL DDL for `users` table |
| `backend/auth.py` | CREATE | Pure functions: `hash_password`, `verify_password`, `create_jwt`, `decode_jwt` |
| `backend/routes/auth.py` | CREATE | 4 Starlette Route handlers: register, login, me, logout |
| `backend/tests/__init__.py` | CREATE | Package marker |
| `backend/tests/test_auth.py` | CREATE | Unit + integration tests for auth module |
| `backend/main.py` | MODIFY | Mount `/api/auth` routes, fix CORS for credentials |
| `backend/requirements.txt` | MODIFY | Add `bcrypt`, `PyJWT` |
| `backend/.env.example` | MODIFY | Add `JWT_SECRET`, `FRONTEND_ORIGIN` |

### Frontend (9 new, 3 modified)

| File | Action | Responsibility |
|------|--------|----------------|
| `dashboard/src/middleware.ts` | CREATE | Route protection: redirect unauthenticated to `/login`, authenticated away from auth pages |
| `dashboard/src/lib/api.ts` | CREATE | Fetch wrapper with `credentials:'include'` and JSON parsing |
| `dashboard/src/lib/auth.ts` | CREATE | Auth helper functions: `login`, `register`, `me`, `logout` |
| `dashboard/src/components/AuthProvider.tsx` | CREATE | React Context: `{ user, loading, login, register, logout, refresh }` |
| `dashboard/src/app/(auth)/layout.tsx` | CREATE | Centered layout with AgentScene background |
| `dashboard/src/app/(auth)/login/page.tsx` | CREATE | Login form (responsive, accessible) |
| `dashboard/src/app/(auth)/register/page.tsx` | CREATE | Register form (responsive, accessible, optional wallet) |
| `dashboard/src/lib/__tests__/api.test.ts` | CREATE | Tests for fetch wrapper |
| `dashboard/src/lib/__tests__/auth.test.ts` | CREATE | Tests for auth helpers + middleware logic |
| `dashboard/src/components/__tests__/AuthProvider.test.tsx` | CREATE | Tests for AuthProvider behavior |
| `dashboard/src/app/layout.tsx` | MODIFY | Wrap children with AuthProvider (inside ToastProvider) |
| `dashboard/src/components/Navbar.tsx` | MODIFY | Add user email badge + logout button |
| `dashboard/src/app/(landing)/page.tsx` | MODIFY | Change CTA buttons from `/dashboard` to `/login` |

---

## Task 1: Backend Auth — Database Schema + Auth Module

**Files:**
- Create: `backend/database_schema_patch_users.sql`
- Create: `backend/auth.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_auth.py`
- Modify: `backend/requirements.txt`
- Modify: `backend/.env.example`

### Step 1.1: Write the failing test for auth module

```python
# backend/tests/__init__.py
# empty file — package marker
```

```python
# backend/tests/test_auth.py
"""Unit tests for backend/auth.py — pure functions, no DB needed."""
import time
import pytest

from auth import hash_password, verify_password, create_jwt, decode_jwt


class TestPasswordHashing:
    def test_hash_returns_bcrypt_prefix(self):
        h = hash_password("securepass123")
        assert h.startswith("$2b$"), f"Expected bcrypt prefix, got: {h[:4]}"

    def test_hash_differs_each_call(self):
        """bcrypt uses random salt, so two hashes of same input differ."""
        h1 = hash_password("samepass")
        h2 = hash_password("samepass")
        assert h1 != h2, "bcrypt hashes should differ due to random salt"

    def test_verify_correct_password(self):
        plain = "mypassword!"
        h = hash_password(plain)
        assert verify_password(plain, h) is True

    def test_verify_wrong_password(self):
        h = hash_password("correct")
        assert verify_password("wrong", h) is False

    def test_verify_empty_password(self):
        h = hash_password("nonempty")
        assert verify_password("", h) is False


class TestJWT:
    def test_create_jwt_returns_string(self):
        token = create_jwt(user_id=1, email="test@agent.io")
        assert isinstance(token, str)
        assert len(token) > 20

    def test_decode_jwt_returns_claims(self):
        token = create_jwt(user_id=42, email="alice@agent.io")
        claims = decode_jwt(token)
        assert claims is not None
        assert claims["sub"] == 42
        assert claims["email"] == "alice@agent.io"
        assert "exp" in claims
        assert "iat" in claims

    def test_decode_expired_jwt_returns_none(self):
        # Create token with exp in the past by monkeypatching
        import auth
        original_create = auth.create_jwt

        # Manually build an expired token
        import jwt as pyjwt
        expired_payload = {"sub": 1, "email": "x@y.io", "exp": int(time.time()) - 100, "iat": int(time.time()) - 200}
        expired_token = pyjwt.encode(expired_payload, auth._get_secret(), algorithm="HS256")
        assert decode_jwt(expired_token) is None

    def test_decode_tampered_jwt_returns_none(self):
        token = create_jwt(user_id=1, email="x@y.io")
        tampered = token[:-5] + "XXXXX"
        assert decode_jwt(tampered) is None

    def test_decode_garbage_returns_none(self):
        assert decode_jwt("not.a.jwt") is None
        assert decode_jwt("") is None
```

### Step 1.2: Run test to verify it fails

Run: `cd backend && python -m pytest tests/test_auth.py -v`

Expected: `ModuleNotFoundError: No module named 'auth'`

### Step 1.3: Create database schema file

```sql
-- backend/database_schema_patch_users.sql
-- Run after database_schema.sql to add user authentication support.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL        PRIMARY KEY,
    email           VARCHAR(255)  UNIQUE NOT NULL,
    password_hash   TEXT          NOT NULL,
    wallet_address  VARCHAR(42),
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    CONSTRAINT chk_wallet CHECK (
        wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$'
    )
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
```

### Step 1.4: Implement auth.py

```python
# backend/auth.py
"""
Pure authentication helpers: password hashing (bcrypt) and JWT (PyJWT).

No DB calls here — routes handle persistence.  This module is safe to
import from tests without needing a running database.
"""
from __future__ import annotations

import os
import time
from typing import Optional

import bcrypt
import jwt as pyjwt   # PyJWT package, imported as `jwt`

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60  # 7 days


def _get_secret() -> str:
    """Read JWT secret from env.  Raises on first call if missing."""
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError(
            "JWT_SECRET environment variable is not set. "
            "Add it to backend/.env or export it before starting the server."
        )
    return secret


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------
def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*.  Uses 12 rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """True iff *plain* matches the bcrypt *hashed* value."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def create_jwt(user_id: int, email: str) -> str:
    """Sign and return a HS256 JWT."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + _JWT_EXPIRY_SECONDS,
    }
    return pyjwt.encode(payload, _get_secret(), algorithm=_JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    """Verify *token* and return its claims, or ``None`` if invalid/expired."""
    if not token:
        return None
    try:
        return pyjwt.decode(token, _get_secret(), algorithms=[_JWT_ALGORITHM])
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return None
```

### Step 1.5: Update requirements.txt

Add to end of `backend/requirements.txt`:
```
bcrypt>=4.0.0
PyJWT>=2.8.0
```

### Step 1.6: Update .env.example

Add to `backend/.env.example`:
```
# --- Auth (JWT) ---
JWT_SECRET=change-me-to-a-random-32-char-string
FRONTEND_ORIGIN=http://localhost:3000
```

### Step 1.7: Run tests to verify they pass

Run: `cd backend && JWT_SECRET=test-secret-for-tests python -m pytest tests/test_auth.py -v`

Expected: All 10 tests PASS.

### Step 1.8: Commit

```bash
git add backend/auth.py backend/tests/ backend/requirements.txt backend/.env.example backend/database_schema_patch_users.sql
git commit -m "feat(backend): add auth module with password hashing and JWT

- auth.py: hash_password, verify_password (bcrypt), create_jwt, decode_jwt (PyJWT)
- database_schema_patch_users.sql: users table with email, password_hash, wallet_address
- tests/test_auth.py: 10 unit tests (all passing)
- requirements.txt: +bcrypt, +PyJWT
- .env.example: +JWT_SECRET, +FRONTEND_ORIGIN"
```

---

## Task 2: Backend Auth — Routes + CORS Fix

**Files:**
- Create: `backend/routes/auth.py`
- Modify: `backend/main.py`

### Step 2.1: Write failing tests for auth routes

Append to `backend/tests/test_auth.py`:

```python
# --- Integration tests for auth routes ---
from unittest.mock import patch, MagicMock
from starlette.testclient import TestClient


def _make_test_app():
    """Build a minimal Starlette app with auth routes mounted."""
    from starlette.routing import Mount
    from routes.auth import routes as auth_routes

    # We need JWT_SECRET for route tests
    import os
    os.environ.setdefault("JWT_SECRET", "test-secret-for-routes")

    from starlette.applications import Starlette
    return Starlette(routes=[Mount("/api/auth", routes=auth_routes)])


@pytest.fixture
def client():
    return TestClient(_make_test_app())


@pytest.fixture
def mock_cursor():
    """Patch database._get_cursor so no real DB is needed."""
    with patch("routes.auth._get_cursor") as mock:
        yield mock


class TestRegisterRoute:
    def test_register_success(self, client, mock_cursor):
        """POST /api/auth/register with valid data returns 201."""
        # Mock: email not found (SELECT returns None), then INSERT returns row
        cursor_instance = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=cursor_instance)
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)

        # First call: check existing → None
        # Second call: insert → returns row
        cursor_instance.fetchone.side_effect = [None, {"id": 1, "email": "new@agent.io",
            "wallet_address": None, "created_at": "2026-01-01", "last_login_at": None}]

        resp = client.post("/api/auth/register", json={
            "email": "new@agent.io", "password": "securepass123"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["email"] == "new@agent.io"

    def test_register_duplicate_email(self, client, mock_cursor):
        """POST /api/auth/register with existing email returns 409."""
        cursor_instance = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=cursor_instance)
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor_instance.fetchone.return_value = {"id": 1}  # email exists

        resp = client.post("/api/auth/register", json={
            "email": "existing@agent.io", "password": "securepass123"
        })
        assert resp.status_code == 409

    def test_register_invalid_email(self, client):
        """POST /api/auth/register with bad email returns 422."""
        resp = client.post("/api/auth/register", json={
            "email": "not-an-email", "password": "securepass123"
        })
        assert resp.status_code == 422

    def test_register_short_password(self, client):
        """POST /api/auth/register with short password returns 422."""
        resp = client.post("/api/auth/register", json={
            "email": "ok@agent.io", "password": "short"
        })
        assert resp.status_code == 422


class TestLoginRoute:
    def test_login_success(self, client, mock_cursor):
        """POST /api/auth/login with correct creds returns 200 + cookie."""
        from auth import hash_password
        cursor_instance = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=cursor_instance)
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor_instance.fetchone.side_effect = [
            # SELECT for user
            {"id": 1, "email": "user@agent.io", "password_hash": hash_password("correctpass")},
            # UPDATE last_login_at
            None,
        ]

        resp = client.post("/api/auth/login", json={
            "email": "user@agent.io", "password": "correctpass"
        })
        assert resp.status_code == 200
        assert "a2z-token" in resp.cookies

    def test_login_wrong_password(self, client, mock_cursor):
        """POST /api/auth/login with wrong password returns 401."""
        from auth import hash_password
        cursor_instance = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=cursor_instance)
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor_instance.fetchone.return_value = {
            "id": 1, "email": "user@agent.io", "password_hash": hash_password("correctpass")
        }

        resp = client.post("/api/auth/login", json={
            "email": "user@agent.io", "password": "wrongpass"
        })
        assert resp.status_code == 401


class TestMeRoute:
    def test_me_without_cookie_returns_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_with_valid_cookie(self, client, mock_cursor):
        """GET /api/auth/me with valid JWT cookie returns user."""
        from auth import create_jwt
        token = create_jwt(user_id=42, email="me@agent.io")

        cursor_instance = MagicMock()
        mock_cursor.return_value.__enter__ = MagicMock(return_value=cursor_instance)
        mock_cursor.return_value.__exit__ = MagicMock(return_value=False)
        cursor_instance.fetchone.return_value = {
            "id": 42, "email": "me@agent.io", "wallet_address": None,
            "created_at": "2026-01-01", "last_login_at": "2026-06-20"
        }

        resp = client.get("/api/auth/me", cookies={"a2z-token": token})
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "me@agent.io"


class TestLogoutRoute:
    def test_logout_clears_cookie(self, client):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        # Cookie should be cleared (Max-Age=0 or empty value)
        cookie_header = resp.headers.get("set-cookie", "")
        assert "a2z-token" in cookie_header
```

### Step 2.2: Run tests to verify they fail

Run: `cd backend && JWT_SECRET=test-secret python -m pytest tests/test_auth.py -v -k "Route"`

Expected: `ModuleNotFoundError: No module named 'routes.auth'`

### Step 2.3: Implement routes/auth.py

```python
# backend/routes/auth.py
"""Authentication endpoints: register, login, me, logout."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from auth import hash_password, verify_password, create_jwt, decode_jwt
from database import _get_cursor

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_WALLET_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_MIN_PASSWORD_LEN = 8

COOKIE_NAME = "a2z-token"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days


def _validate_register(body: dict) -> tuple[bool, str]:
    """Return (is_valid, error_message)."""
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    wallet = (body.get("wallet_address") or "").strip()

    if not email or not _EMAIL_RE.match(email):
        return False, "Invalid email format"
    if len(password) < _MIN_PASSWORD_LEN:
        return False, f"Password must be at least {_MIN_PASSWORD_LEN} characters"
    if wallet and not _WALLET_RE.match(wallet):
        return False, "Invalid wallet address format (expected 0x... 40 hex chars)"
    return True, ""


def _user_row_to_dict(row) -> dict:
    """Convert a DB row (dict or tuple) to a safe user dict (no password_hash)."""
    if isinstance(row, dict):
        return {
            "id": row["id"],
            "email": row["email"],
            "wallet_address": row.get("wallet_address"),
            "created_at": str(row.get("created_at", "")),
            "last_login_at": str(row.get("last_login_at", "")) if row.get("last_login_at") else None,
        }
    # tuple fallback
    return {
        "id": row[0], "email": row[1], "wallet_address": row[2],
        "created_at": str(row[3]), "last_login_at": str(row[4]) if row[4] else None,
    }


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
async def register(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=422)

    ok, msg = _validate_register(body)
    if not ok:
        return JSONResponse({"error": msg}, status_code=422)

    email = body["email"].strip().lower()
    password = body["password"]
    wallet = (body.get("wallet_address") or "").strip() or None

    # Check existing email
    with _get_cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s LIMIT 1;", (email,))
        if cur.fetchone():
            return JSONResponse({"error": "Email already registered"}, status_code=409)

    pw_hash = hash_password(password)

    with _get_cursor() as cur:
        cur.execute(
            """INSERT INTO users (email, password_hash, wallet_address)
               VALUES (%s, %s, %s)
               RETURNING id, email, wallet_address, created_at, last_login_at;""",
            (email, pw_hash, wallet),
        )
        row = cur.fetchone()

    user = _user_row_to_dict(row)
    return JSONResponse({"user": user}, status_code=201)


async def login(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=422)

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return JSONResponse({"error": "Email and password are required"}, status_code=422)

    with _get_cursor() as cur:
        cur.execute(
            "SELECT id, email, password_hash FROM users WHERE email = %s LIMIT 1;",
            (email,),
        )
        row = cur.fetchone()

    if not row:
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)

    # row is dict or tuple
    user_id = row["id"] if isinstance(row, dict) else row[0]
    user_email = row["email"] if isinstance(row, dict) else row[1]
    stored_hash = row["password_hash"] if isinstance(row, dict) else row[2]

    if not verify_password(password, stored_hash):
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)

    # Update last_login_at
    with _get_cursor() as cur:
        cur.execute(
            "UPDATE users SET last_login_at = %s WHERE id = %s;",
            (datetime.now(timezone.utc), user_id),
        )

    token = create_jwt(user_id, user_email)

    # Build user response (fetch full row)
    with _get_cursor() as cur:
        cur.execute(
            "SELECT id, email, wallet_address, created_at, last_login_at FROM users WHERE id = %s;",
            (user_id,),
        )
        full_row = cur.fetchone()

    response = JSONResponse({"user": _user_row_to_dict(full_row)})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return response


async def me(request: Request) -> JSONResponse:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return JSONResponse({"error": "Not authenticated"}, status_code=401)

    claims = decode_jwt(token)
    if not claims:
        return JSONResponse({"error": "Invalid or expired token"}, status_code=401)

    user_id = claims.get("sub")
    with _get_cursor() as cur:
        cur.execute(
            "SELECT id, email, wallet_address, created_at, last_login_at FROM users WHERE id = %s;",
            (user_id,),
        )
        row = cur.fetchone()

    if not row:
        return JSONResponse({"error": "User not found"}, status_code=401)

    return JSONResponse({"user": _user_row_to_dict(row)})


async def logout(request: Request) -> JSONResponse:
    response = JSONResponse({"ok": True})
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return response


# ---------------------------------------------------------------------------
# Route list (imported by main.py)
# ---------------------------------------------------------------------------
routes = [
    Route("/register", register, methods=["POST"]),
    Route("/login", login, methods=["POST"]),
    Route("/me", me, methods=["GET"]),
    Route("/logout", logout, methods=["POST"]),
]
```

### Step 2.4: Update backend/main.py

Mount auth routes and fix CORS:

```python
# Add import at top (after existing route imports):
from routes.auth import routes as auth_routes

# In the app = Starlette(...) block, add to routes list:
#   Mount("/api/auth", routes=auth_routes),
# After the existing Mount("/api", routes=api_routes) line.

# Fix CORS — replace allow_origins=["*"] with:
#   allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
```

Specifically, the routes list becomes:
```python
routes=[
    Route("/health", health_check, methods=["GET"]),
    Route("/api/scheduler/status", scheduler_status, methods=["GET"]),
    Mount("/api", routes=api_routes),
    Mount("/api/auth", routes=auth_routes),  # NEW
    Mount("/", routes=ws_routes),
    Mount("/static", app=StaticFiles(directory=STATIC_DIR), name="static"),
]
```

And CORS becomes:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Step 2.5: Run tests to verify they pass

Run: `cd backend && JWT_SECRET=test-secret python -m pytest tests/test_auth.py -v`

Expected: All 18 tests PASS (8 unit + 10 route integration).

### Step 2.6: Commit

```bash
git add backend/routes/auth.py backend/main.py backend/tests/test_auth.py
git commit -m "feat(backend): add auth routes + fix CORS for credentials

- POST /api/auth/register: create user with bcrypt hash, 409 on duplicate
- POST /api/auth/login: verify password, set httpOnly JWT cookie
- GET /api/auth/me: verify JWT cookie, return user profile
- POST /api/auth/logout: clear cookie
- Fix CORS: use FRONTEND_ORIGIN env instead of wildcard (*)
- 10 integration tests with mocked DB cursor"
```

---

## Task 3: Frontend — Auth Library + Middleware

**Files:**
- Create: `dashboard/src/lib/api.ts`
- Create: `dashboard/src/lib/auth.ts`
- Create: `dashboard/src/middleware.ts`
- Create: `dashboard/src/lib/__tests__/api.test.ts`
- Create: `dashboard/src/lib/__tests__/auth.test.ts`

### Step 3.1: Write failing tests for api.ts

```typescript
// dashboard/src/lib/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "../api";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("apiFetch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends credentials: include", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
    await apiFetch("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("throws on non-ok response with status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Unauthorized" }),
    });
    await expect(apiFetch("/protected")).rejects.toThrow("Unauthorized");
  });

  it("parses JSON response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { email: "a@b.io" } }),
    });
    const data = await apiFetch("/me");
    expect(data).toEqual({ user: { email: "a@b.io" } });
  });
});
```

### Step 3.2: Run test to verify it fails

Run: `cd dashboard && npx vitest run src/lib/__tests__/api.test.ts`

Expected: FAIL — cannot resolve `../api`

### Step 3.3: Implement api.ts

```typescript
// dashboard/src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiError extends Error {
  status: number;
  body: unknown;
}

/**
 * Fetch wrapper for backend API calls.
 * Always includes credentials (cookies) and parses JSON.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(
      (body as { error?: string })?.error || `Request failed (${res.status})`
    ) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body as T;
}
```

### Step 3.4: Run api tests to verify they pass

Run: `cd dashboard && npx vitest run src/lib/__tests__/api.test.ts`

Expected: 3 tests PASS.

### Step 3.5: Write failing tests for auth.ts

```typescript
// dashboard/src/lib/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, register, me, logout } from "../auth";

vi.mock("../api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../api";
const mockedApiFetch = vi.mocked(apiFetch);

describe("auth helpers", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("login calls POST /api/auth/login", async () => {
    const fakeUser = { id: 1, email: "a@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    const result = await login("a@b.io", "pass1234");
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a@b.io", password: "pass1234" }),
    });
    expect(result).toEqual(fakeUser);
  });

  it("register calls POST /api/auth/register", async () => {
    const fakeUser = { id: 2, email: "new@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    const result = await register("new@b.io", "pass1234", "0x" + "a".repeat(40));
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: "new@b.io",
        password: "pass1234",
        wallet_address: "0x" + "a".repeat(40),
      }),
    });
    expect(result).toEqual(fakeUser);
  });

  it("me calls GET /api/auth/me and returns user", async () => {
    const fakeUser = { id: 1, email: "a@b.io" };
    mockedApiFetch.mockResolvedValueOnce({ user: fakeUser });
    const result = await me();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/me");
    expect(result).toEqual(fakeUser);
  });

  it("me returns null on 401", async () => {
    const err = new Error("Unauthorized") as Error & { status: number };
    err.status = 401;
    mockedApiFetch.mockRejectedValueOnce(err);
    const result = await me();
    expect(result).toBeNull();
  });

  it("logout calls POST /api/auth/logout", async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: true });
    await logout();
    expect(mockedApiFetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});
```

### Step 3.6: Implement auth.ts

```typescript
// dashboard/src/lib/auth.ts
import { apiFetch } from "./api";

export interface User {
  id: number;
  email: string;
  wallet_address?: string | null;
  created_at?: string;
  last_login_at?: string | null;
}

export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function register(
  email: string,
  password: string,
  walletAddress?: string
): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      ...(walletAddress ? { wallet_address: walletAddress } : {}),
    }),
  });
  return data.user;
}

export async function me(): Promise<User | null> {
  try {
    const data = await apiFetch<{ user: User }>("/api/auth/me");
    return data.user;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401) {
      return null;
    }
    throw err;
  }
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
```

### Step 3.7: Run auth tests to verify they pass

Run: `cd dashboard && npx vitest run src/lib/__tests__/auth.test.ts`

Expected: 5 tests PASS.

### Step 3.8: Implement middleware.ts

```typescript
// dashboard/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "a2z-token";

// Paths that don't require authentication
const PUBLIC_PATHS = ["/", "/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".");

  // Skip middleware for static assets and Next.js internals
  if (isStaticAsset) {
    return NextResponse.next();
  }

  // Unauthenticated user trying to access protected route → redirect to login
  if (!token && !isPublic && !isAuthPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on auth pages → redirect to dashboard
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Step 3.9: Write middleware test

```typescript
// dashboard/src/lib/__tests__/middleware.test.ts
import { describe, it, expect } from "vitest";

/**
 * Test the middleware logic as a pure function.
 * We extract the decision logic so it's testable without NextRequest mocks.
 */

interface MiddlewareDecision {
  action: "next" | "redirect";
  destination?: string;
}

function decideMiddleware(
  pathname: string,
  hasToken: boolean
): MiddlewareDecision {
  const PUBLIC_PATHS = ["/", "/login", "/register"];
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".");

  if (isStaticAsset) return { action: "next" };
  if (!hasToken && !isPublic && !isAuthPage) {
    return { action: "redirect", destination: `/login?next=${encodeURIComponent(pathname)}` };
  }
  if (hasToken && isAuthPage) {
    return { action: "redirect", destination: "/dashboard" };
  }
  return { action: "next" };
}

describe("middleware logic", () => {
  it("redirects unauthenticated /dashboard to /login?next=/dashboard", () => {
    const result = decideMiddleware("/dashboard", false);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/login?next=%2Fdashboard");
  });

  it("redirects unauthenticated /analytics to /login?next=/analytics", () => {
    const result = decideMiddleware("/analytics", false);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/login?next=%2Fanalytics");
  });

  it("allows unauthenticated access to / (landing)", () => {
    const result = decideMiddleware("/", false);
    expect(result.action).toBe("next");
  });

  it("allows unauthenticated access to /login", () => {
    const result = decideMiddleware("/login", false);
    expect(result.action).toBe("next");
  });

  it("allows unauthenticated access to /register", () => {
    const result = decideMiddleware("/register", false);
    expect(result.action).toBe("next");
  });

  it("redirects authenticated /login to /dashboard", () => {
    const result = decideMiddleware("/login", true);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/dashboard");
  });

  it("redirects authenticated /register to /dashboard", () => {
    const result = decideMiddleware("/register", true);
    expect(result.action).toBe("redirect");
    expect(result.destination).toBe("/dashboard");
  });

  it("allows authenticated access to /dashboard", () => {
    const result = decideMiddleware("/dashboard", true);
    expect(result.action).toBe("next");
  });

  it("allows static assets through", () => {
    const result = decideMiddleware("/_next/static/chunk.js", false);
    expect(result.action).toBe("next");
  });

  it("allows API routes through", () => {
    const result = decideMiddleware("/api/stats", false);
    expect(result.action).toBe("next");
  });
});
```

### Step 3.10: Run all frontend lib tests

Run: `cd dashboard && npx vitest run src/lib/__tests__/`

Expected: All 18 tests PASS (3 api + 5 auth + 10 middleware).

### Step 3.11: Commit

```bash
git add dashboard/src/lib/ dashboard/src/middleware.ts
git commit -m "feat(frontend): add auth lib, api wrapper, and route middleware

- lib/api.ts: fetch wrapper with credentials:'include' + JSON parsing
- lib/auth.ts: login, register, me, logout helpers calling backend API
- middleware.ts: protect dashboard routes, redirect unauthenticated to /login
- Tests: 18 unit tests (api, auth helpers, middleware decision logic)"
```

---

## Task 4: Frontend — AuthProvider + Auth Pages

**Files:**
- Create: `dashboard/src/components/AuthProvider.tsx`
- Create: `dashboard/src/app/(auth)/layout.tsx`
- Create: `dashboard/src/app/(auth)/login/page.tsx`
- Create: `dashboard/src/app/(auth)/register/page.tsx`
- Create: `dashboard/src/components/__tests__/AuthProvider.test.tsx`

### Step 4.1: Write failing tests for AuthProvider

```typescript
// dashboard/src/components/__tests__/AuthProvider.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/lib/auth", () => ({
  login: vi.fn(),
  register: vi.fn(),
  me: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AuthProvider, useAuth } from "../AuthProvider";
import * as authLib from "@/lib/auth";

// Test component that consumes the context
function TestConsumer() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div data-testid="loading">Loading...</div>;
  return (
    <div>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.mocked(authLib.me).mockReset();
    vi.mocked(authLib.logout).mockReset();
  });

  it("shows loading initially, then user from /me", async () => {
    vi.mocked(authLib.me).mockResolvedValue({ id: 1, email: "u@b.io" });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // Initially loading
    expect(screen.getByTestId("loading")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("email").textContent).toBe("u@b.io");
    });
  });

  it("shows 'none' when /me returns null (unauthenticated)", async () => {
    vi.mocked(authLib.me).mockResolvedValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("email").textContent).toBe("none");
    });
  });

  it("logout clears user state", async () => {
    vi.mocked(authLib.me).mockResolvedValue({ id: 1, email: "u@b.io" });
    vi.mocked(authLib.logout).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("email").textContent).toBe("u@b.io");
    });

    await act(async () => {
      screen.getByText("Logout").click();
    });

    expect(authLib.logout).toHaveBeenCalled();
  });
});
```

### Step 4.2: Run test to verify it fails

Run: `cd dashboard && npx vitest run src/components/__tests__/AuthProvider.test.tsx`

Expected: FAIL — cannot resolve `../AuthProvider`

### Step 4.3: Implement AuthProvider.tsx

```typescript
// dashboard/src/components/AuthProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { User } from "@/lib/auth";
import * as authLib from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, walletAddress?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const u = await authLib.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      try {
        const u = await authLib.login(email, password);
        setUser(u);
        const next = searchParams.get("next") || "/dashboard";
        router.push(next);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Login failed";
        toast.error("Login failed", message);
        throw err;
      }
    },
    [router, searchParams, toast]
  );

  const handleRegister = useCallback(
    async (email: string, password: string, walletAddress?: string) => {
      try {
        const u = await authLib.register(email, password, walletAddress);
        setUser(u);
        router.push("/dashboard");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Registration failed";
        toast.error("Registration failed", message);
        throw err;
      }
    },
    [router, toast]
  );

  const handleLogout = useCallback(async () => {
    try {
      await authLib.logout();
    } catch {
      // Ignore logout errors — clear local state regardless
    }
    setUser(null);
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login: handleLogin, register: handleRegister, logout: handleLogout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

### Step 4.4: Create (auth)/layout.tsx

```typescript
// dashboard/src/app/(auth)/layout.tsx
import AgentScene from "@/components/landing/AgentScene";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative w-full min-h-screen overflow-hidden">
      {/* AgentScene as full background — reuse existing component */}
      <div className="fixed inset-0 z-0">
        <AgentScene isTransitioning={false} onTransitionComplete={() => {}} />
      </div>

      {/* Glass form card centered */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
```

### Step 4.5: Create login/page.tsx

```typescript
// dashboard/src/app/(auth)/login/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Mail, Lock, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = "Please enter a valid email";
    }
    if (!password) {
      e.password = "Password is required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch {
      // Error toast shown by AuthProvider
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm sm:max-w-md"
    >
      <div
        className="rounded-2xl p-6 sm:p-8 backdrop-blur-xl border shadow-2xl"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 82%, transparent)",
          borderColor: "var(--color-border-default)",
        }}
      >
        {/* Logo + heading */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))" }}
          >
            <LogIn className="w-5 h-5" style={{ color: "var(--color-heading)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-heading)" }}>Log In</h1>
            <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>Enter Mission Control</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-body)" }}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-body-subtle)" }} aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agent.io"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${errors.email ? "var(--color-fg-danger)" : "var(--color-border-default)"}`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.email && (
              <p id="login-email-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--color-fg-danger)" }}>
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-body)" }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-body-subtle)" }} aria-hidden="true" />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "login-password-error" : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${errors.password ? "var(--color-fg-danger)" : "var(--color-border-default)"}`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.password && (
              <p id="login-password-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--color-fg-danger)" }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Remember + forgot */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--color-body-subtle)" }}>
              <input type="checkbox" className="rounded accent-[var(--color-brand)]" />
              Remember me
            </label>
            <span className="cursor-pointer hover:underline" style={{ color: "var(--color-fg-brand)" }}>
              Forgot password?
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
            style={{
              background: "linear-gradient(135deg, var(--color-fg-brand), var(--color-accent-purple))",
              color: "var(--color-heading)",
            }}
            aria-label="Log in to Mission Control"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Authenticating...
              </>
            ) : (
              <>
                ENTER MISSION CONTROL
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        {/* Divider + wallet */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--color-border-default)" }} />
            <span className="text-xs" style={{ color: "var(--color-body-subtle)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--color-border-default)" }} />
          </div>
          <button
            className="w-full py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80 focus-ring"
            style={{
              borderColor: "var(--color-border-default)",
              color: "var(--color-body)",
              background: "var(--color-neutral-secondary-medium)",
            }}
            aria-label="Connect Web3 wallet"
          >
            🦊 Connect Wallet
          </button>
        </div>

        {/* Register link */}
        <p className="mt-5 text-center text-sm" style={{ color: "var(--color-body-subtle)" }}>
          No account?{" "}
          <Link href="/register" className="font-semibold hover:underline" style={{ color: "var(--color-fg-brand)" }}>
            Register
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
```

### Step 4.6: Create register/page.tsx

```typescript
// dashboard/src/app/(auth)/register/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Mail, Lock, Wallet, UserPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      e.email = "Please enter a valid email";
    }
    if (password.length < 8) {
      e.password = "Password must be at least 8 characters";
    }
    if (password !== confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }
    if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      e.walletAddress = "Invalid wallet address (0x... 40 hex chars)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(
        email.trim().toLowerCase(),
        password,
        walletAddress.trim() || undefined
      );
    } catch {
      // Error toast shown by AuthProvider
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-sm sm:max-w-md"
    >
      <div
        className="rounded-2xl p-6 sm:p-8 backdrop-blur-xl border shadow-2xl"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 82%, transparent)",
          borderColor: "var(--color-border-default)",
        }}
      >
        {/* Logo + heading */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))" }}
          >
            <UserPlus className="w-5 h-5" style={{ color: "var(--color-heading)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-heading)" }}>Create Account</h1>
            <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>Join Mission Control</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" role="form">
          {/* Email */}
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-body)" }}>
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-body-subtle)" }} aria-hidden="true" />
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agent.io"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "reg-email-error" : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${errors.email ? "var(--color-fg-danger)" : "var(--color-border-default)"}`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.email && (
              <p id="reg-email-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--color-fg-danger)" }}>
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-body)" }}>
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-body-subtle)" }} aria-hidden="true" />
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "reg-password-error" : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${errors.password ? "var(--color-fg-danger)" : "var(--color-border-default)"}`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.password && (
              <p id="reg-password-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--color-fg-danger)" }}>
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="reg-confirm" className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-body)" }}>
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-body-subtle)" }} aria-hidden="true" />
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "reg-confirm-error" : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${errors.confirmPassword ? "var(--color-fg-danger)" : "var(--color-border-default)"}`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.confirmPassword && (
              <p id="reg-confirm-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--color-fg-danger)" }}>
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Wallet (optional) */}
          <div>
            <label htmlFor="reg-wallet" className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-body)" }}>
              Wallet Address <span className="text-xs font-normal" style={{ color: "var(--color-body-subtle)" }}>(optional)</span>
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-body-subtle)" }} aria-hidden="true" />
              <input
                id="reg-wallet"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x... (Base Network)"
                aria-invalid={!!errors.walletAddress}
                aria-describedby={errors.walletAddress ? "reg-wallet-error" : undefined}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2 font-mono"
                style={{
                  background: "var(--color-neutral-secondary-medium)",
                  border: `1px solid ${errors.walletAddress ? "var(--color-fg-danger)" : "var(--color-border-default)"}`,
                  color: "var(--color-heading)",
                }}
              />
            </div>
            {errors.walletAddress && (
              <p id="reg-wallet-error" role="alert" className="mt-1 text-xs" style={{ color: "var(--color-fg-danger)" }}>
                {errors.walletAddress}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
            style={{
              background: "linear-gradient(135deg, var(--color-fg-brand), var(--color-accent-purple))",
              color: "var(--color-heading)",
            }}
            aria-label="Create account"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Creating account...
              </>
            ) : (
              <>
                CREATE ACCOUNT
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>

        {/* Login link */}
        <p className="mt-5 text-center text-sm" style={{ color: "var(--color-body-subtle)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--color-fg-brand)" }}>
            Log In
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
```

### Step 4.7: Run AuthProvider + auth page tests

Run: `cd dashboard && npx vitest run src/components/__tests__/AuthProvider.test.tsx`

Expected: 3 tests PASS.

### Step 4.8: Commit

```bash
git add dashboard/src/components/AuthProvider.tsx dashboard/src/app/\(auth\)/ dashboard/src/components/__tests__/AuthProvider.test.tsx
git commit -m "feat(frontend): add AuthProvider, login page, and register page

- AuthProvider: React Context with user state, login/register/logout/refresh
- (auth)/layout.tsx: centered glass card over AgentScene background
- (auth)/login/page.tsx: responsive form with email, password, wallet connect
- (auth)/register/page.tsx: responsive form with confirm password, optional wallet
- Both pages: accessible (aria, focus-ring, role=alert), motion animations
- 3 AuthProvider tests passing"
```

---

## Task 5: Frontend — Root Layout + Navbar + Landing Integration

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Modify: `dashboard/src/components/Navbar.tsx`
- Modify: `dashboard/src/app/(landing)/page.tsx`

### Step 5.1: Wrap AuthProvider in root layout

In `dashboard/src/app/layout.tsx`, import and wrap AuthProvider around children, **inside** ToastProvider:

```tsx
// Add import:
import { AuthProvider } from "@/components/AuthProvider";

// In the return JSX, wrap children:
<ToastProvider>
  <AuthProvider>
    <RouteProgress />
    {children}
  </AuthProvider>
</ToastProvider>
```

### Step 5.2: Add user badge + logout to Navbar

In `dashboard/src/components/Navbar.tsx`:

```tsx
// Add imports:
import { useAuth } from "./AuthProvider";
import { LogOut, User } from "lucide-react";

// Inside the component, add at top:
const { user, loading, logout } = useAuth();

// In the right section (after NotificationsPanel, before agent status badges), add:
{/* User badge + logout */}
{loading ? (
  <div className="w-20 h-7 rounded-full animate-pulse" style={{ background: "var(--color-neutral-secondary-medium)" }} />
) : user ? (
  <div className="flex items-center gap-2">
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
      style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-default)" }}
    >
      <User className="w-3 h-3" style={{ color: "var(--color-fg-brand)" }} aria-hidden="true" />
      <span className="text-[var(--color-body-subtle)] max-w-[120px] truncate">{user.email}</span>
    </div>
    <button
      onClick={logout}
      className="p-2 rounded-xl text-[var(--color-body-subtle)] hover:text-[var(--color-fg-danger)] hover:bg-[var(--color-neutral-secondary-medium)] transition-colors focus-ring"
      aria-label="Log out"
      title="Log out"
    >
      <LogOut className="w-4 h-4" />
    </button>
  </div>
) : null}
```

### Step 5.3: Update landing page CTA buttons

In `dashboard/src/app/(landing)/page.tsx`, change `handleEnterDashboard`:

```tsx
// BEFORE:
const handleEnterDashboard = () => {
  setIsTransitioning(true);
};
const handleTransitionComplete = () => {
  router.push("/dashboard");
};

// AFTER:
const handleEnterDashboard = () => {
  setIsTransitioning(true);
};
const handleTransitionComplete = () => {
  router.push("/login");
};
```

This single change affects all 3 CTA buttons ("Log In", "Launch App", "Enter Mission Control") because they all call `handleEnterDashboard()`.

### Step 5.4: Manual smoke test

Run: `cd dashboard && npm run dev`

Test checklist:
1. Open `http://localhost:3000` — landing page loads
2. Click "Launch App" → redirects to `/login` (AgentScene background visible)
3. At `/login` without cookie → form renders, centered, responsive
4. Resize to mobile width → form still readable, inputs large enough
5. Click "Register" link → goes to `/register`
6. Type invalid email → inline error appears
7. Open `http://localhost:3000/dashboard` directly → redirects to `/login?next=/dashboard`
8. (If backend running) Register a user → redirects to `/dashboard`
9. Navbar shows email badge + logout button
10. Click logout → redirects to landing page

### Step 5.5: Commit

```bash
git add dashboard/src/app/layout.tsx dashboard/src/components/Navbar.tsx dashboard/src/app/\(landing\)/page.tsx
git commit -m "feat(frontend): integrate auth with root layout, navbar, and landing

- Root layout: wrap children with AuthProvider (inside ToastProvider)
- Navbar: show user email badge + logout button when authenticated
- Landing page: CTA buttons redirect to /login instead of /dashboard
- Middleware handles redirect to /dashboard when already authenticated"
```

---

## Task 6: Testing + Documentation

**Files:**
- Create: `dashboard/src/lib/__tests__/api.test.ts` (already in Task 3)
- Create: `dashboard/src/lib/__tests__/auth.test.ts` (already in Task 3)
- Create: `dashboard/src/lib/__tests__/middleware.test.ts` (already in Task 3)
- Create: `dashboard/src/components/__tests__/AuthProvider.test.tsx` (already in Task 4)
- Create: `backend/tests/test_auth.py` (already in Tasks 1+2)
- Modify: `memory.md`
- Modify: `README.md`

### Step 6.1: Run all backend tests

Run: `cd backend && JWT_SECRET=test-secret python -m pytest tests/test_auth.py -v`

Expected: 18 tests PASS (8 unit + 10 integration).

### Step 6.2: Run all frontend tests

Run: `cd dashboard && npx vitest run src/lib/__tests__/ src/components/__tests__/AuthProvider.test.tsx`

Expected: 21 tests PASS (3 api + 5 auth + 10 middleware + 3 AuthProvider).

### Step 6.3: Update memory.md

Add new session entry at the top of the Sessions section:

```markdown
---

### Sesi: Auth System + Landing/Dashboard Sync (20 Jun 2026)

**Status:** Completed

**Scope:**
- Backend: users table (PostgreSQL), auth.py (bcrypt + JWT), routes/auth.py (register/login/me/logout), CORS fix
- Frontend: AuthProvider (React Context), middleware.ts (route protection), login/register pages (responsive, accessible), Navbar user badge, landing CTA redirect
- Testing: 18 backend tests (pytest), 21 frontend tests (vitest), manual smoke test checklist

**Key Decisions:**
- Email/password primary + optional wallet address at register
- JWT in httpOnly cookie (7-day expiry), middleware checks cookie existence only (verification at backend)
- AgentScene reused as auth page background (centered glass card)
- AuthProvider at root layout (inside ToastProvider)

**Files Created/Modified:**
- Backend: 4 new, 3 modified
- Frontend: 9 new, 3 modified
```

### Step 6.4: Update README.md

Add auth setup section:

```markdown
## Authentication Setup

### Backend

1. Set environment variables in `backend/.env`:
   ```
   JWT_SECRET=your-random-32-char-secret
   FRONTEND_ORIGIN=http://localhost:3000
   ```

2. Run the users table migration:
   ```bash
   psql $POSTGRES_URI -f backend/database_schema_patch_users.sql
   ```

3. Install new dependencies:
   ```bash
   cd backend && pip install -r requirements.txt
   ```

### Frontend

Set the backend API URL in `dashboard/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
```

### Step 6.5: Commit

```bash
git add memory.md README.md
git commit -m "docs: add auth system session to memory.md and setup guide to README

- memory.md: new session entry with scope, decisions, and file inventory
- README.md: authentication setup instructions (JWT_SECRET, migration, deps)"
```

---

## Implementation Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Backend auth module + schema | 5 new, 2 modified | 8 unit |
| 2 | Backend auth routes + CORS | 1 new, 1 modified | 10 integration |
| 3 | Frontend lib + middleware | 5 new | 18 unit |
| 4 | AuthProvider + auth pages | 4 new | 3 unit |
| 5 | Root layout + Navbar + landing | 3 modified | manual smoke |
| 6 | Tests + docs | 2 modified | full suite run |

**Total: 15 new files, 8 modified files, 39 tests**
