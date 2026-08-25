"""
A2Z Agentz - Database Module
Thread-safe PostgreSQL connection layer (psycopg2 + ThreadedConnectionPool).

Environment:
    POSTGRES_URI  - full libpq connection string, e.g.
                    "postgresql://user:pass@host:5432/dbname?sslmode=require"

Schema contract (see database_schema.sql):
    target_addresses(address PK, sentiment_score, status, updated_at)
    execution_logs(tx_hash_id PK, project_target_address, amount_usd, status, created_at,
                   queue_id INTEGER, token_name VARCHAR(255), reason TEXT)
"""

from __future__ import annotations

import hashlib
import logging
import os
import threading
from datetime import datetime
from contextlib import contextmanager
from typing import Iterator, Optional

import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor
import json

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
            # Railway / common platforms expose the DB under POSTGRES_URL or
            # DATABASE_URL. Fall back to POSTGRES_URI (docker-stack default).
            dsn = (
                os.environ.get("POSTGRES_URL")
                or os.environ.get("DATABASE_URL")
                or os.environ.get("POSTGRES_URI", "")
            ).strip()
            if not dsn:
                raise RuntimeError(
                    "POSTGRES_URI / POSTGRES_URL / DATABASE_URL environment variable is not set. "
                    "Set one of them to a libpq connection string."
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
    queue_id: int | None = None,
    token_name: str = "",
    reason: str = "",
    network: str | None = None,
    user_id: int | None = None,
) -> str:
    """Persist a transaction / approval-queue record to execution_logs.

    ``network`` defaults to the active network flag from network_config
    ('mainnet' / 'testnet') so mainnet and testnet rows never mix.
    """
    # Resolve network flag from the Dual-Home config if not explicitly given.
    if not network:
        try:
            from network_config import get_config
            network = get_config().network_flag
        except Exception:
            network = "mainnet"

    safe_hash = (tx_hash_id or "").strip()
    if not safe_hash:
        raise ValueError("tx_hash_id must be a non-empty string")

    addr = (address or "").strip()
    if not addr:
        raise ValueError("address must be a non-empty string")

    status_norm = (status or "").strip()
    # NOTE: execution_logs.status CHECK constraint allows specific values
    # (e.g. 'SUCCESS', 'FAILED') in UPPERCASE. Do NOT .lower() here or the
    # insert will violate the constraint.
    if not status_norm:
        raise ValueError("status must be a non-empty string")

    insert_sql = """
        INSERT INTO execution_logs
            (tx_hash_id, project_target_address, amount_usd, status, queue_id, token_name, reason, network, user_id)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (tx_hash_id) DO UPDATE
        SET token_name = EXCLUDED.token_name,
            reason = EXCLUDED.reason,
            network = EXCLUDED.network,
            user_id = EXCLUDED.user_id
        RETURNING tx_hash_id;
    """
    with _get_cursor() as cur:
        # Ensure the FK target exists (testnet tokens / new addresses may not
        # be in target_addresses yet). Insert a minimal row if missing. Use a
        # status value allowed by the target_addresses CHECK constraint, and
        # stamp the same network flag for segregation.
        cur.execute(
            "INSERT INTO target_addresses (address, sentiment_score, status, network) "
            "VALUES (%s, 0, 'active', %s) ON CONFLICT (address) DO NOTHING;",
            (addr, network),
        )
        cur.execute(insert_sql, (safe_hash, addr, amount, status_norm, queue_id, token_name, reason, network, user_id))
        inserted = cur.fetchone()

    if inserted:
        logger.info(
            "execution_log inserted tx_hash_id=%s... address=%s... amount=%s status=%s",
            safe_hash[:10], addr[:10], amount, status_norm,
        )
    else:
        logger.info(
            "execution_log skipped (duplicate) tx_hash_id=%s... address=%s...",
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
        logger.error("is_blacklisted lookup failed for %s...: %s", addr[:10], exc)
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

def create_user(
    email: str,
    password_hash: str,
    wallet_address: str = None,
    encrypted_private_key: str = None,
    wallet_source: str = "linked",
) -> dict:
    query = """
    INSERT INTO users (email, password_hash, wallet_address, encrypted_private_key, wallet_source)
    VALUES (%s, %s, %s, %s, %s)
    RETURNING id, email, wallet_address, encrypted_private_key, wallet_source, created_at, last_login_at;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(
                query,
                (email, password_hash, wallet_address, encrypted_private_key, wallet_source),
            )
            row = cur.fetchone()
            if row:
                return {
                    "id": row[0],
                    "email": row[1],
                    "wallet_address": row[2],
                    "encrypted_private_key": row[3],
                    "wallet_source": row[4],
                    "created_at": row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else None,
                    "last_login_at": row[6].strftime("%Y-%m-%d %H:%M:%S") if row[6] else None,
                }
    except psycopg2.IntegrityError:
        return None
    except psycopg2.Error as exc:
        logger.error("create_user failed: %s", exc)
        return None
    return None


def ensure_system_user(user_id: int = 1, email: str = "system@a2z.agentz") -> bool:
    """
    Idempotently ensure the system/owner user (default id=1) exists.

    Agent A's enqueue_target uses DEFAULT_USER_ID (1) as the scraping_queue
    owner. On a fresh Railway DB the users table is empty, so the foreign key
    (scraping_queue_user_fk) fails every cycle. Seeding the row here (called
    from lifespan on startup) makes the schema self-healing on any new DB.

    We insert by EMAIL (not a forced id=1) so we never collide with the
    SERIAL sequence, then normalise the seeded row's id back to user_id (1)
    so DEFAULT_USER_ID stays correct. Idempotent: safe to call every boot.
    """
    try:
        with _get_cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE id = %s LIMIT 1;", (user_id,)
            )
            if cur.fetchone():
                return True
            # Insert by email (let SERIAL assign), avoid forcing id=1 collision.
            cur.execute(
                "INSERT INTO users (email, password_hash, wallet_address) "
                "VALUES (%s, %s, NULL) "
                "ON CONFLICT (email) DO NOTHING RETURNING id;",
                (email, "SYSTEM_USER_NO_LOGIN"),
            )
            row = cur.fetchone()
            if row:
                # Normalise the system user's id to user_id (1) for FK consistency.
                cur.execute(
                    "UPDATE users SET id = %s WHERE id = %s;", (user_id, row[0])
                )
            logger.info("ensure_system_user: seeded system user id=%s", user_id)
            return True
    except psycopg2.Error as exc:
        logger.error("ensure_system_user failed: %s", exc)
        return False

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


# ----------------------------------------------------------------------------
# SIWE (Sign-In-With-Ethereum) — P6 wallet-only auth (no email/password)
# ----------------------------------------------------------------------------

def get_user_by_wallet(wallet_address: str) -> dict | None:
    """Resolve a user by their connected wallet address (case-insensitive)."""
    if not wallet_address:
        return None
    query = (
        "SELECT id, email, password_hash, wallet_address, created_at, last_login_at "
        "FROM users WHERE LOWER(wallet_address) = LOWER(%s) LIMIT 1;"
    )
    try:
        with _get_cursor() as cur:
            cur.execute(query, (wallet_address,))
            row = cur.fetchone()
            if row:
                return {
                    'id': row[0],
                    'email': row[1],
                    'password_hash': row[2],
                    'wallet_address': row[3],
                    'created_at': row[4].strftime('%Y-%m-%d %H:%M:%S') if row[4] else None,
                    'last_login_at': row[5].strftime('%Y-%m-%d %H:%M:%S') if row[5] else None,
                }
    except psycopg2.Error as exc:
        logger.error("get_user_by_wallet failed: %s", exc)
        return None
    return None


def create_siwe_user(wallet_address: str) -> dict | None:
    """Create a wallet-only (SIWE) user. No email/password — email uses the
    addr@siwe.local convention so the NOT-NULL email column is satisfied
    without a real inbox. wallet_source = 'linked' (external wallet).

    Returns the new user dict, or None on collision/error.
    """
    fake_email = f"{wallet_address.lower()}@siwe.local"
    # SIWE users authenticate by signature, never by password. The users table
    # requires password_hash NOT NULL, so we store a non-null placeholder that
    # can never match a real bcrypt hash (login always routes SIWE users
    # through signature verification, never password comparison).
    placeholder_hash = "siwe-no-password"
    query = """
        INSERT INTO users (email, password_hash, wallet_address, wallet_source)
        VALUES (%s, %s, %s, 'linked')
        RETURNING id, email, wallet_address, wallet_source, created_at, last_login_at;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (fake_email, placeholder_hash, wallet_address))
            row = cur.fetchone()
            if row:
                return {
                    'id': row[0],
                    'email': row[1],
                    'wallet_address': row[2],
                    'wallet_source': row[3],
                    'created_at': row[4].strftime('%Y-%m-%d %H:%M:%S') if row[4] else None,
                    'last_login_at': row[5].strftime('%Y-%m-%d %H:%M:%S') if row[5] else None,
                }
    except psycopg2.IntegrityError:
        # Race: wallet already registered between nonce and verify.
        return get_user_by_wallet(wallet_address)
    except psycopg2.Error as exc:
        logger.error("create_siwe_user failed: %s", exc)
        return None
    return None


