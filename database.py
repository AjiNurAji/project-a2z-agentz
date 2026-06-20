"""
A2Z Agentz - Database Module
Thread-safe PostgreSQL connection layer (psycopg2 + ThreadedConnectionPool).

Environment:
    POSTGRES_URI  - full libpq connection string, e.g.
                    "postgresql://user:pass@host:5432/dbname?sslmode=require"

Schema contract (see database_schema.sql):
    target_addresses(address PK, sentiment_score, status, updated_at)
    execution_logs(tx_hash_id PK, project_target_address, amount_usd, status, created_at)
"""

from __future__ import annotations

import hashlib
import logging
import os
import threading
from contextlib import contextmanager
from typing import Iterator, Optional

import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor

# ----------------------------------------------------------------------------
# Logger (never log secrets / credentials / seed phrases)
# ----------------------------------------------------------------------------
logger = logging.getLogger("a2z.database")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s a2z.db: %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


# ----------------------------------------------------------------------------
# Connection pool (lazy, thread-safe singleton)
# ----------------------------------------------------------------------------
class _PoolHolder:
    """Singleton holder for the threaded connection pool."""

    _lock: threading.Lock = threading.Lock()
    _pool: Optional[pg_pool.ThreadedConnectionPool] = None

    @classmethod
    def get(cls) -> pg_pool.ThreadedConnectionPool:
        if cls._pool is not None:
            return cls._pool
        with cls._lock:
            if cls._pool is not None:
                return cls._pool
            dsn = os.environ.get("POSTGRES_URI", "").strip()
            if not dsn:
                raise RuntimeError(
                    "POSTGRES_URI environment variable is not set. "
                    "Refusing to initialize database pool."
                )
            # Mask DSN in logs (do NOT print password)
            safe_dsn = dsn
            try:
                # crude masking for log lines
                if "@" in dsn and "://" in dsn:
                    scheme, rest = dsn.split("://", 1)
                    if "@" in rest:
                        creds, hostpart = rest.split("@", 1)
                        if ":" in creds:
                            user, _ = creds.split(":", 1)
                            safe_dsn = f"{scheme}://{user}:***@{hostpart}"
            except Exception:  # pragma: no cover
                safe_dsn = "<opaque>"

            logger.info("Initializing ThreadedConnectionPool (dsn=%s)", safe_dsn)
            cls._pool = pg_pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=dsn,
            )
            return cls._pool


def _pool() -> pg_pool.ThreadedConnectionPool:
    return _PoolHolder.get()


@contextmanager
def _get_conn() -> Iterator["psycopg2.extensions.connection"]:
    """
    Borrow a connection from the pool, yield it, and always return it.
    Rolls back on exception, commits on clean exit, and forces release
    back to the pool even on failure.
    """
    conn = _pool().getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:  # pragma: no cover
            pass
        raise
    finally:
        try:
            _pool().putconn(conn)
        except Exception:  # pragma: no cover
            try:
                conn.close()
            except Exception:
                pass


@contextmanager
def _get_cursor(dict_rows: bool = False) -> Iterator["psycopg2.extensions.cursor"]:
    """Borrow a connection + cursor in one shot."""
    with _get_conn() as conn:
        cursor_factory = RealDictCursor if dict_rows else None
        cur = conn.cursor(cursor_factory=cursor_factory)
        try:
            yield cur
        finally:
            try:
                cur.close()
            except Exception:  # pragma: no cover
                pass


def close_pool() -> None:
    """Tear down the pool (call from process shutdown / tests)."""
    pool = _PoolHolder._pool
    if pool is not None:
        with _PoolHolder._lock:
            if _PoolHolder._pool is pool:
                try:
                    pool.closeall()
                finally:
                    _PoolHolder._pool = None
                logger.info("Database connection pool closed.")


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _compute_idempotency_hash(project_target_address: str, timestamp: str | int | float) -> str:
    """
    Stable SHA-256 of (address + ':' + str(timestamp)) to use as the
    execution_logs.tx_hash_id primary key. Deterministic across processes.
    """
    addr = (project_target_address or "").strip().lower()
    ts = str(timestamp).strip()
    payload = f"{addr}:{ts}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# ----------------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------------
def check_idempotency(project_target_address: str, timestamp: str | int | float) -> bool:
    """
    Compute SHA-256(address + ':' + timestamp) and return True if that
    hash already exists in execution_logs (i.e. duplicate / already submitted),
    False otherwise.
    """
    tx_hash_id = _compute_idempotency_hash(project_target_address, timestamp)
    query = "SELECT 1 FROM execution_logs WHERE tx_hash_id = %s LIMIT 1;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (tx_hash_id,))
            row = cur.fetchone()
        return row is not None
    except psycopg2.Error as exc:
        logger.error("check_idempotency failed: %s", exc)
        # Fail closed: if we cannot prove uniqueness, treat as duplicate
        # so we never double-spend.
        return True


