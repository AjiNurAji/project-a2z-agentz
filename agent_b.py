"""
A2Z Agentz - Agent B: FastAPI REST Gateway (Vault Executor)
Binds 0.0.0.0:8080. Wires together database.py + web3_client.py.

Env:
    AGENT_A_PUBLIC_KEY   - 0x-prefixed address that signs each execute request.
    ETH_USD_RATE         - USD per ETH used for amount_usd -> wei conversion.
                           (hackathon default: 3000)
    BASE_RPC_URL_PRIMARY / BASE_RPC_URL_FALLBACK / PRIVATE_KEY / POSTGRES_URI
                           - forwarded to web3_client.py and database.py.

Run:
    python agent_b.py
    # or:  uvicorn agent_b:app --host 0.0.0.0 --port 8080
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Optional, Union

try:
    from eth_account import Account
    from eth_account.messages import encode_defunct
except ImportError:
    pass
try:
    from fastapi import FastAPI, HTTPException, status
    from pydantic import BaseModel, Field, field_validator
except Exception:
    class FastAPI:
        def __init__(self, *args, **kwargs): pass
        def post(self, *args, **kwargs): return lambda f: f
        def get(self, *args, **kwargs): return lambda f: f
        def on_event(self, *args, **kwargs): return lambda f: f
    class HTTPException(Exception):
        def __init__(self, status_code, detail): pass
    class status:
        HTTP_400_BAD_REQUEST = 400
        HTTP_401_UNAUTHORIZED = 401
        HTTP_403_FORBIDDEN = 403
        HTTP_409_CONFLICT = 409
        HTTP_500_INTERNAL_SERVER_ERROR = 500
    class BaseModel: pass
    def Field(*args, **kwargs): return None
    def field_validator(*args, **kwargs): return lambda f: f

from database import (
    check_idempotency,
    close_pool,
    insert_execution_log,
    is_blacklisted,
)
from web3_client import (
    canonical_message_for_signing,
    recover_signer,
    simulate_and_execute_tx,
)


# ----------------------------------------------------------------------------
# Logger
# ----------------------------------------------------------------------------
logger = logging.getLogger("a2z.agent_b")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s a2z.b: %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


# ----------------------------------------------------------------------------
# Config
# ----------------------------------------------------------------------------
AGENT_A_PUBLIC_KEY: str = os.getenv("AGENT_A_PUBLIC_KEY", "").strip()
ETH_USD_RATE: float = float(os.getenv("ETH_USD_RATE", "3000"))
AUTONOMOUS_CAP_USD: float = 2.0


# ----------------------------------------------------------------------------
# Pydantic schemas
# ----------------------------------------------------------------------------
class VaultExecuteRequest(BaseModel):
    timestamp: Union[str, int, float]
    project_target_address: str = Field(..., min_length=42, max_length=42)
    amount_usd: float = Field(..., gt=0, le=10_000_000)
    reason: str = Field(..., min_length=1, max_length=500)
    signature: str = Field(..., min_length=130, max_length=132)

    @field_validator("project_target_address")
    @classmethod
    def _addr_prefixed(cls, v: str) -> str:
        if not v.lower().startswith("0x"):
            raise ValueError("project_target_address must be 0x-prefixed")
        return v

    @field_validator("signature")
    @classmethod
    def _sig_prefixed(cls, v: str) -> str:
        if not v.lower().startswith("0x"):
            raise ValueError("signature must be 0x-prefixed hex")
        return v


class VaultExecuteResponse(BaseModel):
    status: str
    tx_hash: Optional[str] = None
    message: str


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
# The canonical-message format lives in web3_client.canonical_message_for_signing
# so Agent A (signer) and Agent B (verifier) cannot drift. Alias for
# readability in the legacy call-sites below.
_canonical_message = canonical_message_for_signing


def _verify_signature(req: VaultExecuteRequest) -> bool:
    if not AGENT_A_PUBLIC_KEY:
        logger.error("AGENT_A_PUBLIC_KEY env var is not set")
        return False
    if not AGENT_A_PUBLIC_KEY.lower().startswith("0x"):
        logger.error("AGENT_A_PUBLIC_KEY must be 0x-prefixed")
        return False
    try:
        signer = recover_signer(
            req.project_target_address,
            req.timestamp,
            req.amount_usd,
            req.reason,
            req.signature,
        )
        ok = signer.lower() == AGENT_A_PUBLIC_KEY.lower()
        if not ok:
            logger.warning(
                "Signature mismatch: signer=%s expected=%s…",
                signer, AGENT_A_PUBLIC_KEY[:10],
            )
        return ok
    except Exception as exc:
        logger.warning("Signature verification raised: %s", exc)
        return False


def _idempotency_key(addr: str, ts) -> str:
    """Mirror database._compute_idempotency_hash without leaking internals."""
    return hashlib.sha256(
        f"{addr.strip().lower()}:{ts}".encode("utf-8")
    ).hexdigest()


def _usd_to_wei(amount_usd: float) -> int:
    if ETH_USD_RATE <= 0:
        raise RuntimeError("ETH_USD_RATE must be > 0")
    return int((float(amount_usd) / ETH_USD_RATE) * 10**18)


# ----------------------------------------------------------------------------
# FastAPI app
# ----------------------------------------------------------------------------
app = FastAPI(
    title="A2Z Agentz — Vault Executor (Agent B)",
    version="1.0.0",
)


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.post(
    "/api/v1/vault/execute",
    response_model=VaultExecuteResponse,
)
def vault_execute(req: VaultExecuteRequest) -> VaultExecuteResponse:
    # ---- (1) ECDSA signature verification ----
    if not _verify_signature(req):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )

    # ---- (2) Blacklist check ----
    if is_blacklisted(req.project_target_address):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Target address is blacklisted",
        )

    # ---- (3) Idempotency check ----
    if check_idempotency(req.project_target_address, req.timestamp):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate request (idempotency hit) — already processed",
        )

    log_key = _idempotency_key(req.project_target_address, req.timestamp)

    # ---- (4) Autonomous cap branch ----
    if req.amount_usd <= AUTONOMOUS_CAP_USD:
        # Below cap: execute on-chain.
        try:
            value_wei = _usd_to_wei(req.amount_usd)
        except Exception as exc:
            logger.error("USD->wei conversion failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Conversion error: {exc}",
            )

        try:
            tx_hash = simulate_and_execute_tx(
                req.project_target_address, value_wei
            )
        except Exception as exc:
            # simulate_and_execute_tx already raised on revert (honeypot)
            # or RPC failure. Surface as 502; nothing broadcast.
            logger.error("simulate_and_execute_tx failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"On-chain execution aborted: {exc}",
            )

        # Record SUCCESS keyed by the same idempotency hash so a retry
        # of the exact same payload will be caught by step (3).
        try:
            insert_execution_log(
                tx_hash_id=log_key,
                address=req.project_target_address,
                amount=req.amount_usd,
                status="SUCCESS",
            )
        except Exception as exc:
            logger.error("DB log failed after SUCCESS broadcast: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    f"TX broadcast ({tx_hash}) succeeded but DB logging failed: {exc}"
                ),
            )

        return VaultExecuteResponse(
            status="SUCCESS",
            tx_hash=tx_hash,
            message=(
                f"Autonomous execution OK within ${AUTONOMOUS_CAP_USD} cap "
                f"(amount=${req.amount_usd})."
            ),
        )

    # Above cap: queue for manual approval, no on-chain action.
    try:
        insert_execution_log(
            tx_hash_id=log_key,
            address=req.project_target_address,
            amount=req.amount_usd,
            status="PENDING_APPROVAL",
        )
    except Exception as exc:
        logger.error("DB log failed for PENDING_APPROVAL: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue for approval: {exc}",
        )

    return VaultExecuteResponse(
        status="PENDING_APPROVAL",
        tx_hash=None,
        message=(
            f"Amount ${req.amount_usd} exceeds autonomous cap "
            f"(${AUTONOMOUS_CAP_USD}); queued for manual approval."
        ),
    )


# ----------------------------------------------------------------------------
# Process lifecycle
# ----------------------------------------------------------------------------
@app.on_event("shutdown")
def _on_shutdown() -> None:
    try:
        close_pool()
    except Exception:  # pragma: no cover
        pass


# ----------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "agent_b:app",
        host="0.0.0.0",
        port=8080,
        reload=False,
        log_level="info",
    )