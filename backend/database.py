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


def ensure_system_user(user_id: int = 1, email: str = "system@a2z.agentz") -> bool:
    """
    Idempotently ensure the system/owner user (default id=1) exists.

    Agent A's enqueue_target uses DEFAULT_USER_ID (1) as the scraping_queue
    owner. On a fresh Railway DB the users table is empty, so the foreign key
    (scraping_queue_user_fk) fails every cycle. Seeding the row here (called
    from lifespan on startup) makes the schema self-healing on any new DB.
    """
    try:
        with _get_cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE id = %s LIMIT 1;", (user_id,)
            )
            if cur.fetchone():
                return True
            cur.execute(
                """INSERT INTO users (id, email, password_hash, wallet_address)
                   VALUES (%s, %s, %s, NULL)
                   ON CONFLICT (id) DO NOTHING;""",
                (user_id, email, "SYSTEM_USER_NO_LOGIN"),
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
     synthesized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     CREATE TABLE IF NOT EXISTS transaction_proposals (
     id SERIAL PRIMARY KEY,
     synthesis_id INTEGER NOT NULL UNIQUE,
     gnosis_safe_tx_hash VARCHAR(66) UNIQUE,
     amount_usd NUMERIC(20, 6) NOT NULL CHECK (amount_usd >= 0),
     status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
 CHECK (status IN ('PENDING','AWAITING_SIGNATURES','EXECUTED','FAILED','REJECTED'))
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

      * If a partial unique index on (target_address) already exists, nothing
        happens (CREATE INDEX IF NOT EXISTS).
      * If a legacy full (non-partial) unique index exists but our partial one
        does not, the legacy one is dropped so the partial one can be created.
      * If the table already holds duplicate target_address rows, they are
        deduplicated (keep newest by id) BEFORE the unique index is built, so
        a live database never crashes at startup.

    NOTE: a plain (non-CONCURRENTLY) CREATE INDEX is used on purpose. A
    CONCURRENTLY build runs in a separate transaction and is not visible to the
    current session's planner within the same connection, which would make the
    immediately-following enqueue_target() ON CONFLICT still fail. A regular
    CREATE INDEX takes a brief ACCESS EXCLUSIVE lock but is committed by the
    surrounding _get_conn() context manager, so the index is immediately
    visible to subsequent statements in the same pool. For very large tables
    you may instead run migrations/0003_*.sql (which uses CONCURRENTLY) during
    a maintenance window; both paths land on the same final index.
    """
    idx_name = "scraping_queue_target_address_key"
    try:
        # 1) Heal pre-existing duplicate rows so the unique index can build.
        cur.execute(
            """
            DELETE FROM scraping_queue a
            USING scraping_queue b
            WHERE a.id < b.id
              AND a.target_address IS NOT NULL
              AND a.target_address = b.target_address;
            """
        )
        # 2) Drop any legacy full unique index so our partial one can exist.
        cur.execute(
            "DROP INDEX IF EXISTS scraping_queue_target_address_full_key;"
        )
        # 3) Create the unique index (plain, committed by caller).
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
    query = """
    INSERT INTO scraping_queue
    (user_id, source, project_name, target_address, data_payload, processing_status)
    VALUES (%s, %s, %s, %s, %s, 'PENDING')
    ON CONFLICT (target_address) DO NOTHING
    RETURNING id;
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (user_id, source, project_name, target_address, json.dumps(data_payload or {})))
            row = cur.fetchone()
            if row:
                return row[0] if isinstance(row, (tuple, list)) else row.get('id')
            return None
    except psycopg2.Error as exc:
        logger.error('enqueue_target failed: %s', exc)
        return None


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


def insert_synthesis_result(queue_id: int, score: int, risk_flags: str) -> int | None:
 """
 Insert or update a synthesis result for a queue item.

 Uses ``ON CONFLICT (queue_id) DO UPDATE`` so that retries / replays
 do not violate the unique constraint on ``synthesis_results.queue_id``.
 The winning row always wins; if a newer synthesis overwrites an older
 one the returned id still points to the same row.
 """
 query = """
 INSERT INTO synthesis_results (queue_id, score, risk_flags)
 VALUES (%s, %s, %s)
 ON CONFLICT (queue_id) DO UPDATE
 SET score = EXCLUDED.score,
 risk_flags = EXCLUDED.risk_flags,
 synthesized_at = CURRENT_TIMESTAMP
 RETURNING id;
 """
 try:
  with _get_cursor() as cur:
   cur.execute(query, (queue_id, score, risk_flags))
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


def append_audit_log(event_type: str, description: str, metadata: dict | None = None) -> None:
    query = """
    INSERT INTO audit_log (event_type, description, metadata)
    VALUES (%s, %s, %s);
    """
    try:
        with _get_cursor() as cur:
            cur.execute(query, (event_type, description, json.dumps(metadata or {})))
    except psycopg2.Error as exc:
        logger.error('append_audit_log failed: %s', exc)