def ensure_siwe_tables() -> None:
    """Self-healing schema for SIWE anti-replay nonces. Called from lifespan
    alongside ensure_pipeline_tables so a fresh DB needs no manual migration.
    """
    query = """
        CREATE TABLE IF NOT EXISTS siwe_nonces (
            wallet_address VARCHAR(42) NOT NULL,
            nonce TEXT NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (wallet_address, nonce)
        );
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query)
    except psycopg2.Error as exc:
        logger.error("ensure_siwe_tables failed: %s", exc)


def upsert_siwe_nonce(wallet_address: str, nonce: str, ttl_seconds: int = 600) -> bool:
    """Store a fresh SIWE nonce for an address (overwrites any prior nonce)."""
    from datetime import datetime, timedelta
    expires = datetime.utcnow() + timedelta(seconds=ttl_seconds)
    query = """
        INSERT INTO siwe_nonces (wallet_address, nonce, expires_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (wallet_address, nonce) DO UPDATE SET expires_at = EXCLUDED.expires_at;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (wallet_address.lower(), nonce, expires))
            return True
    except psycopg2.Error as exc:
        logger.error("upsert_siwe_nonce failed: %s", exc)
        return False
    return False


def consume_siwe_nonce(wallet_address: str, nonce: str) -> bool:
    """Atomically verify + delete a SIWE nonce. Returns True only if the nonce
    exists, matches, and is unexpired (anti-replay). Consumed once.
    """
    from datetime import datetime
    query_sel = (
        "SELECT expires_at FROM siwe_nonces "
        "WHERE LOWER(wallet_address) = LOWER(%s) AND nonce = %s LIMIT 1;"
    )
    query_del = (
        "DELETE FROM siwe_nonces WHERE LOWER(wallet_address) = LOWER(%s) AND nonce = %s;"
    )
    try:
        with _get_cursor() as cur:
            cur.execute(query_sel, (wallet_address, nonce))
            row = cur.fetchone()
            if not row:
                return False
            expires = row[0]
            if expires.tzinfo is not None:
                expires = expires.replace(tzinfo=None)
            if expires < datetime.utcnow():
                # Expired: clean up and refuse.
                cur.execute(query_del, (wallet_address, nonce))
                return False
            cur.execute(query_del, (wallet_address, nonce))
            return True
    except psycopg2.Error as exc:
        logger.error("consume_siwe_nonce failed: %s", exc)
        return False
    return False


