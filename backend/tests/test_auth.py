"""Unit tests for backend/auth.py — pure functions, no DB needed."""
import os
import time

import pytest

# Set JWT_SECRET before importing auth module
os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-32chars!!")

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
        import jwt as pyjwt

        expired_payload = {
            "sub": "1",
            "email": "x@y.io",
            "exp": int(time.time()) - 100,
            "iat": int(time.time()) - 200,
        }
        expired_token = pyjwt.encode(
            expired_payload, os.environ["JWT_SECRET"], algorithm="HS256"
        )
        assert decode_jwt(expired_token) is None

    def test_decode_tampered_jwt_returns_none(self):
        token = create_jwt(user_id=1, email="x@y.io")
        tampered = token[:-5] + "XXXXX"
        assert decode_jwt(tampered) is None

    def test_decode_garbage_returns_none(self):
        assert decode_jwt("not.a.jwt") is None
        assert decode_jwt("") is None


# ===========================================================================
# Integration tests for auth routes — mock database._get_cursor
# ===========================================================================
from unittest.mock import patch, MagicMock
from starlette.testclient import TestClient


def _make_test_app():
    """Build a minimal Starlette app with auth routes mounted."""
    from starlette.routing import Mount
    from starlette.applications import Starlette
    from routes.auth import routes as auth_routes

    return Starlette(routes=[Mount("/api/auth", routes=auth_routes)])


@pytest.fixture
def client():
    return TestClient(_make_test_app())


@pytest.fixture
def mock_cursor():
    """Patch the `database` module imported by routes.auth."""
    with patch("routes.auth.database._get_cursor") as mock:
        yield mock


def _make_ctx(fetched_row):
    """Helper: create a mock context manager yielding a cursor that returns *fetched_row* from fetchone.

    *fetched_row* can be a dict, a tuple, or ``None``.
    """
    cursor = MagicMock()
    cursor.fetchone.return_value = fetched_row

    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=cursor)
    ctx.__exit__ = MagicMock(return_value=False)
    return ctx


def _make_ctx_sequence(rows_list):
    """Helper: return a callable that produces a fresh context manager each call.

    Each call to ``database._get_cursor()`` will return the next context in the
    sequence, each with its own cursor that returns the corresponding row.
    """
    ctx_list = [_make_ctx(row) for row in rows_list]
    return MagicMock(side_effect=ctx_list)


class TestRegisterRoute:
    def test_register_success(self, client, mock_cursor):
        """POST /api/auth/register with valid data returns 201."""
        mock_cursor.side_effect = _make_ctx_sequence([
            None,  # email check → not found
            {"id": 1, "email": "new@agent.io", "wallet_address": None,
             "created_at": "2026-01-01 00:00:00", "last_login_at": None},
        ]).side_effect

        resp = client.post("/api/auth/register", json={
            "email": "new@agent.io", "password": "securepass123"
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["email"] == "new@agent.io"
        assert "password_hash" not in data["user"]

    def test_register_duplicate_email(self, client, mock_cursor):
        """POST /api/auth/register with existing email returns 409."""
        mock_cursor.return_value = _make_ctx({"id": 1})

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

    def test_register_with_wallet(self, client, mock_cursor):
        """POST /api/auth/register with wallet address succeeds."""
        mock_cursor.side_effect = _make_ctx_sequence([
            None,
            {"id": 2, "email": "w@agent.io", "wallet_address": "0x" + "a" * 40,
             "created_at": "2026-01-01 00:00:00", "last_login_at": None},
        ]).side_effect

        resp = client.post("/api/auth/register", json={
            "email": "w@agent.io", "password": "securepass123",
            "wallet_address": "0x" + "a" * 40,
        })
        assert resp.status_code == 201
        assert resp.json()["user"]["wallet_address"] == "0x" + "a" * 40


class TestLoginRoute:
    def test_login_success(self, client, mock_cursor):
        """POST /api/auth/login with correct creds returns 200 + cookie."""
        pw_hash = hash_password("correctpass")
        mock_cursor.side_effect = _make_ctx_sequence([
            {"id": 1, "email": "user@agent.io", "password_hash": pw_hash},
            None,  # UPDATE last_login_at
            {"id": 1, "email": "user@agent.io", "wallet_address": None,
             "created_at": "2026-01-01 00:00:00", "last_login_at": "2026-06-20"},
        ]).side_effect

        resp = client.post("/api/auth/login", json={
            "email": "user@agent.io", "password": "correctpass"
        })
        assert resp.status_code == 200
        assert "a2z-token" in resp.cookies

    def test_login_wrong_password(self, client, mock_cursor):
        """POST /api/auth/login with wrong password returns 401."""
        pw_hash = hash_password("correctpass")
        mock_cursor.return_value = _make_ctx(
            {"id": 1, "email": "user@agent.io", "password_hash": pw_hash}
        )

        resp = client.post("/api/auth/login", json={
            "email": "user@agent.io", "password": "wrongpass"
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email(self, client, mock_cursor):
        """POST /api/auth/login with unknown email returns 401."""
        mock_cursor.return_value = _make_ctx(None)

        resp = client.post("/api/auth/login", json={
            "email": "nobody@agent.io", "password": "whatever"
        })
        assert resp.status_code == 401


class TestMeRoute:
    def test_me_without_cookie_returns_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_with_valid_cookie(self, client, mock_cursor):
        """GET /api/auth/me with valid JWT cookie returns user."""
        token = create_jwt(user_id=42, email="me@agent.io")
        mock_cursor.return_value = _make_ctx(
            {"id": 42, "email": "me@agent.io", "wallet_address": None,
             "created_at": "2026-01-01 00:00:00", "last_login_at": "2026-06-20"}
        )

        client.cookies = {"a2z-token": token}
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "me@agent.io"


class TestLogoutRoute:
    def test_logout_clears_cookie(self, client):
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True
        cookie_header = resp.headers.get("set-cookie", "")
        assert "a2z-token" in cookie_header