def insert_execution_log(
    tx_hash_id: str,
    address: str,
    amount: float | int | str,
    status: str,
) -> str:
    """
    Persist a transaction / approval-queue record to execution_logs.
    Returns the tx_hash_id that was actually inserted (or that already existed).
    Raises psycopg2.Error on real DB failure.
    """
    safe_hash = (tx_hash_id or "").strip()
    if not safe_hash:
        raise ValueError("tx_hash_id must be a non-empty string")

    addr = (address or "").strip()
    if not addr:
        raise ValueError("address must be a non-empty string")

    status_norm = (status or "").strip().lower()
    if not status_norm:
        raise ValueError("status must be a non-empty string")

    insert_sql = """
        INSERT INTO execution_logs
            (tx_hash_id, project_target_address, amount_usd, status)
        VALUES
            (%s, %s, %s, %s)
        ON CONFLICT (tx_hash_id) DO NOTHING
        RETURNING tx_hash_id;
    """
    with _get_cursor() as cur:
        cur.execute(insert_sql, (safe_hash, addr, amount, status_norm))
        inserted = cur.fetchone()

    if inserted:
        logger.info(
            "execution_log inserted tx_hash_id=%s… address=%s… amount=%s status=%s",
            safe_hash[:10], addr[:10], amount, status_norm,
        )
    else:
        logger.info(
            "execution_log skipped (duplicate) tx_hash_id=%s… address=%s…",
            safe_hash[:10], addr[:10],
        )
    return safe_hash


def get_target_status(address: str) -> Optional[str]:
    """
    Return the raw ``status`` column for ``address`` from
    ``target_addresses``, or ``None`` if the address is not present.

    Unlike :func:`is_blacklisted`, this helper does **not** fail-closed:
    on real DB errors it lets ``psycopg2.Error`` propagate so callers can
    distinguish "not in table" from "DB unreachable" and log accordingly.

    The returned value preserves the row's original casing (e.g.
    ``'BLACKLISTED'``, ``'blacklisted'``, ``'active'``, ``'pending'``).
    """
    addr = (address or "").strip()
    if not addr:
        return None

    query = "SELECT status FROM target_addresses WHERE address = %s LIMIT 1;"
    with _get_cursor() as cur:
        cur.execute(query, (addr,))
        row = cur.fetchone()
    if not row:
        return None
    # psycopg2 default cursor returns tuples; row[0] is the status string.
    return row[0] if isinstance(row, (tuple, list)) else row.get("status")


def is_blacklisted(address: str) -> bool:
    """
    True iff the given target address exists in target_addresses AND
    has status = 'blacklisted' (case-insensitive comparison).
    """
    addr = (address or "").strip()
    if not addr:
        return False

    query = """
        SELECT 1
        FROM target_addresses
        WHERE address = %s
          AND UPPER(status) = 'BLACKLISTED'
        LIMIT 1;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (addr,))
            row = cur.fetchone()
        return row is not None
    except psycopg2.Error as exc:
        logger.error("is_blacklisted lookup failed for %s…: %s", addr[:10], exc)
        # Fail closed: assume blacklisted on DB error to avoid risky trades.
        return True


# ----------------------------------------------------------------------------
# Optional: lightweight self-check (run with: python database.py)
# ----------------------------------------------------------------------------
if __name__ == "__main__":  # pragma: no cover
    import json
    import time

    sample_addr = os.environ.get("A2Z_TEST_ADDRESS", "0x000000000000000000000000000000000000dEaD")
    ts = int(time.time())
    h = _compute_idempotency_hash(sample_addr, ts)
    print(json.dumps({
        "idempotency_hash": h,
        "is_blacklisted_sample": is_blacklisted(sample_addr),
        "duplicate_for_fresh_ts": check_idempotency(sample_addr, ts),
    }, indent=2))
    close_pool()
# ==============================================================================
# User Auth Operations
# ==============================================================================

def create_user(email: str, password_hash: str, wallet_address: str = None) -> dict:
    query = """
        INSERT INTO users (email, password_hash, wallet_address)
        VALUES (%s, %s, %s)
        RETURNING id, email, wallet_address, created_at, last_login_at;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (email, password_hash, wallet_address))
            row = cur.fetchone()
            if row:
                return {
                    'id': row[0],
                    'email': row[1],
                    'wallet_address': row[2],
                    'created_at': row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None,
                    'last_login_at': row[4].strftime('%Y-%m-%d %H:%M:%S') if row[4] else None
                }
    except psycopg2.IntegrityError:
        return None
    except psycopg2.Error as exc:
        logger.error("create_user failed: %s", exc)
        return None
    return None

def get_user_by_email(email: str) -> dict:
    query = "SELECT id, email, password_hash, wallet_address, created_at, last_login_at FROM users WHERE email = %s LIMIT 1;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (email,))
            row = cur.fetchone()
            if row:
                return {
                    'id': row[0],
                    'email': row[1],
                    'password_hash': row[2],
                    'wallet_address': row[3],
                    'created_at': row[4].strftime('%Y-%m-%d %H:%M:%S') if row[4] else None,
                    'last_login_at': row[5].strftime('%Y-%m-%d %H:%M:%S') if row[5] else None
                }
    except psycopg2.Error as exc:
        logger.error("get_user_by_email failed: %s", exc)
        return None
    return None

def get_user_by_id(user_id: int) -> dict:
    query = "SELECT id, email, wallet_address, created_at, last_login_at FROM users WHERE id = %s LIMIT 1;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()
            if row:
                return {
                    'id': row[0],
                    'email': row[1],
                    'wallet_address': row[2],
                    'created_at': row[3].strftime('%Y-%m-%d %H:%M:%S') if row[3] else None,
                    'last_login_at': row[4].strftime('%Y-%m-%d %H:%M:%S') if row[4] else None
                }
    except psycopg2.Error as exc:
        logger.error("get_user_by_id failed: %s", exc)
        return None
    return None

def update_last_login(user_id: int) -> None:
    query = "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id,))
    except psycopg2.Error as exc:
        logger.error("update_last_login failed: %s", exc)
