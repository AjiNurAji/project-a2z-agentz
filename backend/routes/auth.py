"""Authentication endpoints: register, login, me, logout."""
from __future__ import annotations

import re
import sys
import os
from datetime import datetime, timezone

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

# Add root directory to sys.path so we can import auth and database modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from auth import hash_password, verify_password, create_jwt, decode_jwt
import database

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
    with database._get_cursor(dict_rows=True) as cur:
        cur.execute("SELECT id FROM users WHERE email = %s LIMIT 1;", (email,))
        if cur.fetchone():
            return JSONResponse({"error": "Email already registered"}, status_code=409)

    pw_hash = hash_password(password)

    with database._get_cursor(dict_rows=True) as cur:
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

    with database._get_cursor(dict_rows=True) as cur:
        cur.execute(
            "SELECT id, email, password_hash FROM users WHERE email = %s LIMIT 1;",
            (email,),
        )
        row = cur.fetchone()

    if not row:
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)

    user_id = row["id"]
    user_email = row["email"]
    stored_hash = row["password_hash"]

    if not verify_password(password, stored_hash):
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)

    # Update last_login_at
    with database._get_cursor(dict_rows=True) as cur:
        cur.execute(
            "UPDATE users SET last_login_at = %s WHERE id = %s;",
            (datetime.now(timezone.utc), user_id),
        )

    token = create_jwt(user_id, user_email)

    # Fetch full user row for response
    with database._get_cursor(dict_rows=True) as cur:
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
    with database._get_cursor(dict_rows=True) as cur:
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
