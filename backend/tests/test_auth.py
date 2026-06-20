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
