import sys
import os
import re
import smtplib
import ssl
import secrets
import logging
from datetime import datetime, timedelta
from email.message import EmailMessage
from starlette.routing import Route
from starlette.responses import JSONResponse
from starlette.requests import Request

logger = logging.getLogger("a2z.auth")

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

# Also add backend directory so we can import auth module
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from auth import hash_password, verify_password, create_access_token, verify_access_token

API_KEY = os.getenv("API_KEY", "")

RESET_CODE_TTL_MIN = int(os.getenv("RESET_CODE_TTL_MIN", "15"))
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)


def _send_email(to_addr: str, subject: str, body: str) -> bool:
    """Send a plain-text email via configured SMTP. Returns True on success."""
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP not configured; skipping email to %s", to_addr)
        return False
    try:
        msg = EmailMessage()
        msg["From"] = SMTP_FROM
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body)
        ctx = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.starttls(context=ctx)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.error("send_email failed: %s", exc)
        return False


def validate_email(email):
    return re.match(r"[^@]+@[^@]+\.[^@]+", email)

async def register(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    
    email = data.get("email")
    password = data.get("password")
    wallet_address = data.get("wallet_address")

    if not email or not validate_email(email):
        return JSONResponse({"error": "Invalid email format"}, status_code=422)
    
    if not password or len(password) < 8:
        return JSONResponse({"error": "Password must be at least 8 characters"}, status_code=422)
    
    # Check if email exists
    existing_user = database.get_user_by_email(email)
    if existing_user:
        return JSONResponse({"error": "Email already registered"}, status_code=409)
    
    # Hash password
    hashed_pwd = hash_password(password)

    # Insert user
    user = database.create_user(email, hashed_pwd, wallet_address)
    if not user:
        return JSONResponse({"error": "Failed to create user"}, status_code=500)
    
    # Remove password_hash before returning
    user.pop("password_hash", None)

    return JSONResponse({"user": user}, status_code=201)

async def login(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return JSONResponse({"error": "Email and password required"}, status_code=400)
    
    user = database.get_user_by_email(email)
    if not user:
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)
    
    if not verify_password(password, user["password_hash"]):
        return JSONResponse({"error": "Invalid email or password"}, status_code=401)
    
    # Update last login
    database.update_last_login(user["id"])
    user["last_login_at"] = database.get_user_by_id(user["id"])["last_login_at"] # Refresh

    # Generate token
    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})

    # Prepare response. Send token in body too so the dashboard can store it
    # in localStorage and forward it as an Authorization header (works across
    # Vercel -> Railway domains where cross-site cookies are unreliable).
    user.pop("password_hash", None)
    response = JSONResponse({"user": user, "token": token})

    # Still set the cookie (helps same-site / curl use), but the dashboard
    # prefers the body token.
    response.set_cookie(
        key="a2z-token",
        value=token,
        httponly=True,
        path="/",
        max_age=604800, # 7 days
        samesite="none",
        secure=True
    )

    return response

async def me(request: Request):
    # Prefer Authorization header (dashboard forwards JWT from localStorage),
    # fall back to the cookie, then to the server-side API key (the dashboard
    # already sends X-API-Key on every request, so this keeps /me working
    # even when the JWT is not present in localStorage).
    auth_header = request.headers.get("Authorization", "")
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("a2z-token")

    if token and token != "guest":
        payload = verify_access_token(token)
        if payload and "sub" in payload:
            user_id = int(payload["sub"])
            user = database.get_user_by_id(user_id)
            if user:
                return JSONResponse({"user": user})

    # Fallback: server-side API key (dev/demo). Never accepts the raw guest
    # cookie as a real user.
    api_key = request.headers.get("X-API-Key")
    if api_key and api_key == API_KEY:
        # Return the system/demo user so the dashboard can render.
        user = database.get_user_by_id(1)
        if user:
            return JSONResponse({"user": user})

    return JSONResponse({"error": "Not authenticated"}, status_code=401)

async def logout(request: Request):
    response = JSONResponse({"ok": True})
    # Clear cookie on logout (SameSite=None+Secure to match login)
    response.set_cookie(
        key="a2z-token",
        value="",
        httponly=True,
        path="/",
        max_age=0,
        samesite="none",
        secure=True
    )
    return response

async def forgot_password(request: Request):
    """Generate a 6-digit reset code and email it to the user."""
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    email = data.get("email")
    if not email or not validate_email(email):
        return JSONResponse({"error": "Invalid email"}, status_code=422)

    # Rate limit: prevent reset-code spam / enumeration abuse. A new code may
    # only be requested once per RESET_RATE_LIMIT_SEC per email address.
    RESET_RATE_LIMIT_SEC = int(os.getenv("RESET_RATE_LIMIT_SEC", "60"))
    recent = database.get_recent_password_reset(email)
    if recent is not None:
        elapsed = (datetime.utcnow() - recent).total_seconds()
        if elapsed < RESET_RATE_LIMIT_SEC:
            wait = int(RESET_RATE_LIMIT_SEC - elapsed)
            return JSONResponse(
                {"error": f"Please wait {wait}s before requesting another code."},
                status_code=429,
            )

    user = database.get_user_by_email(email)
    if not user:
        # Do not reveal whether the email exists (security).
        return JSONResponse({"ok": True, "message": "If the email exists, a reset code was sent."})

    code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MIN)
    database.create_password_reset(email, code, expires_at)
    _send_email(
        email,
        "A2Z Agentz — Your Password Reset Code",
        f"Hello,\n\n"
        f"We received a request to reset your A2Z Agentz password.\n\n"
        f"Your 6-digit verification code is:\n\n"
        f"    {code}\n\n"
        f"This code is valid for {RESET_CODE_TTL_MIN} minutes "
        f"(until {expires_at.strftime('%Y-%m-%d %H:%M UTC')}).\n\n"
        f"Enter this code on the password reset page to choose a new password.\n\n"
        f"If you did not request this, you can safely ignore this email "
        f"— your password will not change.\n\n"
        f"– The A2Z Agentz Team",
    )
    return JSONResponse({"ok": True, "message": "If the email exists, a reset code was sent."})


async def reset_password(request: Request):
    """Verify the reset code and set a new password."""
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)

    email = data.get("email")
    code = (data.get("code") or "").strip()
    new_password = data.get("password")

    if not email or not code or not new_password:
        return JSONResponse({"error": "email, code, and password required"}, status_code=422)
    if len(new_password) < 8:
        return JSONResponse({"error": "Password must be at least 8 characters"}, status_code=422)
    if not database.verify_password_reset(email, code):
        return JSONResponse({"error": "Invalid or expired reset code"}, status_code=400)

    hashed = hash_password(new_password)
    if not database.update_user_password(email, hashed):
        return JSONResponse({"error": "Failed to update password"}, status_code=500)
    database.consume_password_reset(email, code)
    return JSONResponse({"ok": True, "message": "Password updated. Please log in."})


routes = [
    Route("/register", register, methods=["POST"]),
    Route("/login", login, methods=["POST"]),
    Route("/me", me, methods=["GET"]),
    Route("/logout", logout, methods=["POST"]),
    Route("/forgot-password", forgot_password, methods=["POST"]),
    Route("/reset-password", reset_password, methods=["POST"]),
]