def save_user_encrypted_wallet(user_id: int, encrypted_blob: str, generated_address: str) -> bool:
    """Persist a P3 self-custodial wallet (encrypted blob) onto an existing
    user (used by SIWE auto-provisioning). Idempotent-ish: only writes when
    the user has no key yet.
    """
    query = """
        UPDATE users
        SET encrypted_private_key = %s, wallet_address = COALESCE(wallet_address, %s), wallet_source = 'generated'
        WHERE id = %s AND encrypted_private_key IS NULL;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (encrypted_blob, generated_address, user_id))
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("save_user_encrypted_wallet failed for user %s: %s", user_id, exc)
        return False
    return False

def get_user_by_id(user_id: int) -> dict:
    query = "SELECT id, email, wallet_address, plan, plan_active_until, payment_ref, created_at, last_login_at, execution_mode FROM users WHERE id = %s LIMIT 1;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()
            if row:
                return {
                    'id': row[0],
                    'email': row[1],
                    'wallet_address': row[2],
                    'plan': row[3],
                    'plan_active_until': row[4].strftime('%Y-%m-%d %H:%M:%S') if row[4] else None,
                    'payment_ref': row[5],
                    'created_at': row[6].strftime('%Y-%m-%d %H:%M:%S') if row[6] else None,
                    'last_login_at': row[7].strftime('%Y-%m-%d %H:%M:%S') if row[7] else None,
                    'execution_mode': row[8] or 'custodial',
                }
    except psycopg2.Error as exc:
        logger.error("get_user_by_id failed: %s", exc)
        return None
    return None


def get_user_execution_mode(user_id: int) -> str:
    """Return the user's execution mode: 'custodial' (default) or 'self_custodial'."""
    user = get_user_by_id(user_id)
    if not user:
        return 'custodial'
    return user.get('execution_mode') or 'custodial'


def set_user_execution_mode(user_id: int, mode: str) -> bool:
    """Persist the user's execution mode.

    Only accepts 'custodial' or 'self_custodial'. Rejects switching to
    self_custodial when the user has no encrypted (P3) wallet yet — they must
    generate one first (P3). Fail-closed.
    """
    if mode not in ('custodial', 'self_custodial'):
        return False
    if mode == 'self_custodial':
        # Guard: require a P3 wallet before allowing self-custodial execution.
        if not get_user_encrypted_key(user_id):
            return False
    query = "UPDATE users SET execution_mode = %s WHERE id = %s;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (mode, user_id))
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("set_user_execution_mode failed for user %s: %s", user_id, exc)
        return False


def get_user_encrypted_key(user_id: int) -> str | None:
    """Return ONLY the AES-GCM encrypted private-key blob for a user's
    self-custodial (P3) generated wallet.

    Privacy: this returns the CIPHERTEXT blob, never the plaintext key, and
    must never be logged. The caller (web3_async.get_user_wallet_account)
    decrypts it in-memory with WALLET_ENC_SECRET. Returns None when the user
    has no generated wallet (e.g. they only linked an external address).
    """
    query = "SELECT encrypted_private_key FROM users WHERE id = %s LIMIT 1;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id,))
            row = cur.fetchone()
            if row and row[0]:
                return row[0]
    except psycopg2.Error as exc:
        logger.error("get_user_encrypted_key failed for user %s: %s", user_id, exc)
    return None


# --- P4 subscription plan helpers REMOVED (AaaS zero-friction pivot) ---
# update_user_plan / get_user_plan / is_plan_active / count_user_daily_trades
# were dropped when the subscription/plan-gate model was retired. Monetization
# is now via the P1 platform fee only. The users.plan / plan_active_until /
# payment_ref columns are intentionally LEFT IN PLACE (no destructive migration)
# for stability and backward data compatibility; they are simply unused.


def update_last_login(user_id: int) -> None:
    query = "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id,))
    except psycopg2.Error as exc:
        logger.error("update_last_login failed: %s", exc)

# ==============================================================================
# System Config Operations
# ==============================================================================

def get_system_config(key: str, default_value: str = None) -> str:
    query = """
        CREATE TABLE IF NOT EXISTS system_config (
            key VARCHAR(50) PRIMARY KEY,
            value VARCHAR(255) NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        SELECT value FROM system_config WHERE key = %s LIMIT 1;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (key,))
            row = cur.fetchone()
            if row:
                return row[0]
            elif default_value is not None:
                # Insert default if not exists
                cur.execute('INSERT INTO system_config (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING;', (key, default_value))
                return default_value
    except psycopg2.Error as exc:
        logger.error('get_system_config failed: %s', exc)
    return default_value

def set_system_config(key: str, value: str) -> None:
    query = """
    CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(50) PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO system_config (key, value) VALUES (%s, %s)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (key, value))
    except psycopg2.Error as exc:
        logger.error('set_system_config failed: %s', exc)

# ==============================================================================
# Queue / Agent Pipeline Operations (database_schema_v2.sql)
# ==============================================================================

