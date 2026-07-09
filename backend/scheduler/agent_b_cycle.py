"""
Agent B - The Vault (Cycle)
Worker loop that locks pending tasks from scraping_queue, runs gating, and
records proposals/synthesis results aligned with database_schema_v2.sql.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import aiohttp
from dotenv import load_dotenv

from database import (
  append_audit_log,
  ensure_pipeline_tables,
  fetch_and_lock_pending_task,
  insert_synthesis_result,
  insert_transaction_proposal,
  update_task_status,
)
from routes.websockets import manager
from web3_async import MultiRpcProvider

load_dotenv()

logger = logging.getLogger("a2z.agent_b")

AGENT_B_ENDPOINT = os.getenv("AGENT_B_ENDPOINT", "")
AGENT_B_MODEL = os.getenv("AGENT_B_MODEL", "")
AGENT_B_API_KEY = os.getenv("AGENT_B_API_KEY", "")
GOPLUS_API_URL = os.getenv("GOPLUS_API_URL", "")
GOPLUS_API_KEY = os.getenv("GOPLUS_API_KEY", "")
BASE_RPC_1 = os.getenv("BASE_RPC_1", "")
BASE_RPC_2 = os.getenv("BASE_RPC_2", "")
BASE_RPC_3 = os.getenv("BASE_RPC_3", "")
BASE_CHAIN_ID = int(os.getenv("BASE_CHAIN_ID", "8453"))
MAX_SCORE_FOR_AUTO = int(os.getenv("AGENT_B_AUTO_SCORE_MIN", "85"))
DEFAULT_NETWORK_HINT = os.getenv("ACTIVE_NETWORK", "base")


def _build_rpc_provider() -> MultiRpcProvider | None:
  urls = [u for u in [BASE_RPC_1, BASE_RPC_2, BASE_RPC_3] if u]
  if not urls:
    return None
  return MultiRpcProvider(rpc_urls=urls, chain_id=BASE_CHAIN_ID)


def _rpc_health_ok(provider: MultiRpcProvider | None) -> bool:
  if provider is None:
    return False
  try:
    health = provider.health()
    return bool(health.get("endpoints"))
  except Exception:
    return False


async def _check_goplus(session: aiohttp.ClientSession, token_address: str) -> dict[str, Any]:
  if not GOPLUS_API_URL:
    raise RuntimeError("goplus URL not configured")
  if not GOPLUS_API_KEY:
    return {"safe": True, "warning": "GoPlus key missing"}

  base_url = GOPLUS_API_URL.rstrip('/')
  if "/token_security/" in base_url:
    urls = [f"{base_url}/{token_address}"]
  else:
    urls = [f"{base_url}/api/v1/token_security/8453/{token_address}"]

  for url in urls:
    resp = await session.get(url, timeout=15)
    if resp.status == 200:
      return await resp.json()
    if resp.status == 404:
      raise RuntimeError(f"goplus token not found: HTTP 404 for {token_address}")
    resp.raise_for_status()
  raise RuntimeError(f"goplus upstream unavailable for {token_address}")


async def _run_agent_b_inference(token_name: str, contract_address: str, goplus_summary: str) -> dict[str, Any]:
  if not AGENT_B_API_KEY or not AGENT_B_ENDPOINT or not AGENT_B_MODEL:
    return {"score": 0, "reason": "missing agent b config", "amount_usd": 0.0, "model": "bypass"}
  prompt = (
    "You are Agent B (The Vault Gatekeeper). Evaluate this Base token for honeypot/rug risk."
    f" Token: {token_name} Address: {contract_address} GoPlus: {goplus_summary}"
    " Return JSON with keys: score (0-100), reason, amount_usd (<=2), category, model."
  )
  payload = {
    "model": AGENT_B_MODEL,
    "messages": [
      {"role": "system", "content": "Return only compact JSON."},
      {"role": "user", "content": prompt},
    ],
    "temperature": 0.1,
  }
  headers = {
    "Authorization": f"Bearer {AGENT_B_API_KEY}",
    "Content-Type": "application/json",
  }
  try:
    async with aiohttp.ClientSession() as session:
      async with session.post(
        AGENT_B_ENDPOINT,
        json=payload,
        headers=headers,
        timeout=30,
      ) as resp:
        if resp.status != 200:
          return {"score": 0, "reason": f"http {resp.status}", "amount_usd": 0.0, "model": AGENT_B_MODEL}
        data = await resp.json()
        content = (
          data.get("choices", [{}])[0]
          .get("message", {})
          .get("content", "")
        )
        try:
          parsed = json.loads(content)
          if isinstance(parsed, dict):
            return {
              "score": int(parsed.get("score", 0) or 0),
              "reason": str(parsed.get("reason", "")),
              "amount_usd": float(parsed.get("amount_usd", 0) or 0),
              "category": str(parsed.get("category", "unknown")),
              "model": str(parsed.get("model", AGENT_B_MODEL)),
            }
        except Exception:
          pass
        return {"score": 0, "reason": content[:200], "amount_usd": 0.0, "model": AGENT_B_MODEL}
  except Exception as exc:
    logger.warning("Agent B inference failed: %s", exc)
    return {"score": 0, "reason": f"inference_failed: {exc}", "amount_usd": 0.0, "model": AGENT_B_MODEL}


async def process_task(task: dict[str, Any]) -> None:
  queue_id = task["id"]
  payload = task.get("data_payload") or {}
  if isinstance(payload, str):
    try:
      payload = json.loads(payload)
    except json.JSONDecodeError:
      payload = {}
  token_name = payload.get("token_name") or task.get("project_name") or "Unknown"
  contract_address = payload.get("contract_address") or task.get("target_address") or ""
  source = task.get("source") or "unknown"

  async with aiohttp.ClientSession() as session:
    try:
      goplus_raw = await _check_goplus(session, contract_address)
    except RuntimeError as exc:
      if "HTTP 404" in str(exc) or "not found" in str(exc).lower():
        logger.warning("GoPlus 404 for %s — skipping synthesis for queue_id=%s", contract_address, queue_id)
        update_task_status(queue_id, "FAILED", retry=False)
        append_audit_log(
          "agent_b.goplus_404",
          f"Token not found on GoPlus for {contract_address}",
          {"queue_id": queue_id, "address": contract_address},
        )
        return
      raise
    result = goplus_raw.get("result") if isinstance(goplus_raw, dict) else None
    if isinstance(result, dict):
      goplus_summary = json.dumps({
        "is_honeypot": result.get("is_honeypot"),
        "buy_tax": result.get("buy_tax"),
        "sell_tax": result.get("sell_tax"),
        "is_open_source": result.get("is_open_source"),
      })
    else:
      goplus_summary = json.dumps({})

    inference = await _run_agent_b_inference(token_name, contract_address, goplus_summary)
    score = int(inference.get("score", 0) or 0)
    reason = inference.get("reason") or ""
    synthesis_id = insert_synthesis_result(queue_id, score, reason)
    append_audit_log(
      "agent_b.synthesized",
      f"Synthesized score={score} for queue_id={queue_id}",
      {"queue_id": queue_id, "score": score, "address": contract_address},
    )

    try:
      await manager.broadcast(
        json.dumps({
          "type": "AGENT_LOG",
          "data": {
            "sender": "agent_b",
            "content": f"Analyzed {token_name} ({contract_address}). Score: {score}/100. Reason: {reason}",
            "metadata": {"score": score, "projectName": token_name}
          }
        })
      )
    except Exception:
      pass

    if score >= MAX_SCORE_FOR_AUTO and _rpc_health_ok(_build_rpc_provider()):
      amount_usd = min(float(inference.get("amount_usd", 0) or 0), 2.0)
      proposal_id = insert_transaction_proposal(synthesis_id, amount_usd, None)
      append_audit_log(
        "agent_b.proposal_created",
        f"Auto proposal amount_usd={amount_usd}",
        {"synthesis_id": synthesis_id, "proposal_id": proposal_id, "address": contract_address},
      )
      try:
        await manager.broadcast(
          json.dumps({
            "type": "AGENT_LOG",
            "data": {
              "sender": "agent_b",
              "content": f"Score {score} >= {MAX_SCORE_FOR_AUTO}. Auto-executing proposal for {token_name}. Amount: ${amount_usd}",
              "metadata": {"amountUsd": amount_usd, "projectName": token_name}
            }
          })
        )
      except Exception:
        pass
      update_task_status(queue_id, "COMPLETED", retry=False)
      return

    update_task_status(queue_id, "FAILED", retry=True)


async def worker_loop(poll_interval: float = 2.0) -> None:
  from database import get_system_config
  if get_system_config("circuit_breaker", "active") == "paused":
    logger.info("Circuit breaker is paused. Agent B skipping cycle.")
    return

  ensure_pipeline_tables()
  logger.info("Agent B worker starting cycle")
  while True:
    task = fetch_and_lock_pending_task(limit=1)
    if task is None:
      break # Exit the cycle when no more tasks
    try:
      await process_task(task)
    except Exception as exc:
      logger.error("Agent B task failed: %s", exc, exc_info=True)
      queue_id = task.get("id") if isinstance(task, dict) else getattr(task, "id", None)
      if queue_id is not None:
        update_task_status(queue_id, "FAILED", retry=True)
        append_audit_log("agent_b.error", str(exc), {"queue_id": queue_id})


async def main() -> None:
  await worker_loop()


if __name__ == "__main__":
  asyncio.run(main())
