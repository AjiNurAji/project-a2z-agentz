"""
Database Pipeline Module for A2Z Agentz
Asyncpg-based PostgreSQL operations for scraping queue management
"""

import os
import asyncpg
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

POSTGRES_URI = os.getenv("POSTGRES_URI")


async def create_pool() -> asyncpg.Pool:
    """Create database connection pool using POSTGRES_URI from .env"""
    try:
        pool = await asyncpg.create_pool(POSTGRES_URI)
        print("✅ Database pool created successfully")
        return pool
    except Exception as e:
        print(f"⚠️ Database connection failed: {e}")
        raise


async def fetch_and_lock_pending_task(pool: asyncpg.Pool) -> Optional[Dict[str, Any]]:
    """
    Fetch and lock a single pending task from scraping_queue
    Query: SELECT * FROM scraping_queue WHERE processing_status = 'PENDING'
           FOR UPDATE SKIP LOCKED LIMIT 1
    Updates status to 'PROCESSING' before returning
    Returns None if no task available
    """
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow("""
                    SELECT * FROM scraping_queue
                    WHERE processing_status = 'PENDING'
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                """)

                if not row:
                    return None

                task_id = row["id"]

                await conn.execute("""
                    UPDATE scraping_queue
                    SET processing_status = 'PROCESSING',
                        updated_at = NOW()
                    WHERE id = $1
                """, task_id)

                updated_row = await conn.fetchrow(
                    "SELECT * FROM scraping_queue WHERE id = $1", task_id
                )

                return dict(updated_row) if updated_row else None

    except Exception as e:
        print(f"⚠️ Failed to fetch/lock task: {e}")
        return None


async def update_task_status(
    pool: asyncpg.Pool,
    task_id: int,
    status: str,
    retry: bool = False,
) -> bool:
    """
    Update task status
    If retry=True: increment retry_count
    If retry_count >= 3: force status = 'FAILED' permanently

    Args:
        pool: Database connection pool
        task_id: Task ID to update
        status: New status (PENDING, PROCESSING, COMPLETED, FAILED)
        retry: If True, increment retry_count

    Returns:
        bool: True if update successful, False otherwise
    """
    try:
        async with pool.acquire() as conn:
            if retry:
                current_retry = await conn.fetchval(
                    "SELECT retry_count FROM scraping_queue WHERE id = $1",
                    task_id,
                )
                new_retry = (current_retry or 0) + 1

                if new_retry >= 3:
                    await conn.execute("""
                        UPDATE scraping_queue
                        SET processing_status = 'FAILED',
                            retry_count = $2,
                            updated_at = NOW()
                        WHERE id = $1
                    """, task_id, new_retry)
                    print(
                        f"🚫 Task {task_id} permanently FAILED after {new_retry} retries"
                    )
                else:
                    await conn.execute("""
                        UPDATE scraping_queue
                        SET processing_status = 'PENDING',
                            retry_count = $2,
                            updated_at = NOW()
                        WHERE id = $1
                    """, task_id, new_retry)
                    print(f"🔄 Task {task_id} retry #{new_retry}")
            else:
                await conn.execute("""
                    UPDATE scraping_queue
                    SET processing_status = $2,
                        updated_at = NOW()
                    WHERE id = $1
                """, task_id, status)

            return True

    except Exception as e:
        print(f"⚠️ Failed to update task {task_id} status: {e}")
        return False


async def insert_to_queue(
    pool: asyncpg.Pool,
    payload: Dict[str, Any],
    target_address: str,
    project_name: str,
) -> bool:
    """
    Insert new task into scraping_queue
    ON CONFLICT (target_address) DO NOTHING (skip duplicate projects)

    Args:
        pool: Database connection pool
        payload: Task payload data (JSON)
        target_address: Contract address (unique key)
        project_name: Name of the project/token

    Returns:
        bool: True if inserted, False if skipped (duplicate)
    """
    try:
        async with pool.acquire() as conn:
            result = await conn.execute("""
                INSERT INTO scraping_queue (
                    target_address,
                    project_name,
                    payload,
                    processing_status,
                    retry_count,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, 'PENDING', 0, NOW(), NOW())
                ON CONFLICT (target_address) DO NOTHING
            """, target_address, project_name, payload)

            if result == "INSERT 0 1":
                print(f"📥 Inserted {project_name} ({target_address}) to queue")
                return True
            else:
                print(
                    f"⏭️ Skipped duplicate: {project_name} ({target_address})"
                )
                return False

    except Exception as e:
        print(f"⚠️ Failed to insert {project_name} to queue: {e}")
        return False


async def insert_to_blacklist(
    pool: asyncpg.Pool,
    target_address: str,
    project_name: str,
    reason: str,
) -> bool:
    """
    Insert address to blacklist table

    Args:
        pool: Database connection pool
        target_address: Contract address to blacklist
        project_name: Name of the project/token
        reason: Reason for blacklisting

    Returns:
        bool: True if inserted successfully
    """
    try:
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO blacklist (
                    target_address,
                    project_name,
                    reason,
                    created_at
                ) VALUES ($1, $2, $3, NOW())
                ON CONFLICT (target_address) DO NOTHING
            """, target_address, project_name, reason)

            print(
                f"⛔ Blacklisted: {project_name} ({target_address}) — {reason}"
            )
            return True

    except Exception as e:
        print(f"⚠️ Failed to blacklist {project_name}: {e}")
        return False


async def get_queue_stats(pool: asyncpg.Pool) -> Dict[str, int]:
    """
    Get queue statistics by status

    Returns:
        Dict with counts per status
    """
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT processing_status, COUNT(*) as count
                FROM scraping_queue
                GROUP BY processing_status
            """)

            stats = {row["processing_status"]: row["count"] for row in rows}
            return stats

    except Exception as e:
        print(f"⚠️ Failed to get queue stats: {e}")
        return {}