def ensure_pipeline_tables() -> None:
    query = """
    CREATE TABLE IF NOT EXISTS scraping_queue (
     id SERIAL PRIMARY KEY,
     user_id INTEGER NOT NULL,
     source VARCHAR(64) NOT NULL,
     project_name VARCHAR(255) NOT NULL,
     target_address VARCHAR(42),
     data_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
     processing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
     retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT scraping_queue_status_chk CHECK (processing_status IN ('PENDING','PROCESSING','COMPLETED','FAILED')),
     CONSTRAINT scraping_queue_addr_chk CHECK (target_address IS NULL OR target_address ~ '^0x[a-fA-F0-9]{40}$')
     );
     CREATE TABLE IF NOT EXISTS synthesis_results (
     id SERIAL PRIMARY KEY,
     queue_id INTEGER NOT NULL UNIQUE,
     score INTEGER CHECK (score BETWEEN 0 AND 100),
     risk_flags TEXT,
     reason TEXT,
     token_name VARCHAR(255),
     synthesized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     CREATE TABLE IF NOT EXISTS transaction_proposals (
     id SERIAL PRIMARY KEY,
     synthesis_id INTEGER NOT NULL UNIQUE,
     gnosis_safe_tx_hash VARCHAR(66) UNIQUE,
     amount_usd NUMERIC(20, 6) NOT NULL CHECK (amount_usd >= 0),
     status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
 CHECK (status IN ('PENDING','AWAITING_SIGNATURES','EXECUTED','FAILED','REJECTED')),
     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     CREATE TABLE IF NOT EXISTS audit_log (
     id BIGSERIAL PRIMARY KEY,
     event_type VARCHAR(64) NOT NULL,
     description TEXT NOT NULL,
     metadata JSONB DEFAULT '{}'::jsonb,
     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     CREATE INDEX IF NOT EXISTS scraping_queue_status_idx ON scraping_queue (processing_status);
     CREATE INDEX IF NOT EXISTS transaction_proposals_status_idx ON transaction_proposals (status);
     CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
     CREATE TABLE IF NOT EXISTS held_tokens (
         id SERIAL PRIMARY KEY,
         token_address VARCHAR(42) NOT NULL UNIQUE,
         token_name VARCHAR(255),
         buy_tx_hash VARCHAR(66),
         entry_price_usd NUMERIC(20, 8),
         amount_wei NUMERIC(78) NOT NULL DEFAULT 0,
         bought_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         sold_at TIMESTAMP,
         sell_tx_hash VARCHAR(66),
         status VARCHAR(16) NOT NULL DEFAULT 'HOLDING' CHECK (status IN ('HOLDING','SOLD'))
         );

         CREATE TABLE IF NOT EXISTS sell_proposals (
         id SERIAL PRIMARY KEY,
         token_address VARCHAR(42) NOT NULL,
         token_name VARCHAR(255),
         amount_wei NUMERIC(78) NOT NULL DEFAULT 0,
         profit_pct NUMERIC(10, 4),
         status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
             CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED')),
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         resolved_at TIMESTAMP
         );
         """  # noqa: E501  (multi-statement DDL; executed statement-by-statement below)
    try:
        with _get_cursor() as cur:
            # The CREATE TABLE block above is one statement; run it first.
            cur.execute(query)

            # ------------------------------------------------------------------
            # Migration: UNIQUE constraint for enqueue_target's
            #   INSERT ... ON CONFLICT (target_address) DO NOTHING
            # (database.py). Postgres refuses an ON CONFLICT spec unless a
            # unique / exclusion constraint exists on the conflict column,
            # so this index is MANDATORY for startup to succeed.
            #
            # `target_address` is nullable, so we use a PARTIAL unique index
            # (WHERE target_address IS NOT NULL). NULLs never conflict, which
            # matches the ON CONFLICT semantics exactly and keeps the index
            # small. CONCURRENTLY avoids locking the table on big prod tables.
            # Idempotent: CREATE INDEX IF NOT EXISTS + safe DROP path below.
            # ------------------------------------------------------------------
            _ensure_scraping_queue_target_address_unique(cur)
            # Migration: transaction_proposals.created_at may be missing on
            # older DBs (schema predates the budget-guard query). Add it
            # idempotently so get_daily_spend_usd() doesn't crash.
            try:
                cur.execute(
                    "ALTER TABLE transaction_proposals "
                    "ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;"
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: add created_at failed (benign): %s", exc)
            # Migration: synthesis_results needs reason + token_name so the
            # UI can display Agent A's LLM narrative / Factory token identity.
            try:
                cur.execute(
                    "ALTER TABLE synthesis_results ADD COLUMN IF NOT EXISTS reason TEXT;"
                )
                cur.execute(
                    "ALTER TABLE synthesis_results ADD COLUMN IF NOT EXISTS token_name VARCHAR(255);"
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: add synthesis_results cols failed (benign): %s", exc)
            # Migration: execution_logs needs queue_id + token_name + reason so
            # /api/transactions can return Agent A's narrative without a JOIN.
            try:
                cur.execute(
                    "ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS queue_id INTEGER;"
                )
                cur.execute(
                    "ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS token_name VARCHAR(255);"
                )
                cur.execute(
                    "ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS reason TEXT;"
                )
                # Migration: execution_logs needs user_id so the free-plan
                # daily trade cap can be enforced per user. Self-healing ALTER.
                cur.execute(
                    "ALTER TABLE execution_logs ADD COLUMN IF NOT EXISTS user_id INTEGER;"
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: add execution_logs cols failed (benign): %s", exc)

            # Migration: P4 subscription gate needs users.plan /
            # plan_active_until / payment_ref. Self-healing ALTERs.
            try:
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(32) NOT NULL DEFAULT 'free';"
                )
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_active_until TIMESTAMP;"
                )
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(255);"
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: add users plan cols failed (benign): %s", exc)

            # Migration: P4 password-reset flow needs the password_resets table.
            try:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS password_resets (
                        email VARCHAR(255) NOT NULL PRIMARY KEY,
                        code VARCHAR(16) NOT NULL,
                        expires_at TIMESTAMP NOT NULL,
                        used BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: create password_resets failed (benign): %s", exc)

            # Migration: P3 self-custodial wallet generation. Store only the
            # AES-encrypted private key + a marker of wallet origin. Plaintext
            # keys/seed phrases are NEVER persisted (shown to user once).
            try:
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;"
                )
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_source VARCHAR(16) NOT NULL DEFAULT 'linked';"
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: add wallet-gen cols failed (benign): %s", exc)
            # Migration: P2 (User Control) — per-user auto-sell toggle + per-user
            # vault linkage on held_tokens + limit-order table for manual sells.
            try:
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_sell_enabled BOOLEAN NOT NULL DEFAULT FALSE;"
                )
                cur.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(16) NOT NULL DEFAULT 'custodial';"
                )
                cur.execute(
                    "ALTER TABLE held_tokens ADD COLUMN IF NOT EXISTS user_id INTEGER;"
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_limit_orders (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        token_address VARCHAR(42) NOT NULL,
                        token_name VARCHAR(255),
                        amount_wei NUMERIC(78) NOT NULL DEFAULT 0,
                        limit_price_usd NUMERIC(20, 8) NOT NULL,
                        side VARCHAR(8) NOT NULL DEFAULT 'sell'
                            CHECK (side IN ('sell')),
                        status VARCHAR(16) NOT NULL DEFAULT 'OPEN'
                            CHECK (status IN ('OPEN','FILLED','CANCELLED','EXPIRED')),
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        filled_at TIMESTAMP,
                        fill_tx_hash VARCHAR(66)
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS user_smart_buy_orders (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        token_address VARCHAR(42) NOT NULL,
                        token_name VARCHAR(255),
                        amount_wei NUMERIC(78) NOT NULL DEFAULT 0,
                        target_entry_usd NUMERIC(20, 8) NOT NULL,
                        status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING','EXECUTED','CANCELLED','EXPIRED')),
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL,
                        executed_at TIMESTAMP,
                        buy_tx_hash VARCHAR(66),
                        executed_price_usd NUMERIC(20, 8),
                        source VARCHAR(16) DEFAULT 'llm'
                            CHECK (source IN ('llm','manual'))
                    );
                    """
                )
                cur.execute(
                    "CREATE INDEX IF NOT EXISTS user_limit_orders_user_idx ON user_limit_orders (user_id, status);"
                )
            except psycopg2.Error as exc:
                logger.warning("ensure_pipeline_tables: add P2 user-control cols failed (benign): %s", exc)
    except psycopg2.Error as exc:
        if "duplicate key value violates unique constraint" in str(exc):
            logger.info('ensure_pipeline_tables race condition caught (tables already created)')
        else:
            logger.error('ensure_pipeline_tables failed: %s', exc)
            raise


def _ensure_scraping_queue_target_address_unique(cur) -> None:
    """
    Guarantee scraping_queue.target_address has a unique constraint.

    Runs *after* table creation so it is safe to call on every boot. It is
    idempotent and self-healing:

      * If the unique index already exists, we do NOTHING (no DELETE, no
        CREATE INDEX). Previously this function ran a bare
        ``DELETE ... USING scraping_queue`` on EVERY boot to dedup rows, which
        collided with Agent A's concurrent INSERT and Agent B's
        ``SELECT ... FOR UPDATE SKIP LOCKED`` fetch -> classic deadlock
        (RowExclusiveLock wait chain). We now only touch the table when the
        index is genuinely missing, and we do the dedup inside the SAME
        locked transaction as the index build so there is no race window.
      * If a legacy full (non-partial) unique index exists but our partial one
        does not, the legacy one is dropped so the partial one can be created.

    Concurrency contract:
      - The dedup DELETE is preceded by ``SELECT ... FOR UPDATE SKIP LOCKED``
        so it never blocks (or is blocked by) Agent A/B's live row locks.
      - All DDL (DROP/CREATE INDEX) runs inside the caller's single
        transaction; psycopg2 commits it atomically.
    """
    idx_name = "scraping_queue_target_address_key"
    try:
        # Fast path: index already present -> do nothing, avoid any lock churn.
        cur.execute(
            "SELECT 1 FROM pg_indexes WHERE indexname = %s LIMIT 1;",
            (idx_name,),
        )
        if cur.fetchone():
            logger.info("scraping_queue.target_address unique index already present (%s) — skipping", idx_name)
            return

        # Index missing: this is a first-boot / recovered DB. Dedup duplicates
        # with a SKIP LOCKED guard so we don't deadlock against live traffic.
        cur.execute(
            """
            WITH dups AS (
                SELECT a.id
                FROM scraping_queue a
                JOIN scraping_queue b
                  ON a.target_address = b.target_address
                 AND a.id < b.id
                WHERE a.target_address IS NOT NULL
                FOR UPDATE SKIP LOCKED
            )
            DELETE FROM scraping_queue WHERE id IN (SELECT id FROM dups);
            """
        )
        # Drop any legacy full unique index so our partial one can exist.
        cur.execute(
            "DROP INDEX IF EXISTS scraping_queue_target_address_full_key;"
        )
        # Create the unique index (plain, committed by caller).
        #    IMPORTANT: this MUST be a FULL (non-partial) unique index.
        #    Postgres's ON CONFLICT (col) inference spec requires a complete
        #    unique index on exactly those columns; a PARTIAL unique index is
        #    NOT matched by inference, so the original error would persist.
        #    A plain UNIQUE index still permits multiple NULLs (NULLs are not
        #    equal), so nullable target_address is fine without a WHERE clause.
        cur.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS {idx_name} "
            "ON scraping_queue (target_address);"
        )
        logger.info("scraping_queue.target_address unique index ensured (%s)", idx_name)
    except psycopg2.Error as exc:
        msg = str(exc)
        # Still racing with another boot? Treat as benign and move on.
        if "already exists" in msg or "duplicate key value violates unique constraint" in msg:
            logger.info("scraping_queue.target_address unique index already present")
        else:
            logger.error("_ensure_scraping_queue_target_address_unique failed: %s", exc)
            raise


def enqueue_target(user_id: int, source: str, project_name: str, target_address: str | None, data_payload: dict) -> int | None:
    # FK-safe: if the supplied user_id is absent, fall back to the
    # first real user row (or seed the system user) so the
    # scraping_queue_user_fk never violates. Prevents the repeated
    # "Key (user_id)=(1) is not present in table users" error on
    # fresh / re-seeded Railway databases.
    try:
        with _get_cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE id = %s LIMIT 1;", (user_id,))
            if not cur.fetchone():
                cur.execute("SELECT id FROM users ORDER BY id LIMIT 1;")
                row = cur.fetchone()
                if row:
                    user_id = row[0]
                else:
                    ensure_system_user(user_id)
    except psycopg2.Error:
        pass  # fall through; insert will surface a real error if still bad

    query = """
    INSERT INTO scraping_queue
    (user_id, source, project_name, target_address, data_payload, processing_status)
    VALUES (%s, %s, %s, %s, %s, 'PENDING')
    ON CONFLICT (target_address) DO UPDATE
    SET processing_status = 'PENDING',
        data_payload = EXCLUDED.data_payload,
        updated_at = CURRENT_TIMESTAMP,
        retry_count = 0
    WHERE scraping_queue.processing_status IN ('COMPLETED', 'FAILED')
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id, source, project_name, target_address, json.dumps(data_payload or {})))
            row = cur.fetchone()
            if row:
                return row[0] if isinstance(row, (tuple, list)) else row.get('id')
            # Conflict: row already exists. Do NOT reset its status (that would
            # re-queue an already-PROCESSED/FAILED token and create an infinite
            # Agent A -> Agent B loop). Just return the existing row id.
            cur.execute("SELECT id FROM scraping_queue WHERE target_address = %s LIMIT 1;", (target_address,))
            existing = cur.fetchone()
            if existing:
                return existing[0] if isinstance(existing, (tuple, list)) else existing.get('id')
            return None
    except psycopg2.Error as exc:
        logger.error('enqueue_target failed: %s', exc)
        return None


