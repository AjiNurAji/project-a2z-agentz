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
import jwt as pyjwt  # PyJWT package, imported as `jwt`

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
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + _JWT_EXPIRY_SECONDS,
    }
    return pyjwt.encode(payload, _get_secret(), algorithm=_JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    """Verify *token* and return its claims, or ``None`` if invalid/expired.

    The ``sub`` claim is converted back to ``int`` for convenience (routes
    expect a numeric user id).
    """
    if not token:
        return None
    try:
        claims = pyjwt.decode(token, _get_secret(), algorithms=[_JWT_ALGORITHM])
        # PyJWT ≥2.13 requires `sub` to be a string; convert back to int.
        if "sub" in claims:
            claims["sub"] = int(claims["sub"])
        return claims
    except (pyjwt.ExpiredSignatureError, pyjwt.InvalidTokenError):
        return None
