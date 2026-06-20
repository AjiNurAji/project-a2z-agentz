import sys
import os
import json
import time
from starlette.routing import Route
from starlette.responses import JSONResponse
from starlette.requests import Request

# Add root directory to sys.path so we can import the existing database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database
from agent_a_scraper import normalize_address
from agent_a_chroma import check_semantic_similarity
from agent_a_inference import run_ai_inference, DEFAULT_MODEL
from agent_b import _usd_to_wei, _idempotency_key, AUTONOMOUS_CAP_USD
from web3_client import simulate_and_execute_tx

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

async def analyze_target(request: Request):
    """
    POST /analyze
    Expects JSON: {"target_address": "0x...", "description": "...", "project_name": "...", "use_mock": bool}
    """
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
        
    use_mock = data.get("use_mock", False)
    if os.getenv("USE_MOCK") == "1":
        use_mock = True
        
    if use_mock:
        # Dummy test data structure
        return JSONResponse({
            "status": "executed",
            "step": "inference",
            "project_name": data.get("project_name", "Mock Project"),
            "target_address": data.get("target_address", "0x0000000000000000000000000000000000000000"),
            "score": 92,
            "category": "defi",
            "reason": "Mock dummy data for frontend development",
            "amount_usd": 2.0,
            "tx_hash": "0xabc123mockhash"
        })

    raw_addr = data.get("target_address", "")
    description = data.get("description", "")
    project_name = data.get("project_name", "unknown")

    # 1. Validation
    checksum = normalize_address(raw_addr)
    if not checksum:
        return JSONResponse({"status": "invalid_address", "message": "Invalid target address"}, status_code=400)
        
    # 2. Blacklist Check
    status_db = database.get_target_status(checksum)
    if isinstance(status_db, str) and status_db.strip().upper() == "BLACKLISTED":
        return JSONResponse({
            "status": "bypassed", 
            "message": "Address is blacklisted", 
            "step": "blacklist_check",
            "target_address": checksum
        })

    # 3. ChromaDB Semantic Dedup
    is_too_similar, score, matched_meta = check_semantic_similarity(description)
    if is_too_similar:
        return JSONResponse({
            "status": "bypassed", 
            "message": "Semantic duplicate", 
            "step": "chromadb_dedup",
            "similarity_score": score,
            "target_address": checksum
        })

    # 4. AI Inference
    ai_result = run_ai_inference(description, checksum, DEFAULT_MODEL)
    
    response_payload = {
        "step": "inference",
        "project_name": project_name,
        "target_address": checksum,
        "score": ai_result.score,
        "reason": ai_result.reason,
        "category": ai_result.category,
        "amount_usd": ai_result.amount_usd
    }

    # 5. Evaluate Result
    if ai_result.score > 85:
        # Agent B Vault Execution
        timestamp = int(time.time())
        log_key = _idempotency_key(checksum, timestamp)
        
        if database.check_idempotency(checksum, timestamp):
             response_payload["status"] = "failed"
             response_payload["message"] = "Duplicate execution"
             return JSONResponse(response_payload, status_code=409)
             
        if ai_result.amount_usd <= AUTONOMOUS_CAP_USD:
            try:
                val_wei = _usd_to_wei(ai_result.amount_usd)
                tx_hash = simulate_and_execute_tx(checksum, val_wei)
                database.insert_execution_log(tx_hash_id=log_key, address=checksum, amount=ai_result.amount_usd, status="SUCCESS")
                response_payload["status"] = "executed"
                response_payload["tx_hash"] = tx_hash
            except Exception as exc:
                response_payload["status"] = "execution_failed"
                response_payload["message"] = str(exc)
        else:
            database.insert_execution_log(tx_hash_id=log_key, address=checksum, amount=ai_result.amount_usd, status="PENDING_APPROVAL")
            response_payload["status"] = "pending_approval"
    else:
        # Blacklist if <= 85
        with database._get_cursor() as cur:
            query = """
                INSERT INTO target_addresses (address, sentiment_score, status)
                VALUES (%s, %s, 'BLACKLISTED')
                ON CONFLICT (address) DO UPDATE SET status = 'BLACKLISTED', sentiment_score = EXCLUDED.sentiment_score, updated_at = CURRENT_TIMESTAMP
            """
            cur.execute(query, (checksum, ai_result.score))
        response_payload["status"] = "blacklisted"
        response_payload["message"] = "Score too low, blacklisted."

    return JSONResponse(response_payload)

async def get_execution_status(request: Request):
    """
    GET /status
    Returns the latest execution logs or status for the UI polling.
    """
    try:
        with database._get_cursor(dict_rows=True) as cur:
            cur.execute("SELECT tx_hash_id, project_target_address, amount_usd, status, created_at FROM execution_logs ORDER BY created_at DESC LIMIT 50")
            transactions = cur.fetchall()
            for t in transactions:
                if 'created_at' in t and t['created_at']:
                    t['created_at'] = str(t['created_at'])
                if 'amount_usd' in t and t['amount_usd'] is not None:
                    t['amount_usd'] = float(t['amount_usd'])
            return JSONResponse({"status": "ok", "logs": transactions})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

routes = [
    Route("/stats", get_stats, methods=["GET"]),
    Route("/targets", get_targets, methods=["GET"]),
    Route("/transactions", get_transactions, methods=["GET"]),
    Route("/circuit-breaker", circuit_breaker, methods=["POST"]),
    Route("/system-status", get_system_status, methods=["GET"]),
    Route("/analyze", analyze_target, methods=["POST"]),
    Route("/status", get_execution_status, methods=["GET"]),
]