def fetch_queue_depth() -> int:
    """Return count of PENDING tasks in scraping_queue (lightweight, no lock)."""
    try:
        with _get_cursor(dict_rows=False) as cur:
            cur.execute(
                "SELECT COUNT(*) FROM scraping_queue WHERE processing_status = 'PENDING'"
            )
            row = cur.fetchone()
            return int(row[0]) if row else 0
    except Exception:
        return -1  # signal error to dashboard

def fetch_and_lock_pending_task(limit: int = 1):
    query = """
    SELECT * FROM scraping_queue
    WHERE processing_status = 'PENDING' OR (processing_status = 'FAILED' AND retry_count < 3)
    ORDER BY id
    FOR UPDATE SKIP LOCKED
    LIMIT %s;
    """
    update_query = """
    UPDATE scraping_queue
    SET processing_status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP
    WHERE id = %s;
    """
    try:
        with _get_cursor(dict_rows=True) as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()
            if not rows:
                return None
            row = rows[0]
            cur.execute(update_query, (row['id'] if isinstance(row, dict) else row[0],))
            return row
    except psycopg2.Error as exc:
        logger.error('fetch_and_lock_pending_task failed: %s', exc)
        return None


def update_task_status(task_id: int, status: str, retry: bool = False) -> bool:
    query = """
    UPDATE scraping_queue
    SET processing_status = %s,
        retry_count = scraping_queue.retry_count + %s,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = %s;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (status, 1 if retry else 0, task_id))
            return True
    except psycopg2.Error as exc:
        logger.error('update_task_status failed: %s', exc)
        return False


def insert_synthesis_result(queue_id: int, score: int, risk_flags: str, reason: str = "", token_name: str = "") -> int | None:
 """
 Insert or update a synthesis result for a queue item.

 Uses ``ON CONFLICT (queue_id) DO UPDATE`` so that retries / replays
 do not violate the unique constraint on ``synthesis_results.queue_id``.
 The winning row always wins; if a newer synthesis overwrites an older
 one the returned id still points to the same row.
 """
 query = """
 INSERT INTO synthesis_results (queue_id, score, risk_flags, reason, token_name)
 VALUES (%s, %s, %s, %s, %s)
 ON CONFLICT (queue_id) DO UPDATE
 SET score = EXCLUDED.score,
 risk_flags = EXCLUDED.risk_flags,
 reason = EXCLUDED.reason,
 token_name = EXCLUDED.token_name,
 synthesized_at = CURRENT_TIMESTAMP
 RETURNING id;
 """
 try:
  with _get_cursor() as cur:
   cur.execute(query, (queue_id, score, risk_flags, reason, token_name))
   row = cur.fetchone()
   if row:
    return row[0] if isinstance(row, (tuple, list)) else row.get('id')
   return None
 except psycopg2.Error as exc:
  logger.error('insert_synthesis_result failed: %s', exc)
  return None


def insert_transaction_proposal(synthesis_id: int, amount_usd: float, gnosis_safe_tx_hash: str | None = None) -> int | None:
    query = """
    INSERT INTO transaction_proposals (synthesis_id, amount_usd, gnosis_safe_tx_hash, status)
    VALUES (%s, %s, %s, 'PENDING')
    ON CONFLICT (synthesis_id) DO UPDATE SET status='PENDING', amount_usd=EXCLUDED.amount_usd
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (synthesis_id, amount_usd, gnosis_safe_tx_hash))
            row = cur.fetchone()
            if row:
                return row[0] if isinstance(row, (tuple, list)) else row.get('id')
            return None
    except psycopg2.Error as exc:
        logger.error('insert_transaction_proposal failed: %s', exc)
        return None


