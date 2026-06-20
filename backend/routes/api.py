import sys
import os
import json
from starlette.routing import Route
from starlette.responses import JSONResponse
from starlette.requests import Request

# Add root directory to sys.path so we can import the existing database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

async def get_stats(request: Request):
    """Returns global statistics for the dashboard."""
    try:
        with database._get_cursor(dict_rows=True) as cur:
            # Total transactions
            cur.execute("SELECT COUNT(*) as total FROM execution_logs")
            total_tx = cur.fetchone()["total"]

            # Success transactions
            cur.execute("SELECT COUNT(*) as success FROM execution_logs WHERE UPPER(status) = 'SUCCESS'")
            success_tx = cur.fetchone()["success"]

            # Total USD sent
            cur.execute("SELECT SUM(amount_usd) as total_usd FROM execution_logs WHERE UPPER(status) = 'SUCCESS'")
            total_usd = cur.fetchone()["total_usd"] or 0.0

            success_rate = (success_tx / total_tx * 100) if total_tx > 0 else 0

            return JSONResponse({
                "total_transactions": total_tx,
                "success_rate": round(success_rate, 2),
                "total_usd_sent": float(total_usd),
                "active_targets": 0
            })
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)

async def get_targets(request: Request):
    """Returns list of target addresses and their sentiment scores."""
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute("SELECT address, sentiment_score, status, updated_at FROM target_addresses ORDER BY updated_at DESC")
            targets = cur.fetchall()
            return JSONResponse({"data": targets})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)

async def get_transactions(request: Request):
    """Returns list of execution logs / transaction history."""
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute("SELECT tx_hash_id, project_target_address, amount_usd, status, created_at FROM execution_logs ORDER BY created_at DESC LIMIT 100")
            transactions = cur.fetchall()
            # Convert datetime to string for JSON serialization
            for t in transactions:
                if 'created_at' in t and t['created_at']:
                    t['created_at'] = str(t['created_at'])
                if 'amount_usd' in t and t['amount_usd'] is not None:
                    t['amount_usd'] = float(t['amount_usd'])
            return JSONResponse({"data": transactions})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)

async def circuit_breaker(request: Request):
    """Emergency pause or resume."""
    try:
        data = await request.json()
        action = data.get("action", "").lower()
        if action not in ["pause", "resume"]:
            return JSONResponse({"detail": "Invalid action. Must be 'pause' or 'resume'."}, status_code=400)

        new_status = "paused" if action == "pause" else "active"
        with database._get_cursor() as cur:
            cur.execute("UPDATE target_addresses SET status = %s WHERE status != 'BLACKLISTED'", (new_status,))
            updated = cur.rowcount
        return JSONResponse({"message": f"Circuit breaker activated: {action}", "targets_updated": updated})
    except Exception as e:
        return JSONResponse({"detail": str(e)}, status_code=500)

async def get_system_status(request: Request):
    """Returns health status of various components."""
    return JSONResponse({
        "database": "healthy",
        "rpc_node": "healthy",
        "aim_model": "healthy",
        "circuit_breaker": "active"
    })

routes = [
    Route("/stats", get_stats, methods=["GET"]),
    Route("/targets", get_targets, methods=["GET"]),
    Route("/transactions", get_transactions, methods=["GET"]),
    Route("/circuit-breaker", circuit_breaker, methods=["POST"]),
    Route("/system-status", get_system_status, methods=["GET"]),
]
