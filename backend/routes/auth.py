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
from eth_account import Account as _EthAccountSIWE

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

    # Optional self-custodial wallet generation (P3).
    encrypted_blob = None
    wallet_source = "linked"
    generated_address = None
    seed_phrase = None
    if data.get("generate_wallet"):
        try:
            from lib.wallet_gen import generate_wallet

            w = generate_wallet()
            encrypted_blob = w["encrypted_blob"]
            wallet_source = "generated"
            generated_address = w["address"]
            seed_phrase = w["seed_phrase"]  # shown ONCE, never stored
            # Prefer the generated address unless the user also supplied one.
            if not wallet_address:
                wallet_address = generated_address
        except Exception as exc:
            logger.error("register wallet generation failed: %s", exc)
            return JSONResponse(
                {"error": "Wallet generation is currently unavailable."},
                status_code=503,
            )

    # Insert user
    user = database.create_user(
        email, hashed_pwd, wallet_address, encrypted_blob, wallet_source
    )
    if not user:
        return JSONResponse({"error": "Failed to create user"}, status_code=500)

    # Remove sensitive fields before returning
    user.pop("password_hash", None)
    user.pop("encrypted_private_key", None)

    resp = {"user": user}
    if generated_address:
        # Seed phrase is returned exactly once and only at registration.
        resp["wallet"] = {
            "address": generated_address,
            "seed_phrase": seed_phrase,
            "warning": "Save this seed phrase now. It will not be shown again.",
        }
    return JSONResponse(resp, status_code=201)

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


# ---------------------------------------------------------------------------
# SIWE (Sign-In-With-Ethereum) — P6 wallet-only auth (no email/password)
# ---------------------------------------------------------------------------

def _siwe_parse_field(message: str, field: str) -> str:
    """Extract a single EIP-4361 field (e.g. 'Address:', 'Nonce:', 'Chain ID:')
    from a signed SIWE message. Returns '' if not found."""
    for line in message.splitlines():
        if line.startswith(field + ":"):
            return line[len(field) + 1:].strip()
    return ""


async def siwe_nonce(request: Request):
    """POST {address} — issue a fresh anti-replay nonce for the wallet.

    The frontend signs an EIP-4361 message containing this nonce; the nonce is
    single-use and expires in 10 minutes.
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    address = (data.get("address") or "").strip()
    if not address or not address.startswith("0x") or len(address) != 42:
        return JSONResponse({"error": "Valid wallet address required"}, status_code=400)
    nonce = secrets.token_urlsafe(32)
    if not database.upsert_siwe_nonce(address, nonce, ttl_seconds=600):
        return JSONResponse({"error": "Failed to issue nonce"}, status_code=500)
    # EIP-4361 chain id must match our active network.
    chain_id = int(os.getenv("BASE_CHAIN_ID", "8453"))
    issued_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    # Return a ready-to-sign EIP-4361 message (frontend just signs `message`).
    # SIWE domain resolution (best-practice order):
    #   1. Origin header (frontend URL the browser actually called from) — automatic
    #   2. SIWE_DOMAIN env var (explicit override)
    #   3. request.url.hostname (API host, last-resort fallback)
    domain = (
        request.headers.get("origin")
        or os.getenv("SIWE_DOMAIN")
        or request.url.hostname
        or "a2z.agentz"
    )
    # URI in the EIP-4361 message must match the frontend origin (domain),
    # not the backend API URL, so the wallet shows a consistent sign-in target.
    uri = domain
    message = (
        f"{domain} wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"Sign in to A2Z Agentz. This request will not trigger a blockchain transaction.\n\n"
        f"URI: {uri}\n"
        f"Version: 1\n"
        f"Chain ID: {chain_id}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )
    return JSONResponse({"nonce": nonce, "message": message, "chain_id": chain_id})


async def siwe_verify(request: Request):
    """POST {message, signature} — verify SIWE signature and issue a session JWT.

    Flow:
      1. Recover signer address from (message, signature). MUST match the
         address claimed in the message — we never trust a client-supplied addr.
      2. Consume the nonce (single-use + expiry check).
      3. Resolve existing wallet user, else auto-register a new SIWE user.
      4. P3 auto-provision: if the user has no encrypted wallet yet, generate
         one (AES-GCM) and persist it; return the seed phrase ONCE.
      5. Issue JWT session token (sub = user id). No email/password involved.
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    message = (data.get("message") or "").strip()
    signature = (data.get("signature") or "").strip()
    if not message or not signature:
        return JSONResponse({"error": "message and signature required"}, status_code=400)

    # 1. Recover signer from signature (EIP-191 personal_sign / EIP-4361).
    try:
        recovered = _EthAccountSIWE._recover_message(
            message.encode("utf-8"), signature=signature
        )
    except Exception as exc:
        return JSONResponse({"error": f"Signature recovery failed: {exc}"}, status_code=400)

    claimed_addr = _siwe_parse_field(message, "Address")
    if not claimed_addr:
        return JSONResponse({"error": "Malformed SIWE message (no Address)"}, status_code=400)
    if recovered.lower() != claimed_addr.lower():
        return JSONResponse(
            {"error": "Recovered address does not match message address"},
            status_code=401,
        )

    # 2. Consume nonce (anti-replay + expiry).
    nonce = _siwe_parse_field(message, "Nonce")
    if not database.consume_siwe_nonce(claimed_addr, nonce):
        return JSONResponse({"error": "Invalid or expired nonce"}, status_code=401)

    # 3. Resolve or register (v1-simple: wallet-centric, separate account).
    user = database.get_user_by_wallet(claimed_addr)
    is_new = False
    if not user:
        user = database.create_siwe_user(claimed_addr)
        is_new = True
        if not user:
            return JSONResponse({"error": "Failed to create SIWE user"}, status_code=500)

    resp = {"user": {"id": user["id"], "wallet_address": user["wallet_address"]}}
    if is_new:
        resp["user"]["is_new"] = True

    # 4. P3 auto-provision (only if no key yet). Fail-closed: if WALLET_ENC_SECRET
    #    is unset, generation raises — we still log the user in, just without a
    #    self-custodial wallet. The frontend prompting for the seed is FE's job.
    wallet = database.get_user_by_id(user["id"])
    if wallet and not wallet.get("encrypted_private_key"):
        try:
            from lib.wallet_gen import generate_wallet

            w = generate_wallet()
            saved = database.save_user_encrypted_wallet(
                user["id"], w["encrypted_blob"], w["address"]
            )
            if saved and is_new:
                # Seed phrase shown exactly once, at first registration.
                resp["wallet"] = {
                    "address": w["address"],
                    "seed_phrase": w["seed_phrase"],
                    "warning": "Save this seed phrase now. It will not be shown again.",
                }
        except Exception as exc:
            logger.error("SIWE P3 wallet auto-provision failed for user %s: %s",
                         user["id"], exc)
            # Non-fatal: user is logged in, just without a generated wallet.
    token = create_access_token({"sub": str(user["id"])})
    resp["token"] = token
    return JSONResponse(resp, status_code=200 if not is_new else 201)


routes = [
    Route("/siwe/nonce", siwe_nonce, methods=["POST"]),
    Route("/siwe/verify", siwe_verify, methods=["POST"]),
    Route("/register", register, methods=["POST"]),
    Route("/login", login, methods=["POST"]),
    Route("/me", me, methods=["GET"]),
    Route("/logout", logout, methods=["POST"]),
    Route("/forgot-password", forgot_password, methods=["POST"]),
    Route("/reset-password", reset_password, methods=["POST"]),
]