def insert_sell_proposal(
    token_address: str,
    token_name: str,
    amount_wei: float,
    profit_pct: float,
) -> int | None:
    """P2: queue a take-profit sell for human approval (used when
    AGENT_B_AUTO_SELL=0). Returns the new proposal id or None on failure."""
    query = """
    INSERT INTO sell_proposals (token_address, token_name, amount_wei, profit_pct, status)
    VALUES (%s, %s, %s, %s, 'PENDING')
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (token_address, token_name, amount_wei, profit_pct))
            row = cur.fetchone()
            if row:
                return row[0] if isinstance(row, (tuple, list)) else row.get('id')
            return None
    except psycopg2.Error as exc:
        logger.error('insert_sell_proposal failed: %s', exc)
        return None


def update_proposal_hash(proposal_id: int, tx_hash: str) -> bool:
    """Persist the REAL on-chain tx hash onto a transaction proposal."""
    # NOTE: transaction_proposals has no `updated_at` column (only created_at),
    # so we must not reference it here or the UPDATE fails silently.
    query = """
    UPDATE transaction_proposals
    SET gnosis_safe_tx_hash = %s, status = 'EXECUTED'
    WHERE id = %s;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (tx_hash, proposal_id))
        return True
    except psycopg2.Error as exc:
        logger.error('update_proposal_hash failed: %s', exc)
        return False


def append_audit_log(event_type: str, description: str, metadata: dict | None = None) -> None:
    query = """
    INSERT INTO audit_log (event_type, description, metadata)
    VALUES (%s, %s, %s);
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (event_type, description, json.dumps(metadata or {})))
    except psycopg2.Error as exc:
        logger.error("append_audit_log failed: %s", exc)


def get_daily_spend_usd() -> float:
    """Sum of auto-approved transaction proposal amounts since local midnight.

    Used by Agent B's budget guard (MAX_DAILY_SPEND_USD) so the vault never
    blows past the operator-configured daily cap.
    """
    query = (
        "SELECT COALESCE(SUM(amount_usd), 0) "
        "FROM transaction_proposals "
        "WHERE created_at >= CURRENT_DATE;"
    )
    try:
        with _get_cursor() as cur:
            cur.execute(query)
            row = cur.fetchone()
            if row:
                return float(row[0] or 0)
    except psycopg2.Error as exc:
        logger.error("get_daily_spend_usd failed: %s", exc)
    return 0.0


# ---------------------------------------------------------------------------
# Held Tokens — Agent B buy/sell tracking
# ---------------------------------------------------------------------------

def insert_held_token(token_address: str, token_name: str, buy_tx_hash: str,
                      entry_price_usd: float, amount_wei: int,
                      network: str | None = None, user_id: int | None = None) -> int | None:
    """Record a token purchase so Agent B can later take profit."""
    if not network:
        try:
            from network_config import get_config
            network = get_config().network_flag
        except Exception:
            network = "mainnet"
    query = """
    INSERT INTO held_tokens (token_address, token_name, buy_tx_hash, entry_price_usd, amount_wei, status, network, user_id)
    VALUES (%s, %s, %s, %s, %s, 'HOLDING', %s, %s)
    ON CONFLICT (token_address) DO UPDATE SET status='HOLDING', user_id=EXCLUDED.user_id, amount_wei=EXCLUDED.amount_wei, entry_price_usd=EXCLUDED.entry_price_usd
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (token_address, token_name, buy_tx_hash, entry_price_usd, amount_wei, network, user_id))
            row = cur.fetchone()
            return row[0] if row else None
    except psycopg2.Error as exc:
        logger.error("insert_held_token failed: %s", exc)
        return None


def fetch_held_tokens(status: str = "HOLDING", network: str | None = None,
                      user_id: int | None = None) -> list[dict]:
    """Return held (or sold) tokens, optionally scoped to one user's vault."""
    if user_id is not None:
        query = "SELECT * FROM held_tokens WHERE status = %s AND user_id = %s ORDER BY bought_at"
        params = (status, user_id)
    elif network:
        query = "SELECT * FROM held_tokens WHERE status = %s AND network = %s ORDER BY bought_at"
        params = (status, network)
    else:
        query = "SELECT * FROM held_tokens WHERE status = %s ORDER BY bought_at"
        params = (status,)
    try:
        with _get_cursor(dict_rows=True) as cur:
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]
    except psycopg2.Error as exc:
        logger.error("fetch_held_tokens failed: %s", exc)
        return []


def mark_token_sold(token_address: str, sell_tx_hash: str, user_id: int | None = None) -> bool:
    """Mark a held token as sold (scoped to user when given)."""
    if user_id is not None:
        query = """
        UPDATE held_tokens SET status = 'SOLD', sell_tx_hash = %s, sold_at = CURRENT_TIMESTAMP
        WHERE token_address = %s AND status = 'HOLDING' AND user_id = %s
        """
        params = (sell_tx_hash, token_address, user_id)
    else:
        query = """
        UPDATE held_tokens SET status = 'SOLD', sell_tx_hash = %s, sold_at = CURRENT_TIMESTAMP
        WHERE token_address = %s AND status = 'HOLDING'
        """
        params = (sell_tx_hash, token_address)
    try:
        with _get_cursor() as cur:
            cur.execute(query, params)
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("mark_token_sold failed: %s", exc)
        return False


# ---------------------------------------------------------------------------
# P2 (User Control): per-user auto-sell preference + limit orders
# ---------------------------------------------------------------------------

def get_sell_preference(user_id: int) -> bool:
    """Return the user's auto-sell-agent toggle (default False)."""
    try:
        with _get_cursor() as cur:
            cur.execute("SELECT auto_sell_enabled FROM users WHERE id = %s LIMIT 1;", (user_id,))
            row = cur.fetchone()
            if row:
                return bool(row[0])
            return False
    except psycopg2.Error as exc:
        logger.error("get_sell_preference failed: %s", exc)
        return False


def set_sell_preference(user_id: int, enabled: bool) -> bool:
    """Set the user's auto-sell-agent toggle."""
    try:
        with _get_cursor() as cur:
            cur.execute(
                "UPDATE users SET auto_sell_enabled = %s WHERE id = %s;",
                (bool(enabled), user_id),
            )
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("set_sell_preference failed: %s", exc)
        return False


def insert_limit_order(user_id: int, token_address: str, token_name: str,
                       amount_wei: int, limit_price_usd: float) -> int | None:
    """Queue a user limit-sell order (OPEN). Returns order id or None."""
    query = """
    INSERT INTO user_limit_orders (user_id, token_address, token_name, amount_wei, limit_price_usd, status)
    VALUES (%s, %s, %s, %s, %s, 'OPEN')
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id, token_address, token_name, amount_wei, limit_price_usd))
            row = cur.fetchone()
            return row[0] if row else None
    except psycopg2.Error as exc:
        logger.error("insert_limit_order failed: %s", exc)
        return None


def fetch_limit_orders(user_id: int, status: str | None = None) -> list[dict]:
    """List a user's limit orders (all statuses by default)."""
    if status:
        query = "SELECT * FROM user_limit_orders WHERE user_id = %s AND status = %s ORDER BY created_at DESC;"
        params = (user_id, status)
    else:
        query = "SELECT * FROM user_limit_orders WHERE user_id = %s ORDER BY created_at DESC;"
        params = (user_id,)
    try:
        with _get_cursor(dict_rows=True) as cur:
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]
    except psycopg2.Error as exc:
        logger.error("fetch_limit_orders failed: %s", exc)
        return []


def fetch_limit_orders_open() -> list[dict]:
    """Return ALL open limit orders across users (worker fill loop)."""
    try:
        with _get_cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT * FROM user_limit_orders WHERE status = 'OPEN' ORDER BY created_at ASC;"
            )
            return [dict(r) for r in cur.fetchall()]
    except psycopg2.Error as exc:
        logger.error("fetch_limit_orders_open failed: %s", exc)
        return []


def cancel_limit_order(order_id: int, user_id: int) -> bool:
    """Cancel a user's OPEN limit order (only their own)."""
    try:
        with _get_cursor() as cur:
            cur.execute(
                "UPDATE user_limit_orders SET status = 'CANCELLED', resolved_at = CURRENT_TIMESTAMP "
                "WHERE id = %s AND user_id = %s AND status = 'OPEN';",
                (order_id, user_id),
            )
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("cancel_limit_order failed: %s", exc)
        return False


def mark_limit_filled(order_id: int, fill_tx_hash: str) -> bool:
    """Mark a limit order FILLED once the sell broadcasts."""
    try:
        with _get_cursor() as cur:
            cur.execute(
                "UPDATE user_limit_orders SET status = 'FILLED', filled_at = CURRENT_TIMESTAMP, fill_tx_hash = %s "
                "WHERE id = %s AND status = 'OPEN';",
                (fill_tx_hash, order_id),
            )
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("mark_limit_filled failed: %s", exc)
        return False



# ---------------------------------------------------------------------------
# P-OpsiA: Smart Buy Orders (LLM-driven limit-buy engine)
# ---------------------------------------------------------------------------

def insert_smart_buy_order(user_id: int, token_address: str, token_name: str,
                           amount_wei: int, target_entry_usd: float,
                           expires_at, source: str = "llm") -> int | None:
    """Queue an LLM-driven smart-buy order (PENDING). Returns order id or None."""
    query = """
    INSERT INTO user_smart_buy_orders
        (user_id, token_address, token_name, amount_wei, target_entry_usd, expires_at, source)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id, token_address, token_name, amount_wei,
                                target_entry_usd, expires_at, source))
            row = cur.fetchone()
            return row[0] if row else None
    except psycopg2.Error as exc:
        logger.error("insert_smart_buy_order failed: %s", exc)
        return None


def fetch_smart_buy_orders(user_id: int, status: str | None = None) -> list[dict]:
    """List a user's smart-buy orders (all statuses by default)."""
    if status:
        query = "SELECT * FROM user_smart_buy_orders WHERE user_id = %s AND status = %s ORDER BY created_at DESC;"
        params = (user_id, status)
    else:
        query = "SELECT * FROM user_smart_buy_orders WHERE user_id = %s ORDER BY created_at DESC;"
        params = (user_id,)
    try:
        with _get_cursor(dict_rows=True) as cur:
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]
    except psycopg2.Error as exc:
        logger.error("fetch_smart_buy_orders failed: %s", exc)
        return []


def fetch_smart_buy_orders_open() -> list[dict]:
    """Return ALL pending smart-buy orders across users (worker poll loop)."""
    try:
        with _get_cursor(dict_rows=True) as cur:
            cur.execute(
                "SELECT * FROM user_smart_buy_orders WHERE status = 'PENDING' ORDER BY created_at ASC;"
            )
            return [dict(r) for r in cur.fetchall()]
    except psycopg2.Error as exc:
        logger.error("fetch_smart_buy_orders_open failed: %s", exc)
        return []


def cancel_smart_buy_order(order_id: int, user_id: int) -> bool:
    """Cancel a user's own PENDING smart-buy order (idempotent, ownership-scoped)."""
    try:
        with _get_cursor() as cur:
            cur.execute(
                "UPDATE user_smart_buy_orders SET status = 'CANCELLED', executed_at = CURRENT_TIMESTAMP "
                "WHERE id = %s AND user_id = %s AND status = 'PENDING';",
                (order_id, user_id),
            )
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("cancel_smart_buy_order failed: %s", exc)
        return False


def mark_smart_buy_executed(order_id: int, tx_hash: str, executed_price_usd: float) -> bool:
    """Mark a PENDING smart-buy order as EXECUTED with the real on-chain fill price."""
    try:
        with _get_cursor() as cur:
            cur.execute(
                "UPDATE user_smart_buy_orders SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP, "
                "buy_tx_hash = %s, executed_price_usd = %s WHERE id = %s AND status = 'PENDING';",
                (tx_hash, executed_price_usd, order_id),
            )
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("mark_smart_buy_executed failed: %s", exc)
        return False


def expire_smart_buy_orders() -> int:
    """Flip overdue PENDING smart-buy orders to EXPIRED. Returns count expired."""
    try:
        with _get_cursor() as cur:
            cur.execute(
                "UPDATE user_smart_buy_orders SET status = 'EXPIRED', executed_at = CURRENT_TIMESTAMP "
                "WHERE status = 'PENDING' AND expires_at < CURRENT_TIMESTAMP;"
            )
            return cur.rowcount
    except psycopg2.Error as exc:
        logger.error("expire_smart_buy_orders failed: %s", exc)
        return 0



def create_password_reset(email: str, code: str, expires_at) -> bool:
    """Store a password-reset code (single-use, expires_at datetime)."""
    query = """
        INSERT INTO password_resets (email, code, expires_at)
        VALUES (%s, %s, %s)
        ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code,
            expires_at = EXCLUDED.expires_at, used = FALSE, created_at = CURRENT_TIMESTAMP;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (email, code, expires_at))
            return True
    except psycopg2.Error as exc:
        logger.error("create_password_reset failed: %s", exc)
        return False


def get_recent_password_reset(email: str):
    """Return the created_at timestamp of the most recent reset request for
    this email, or None if there is no prior request. Used for rate-limiting
    repeat forgot-password calls (anti-spam / anti-enumeration)."""
    query = "SELECT created_at FROM password_resets WHERE email = %s ORDER BY created_at DESC LIMIT 1;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (email,))
            row = cur.fetchone()
            return row[0] if row else None
    except psycopg2.Error as exc:
        logger.error("get_recent_password_reset failed: %s", exc)
        return None


def verify_password_reset(email: str, code: str) -> bool:
    """Return True if a valid (unused, unexpired) reset code exists."""
    query = """
        SELECT 1 FROM password_resets
        WHERE email = %s AND code = %s AND used = FALSE AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (email, code))
            return cur.fetchone() is not None
    except psycopg2.Error as exc:
        logger.error("verify_password_reset failed: %s", exc)
        return False


def consume_password_reset(email: str, code: str) -> bool:
    """Mark a reset code as used (call after password updated)."""
    query = "UPDATE password_resets SET used = TRUE WHERE email = %s AND code = %s;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (email, code))
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("consume_password_reset failed: %s", exc)
        return False


def update_user_password(email: str, password_hash: str) -> bool:
    """Set a new password hash for the user by email."""
    query = "UPDATE users SET password_hash = %s WHERE email = %s;"
    try:
        with _get_cursor() as cur:
            cur.execute(query, (password_hash, email))
            return cur.rowcount > 0
    except psycopg2.Error as exc:
        logger.error("update_user_password failed: %s", exc)
        return False
