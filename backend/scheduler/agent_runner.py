from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import database

logger = logging.getLogger("a2z.scheduler")

scheduler = BackgroundScheduler()


def run_agent_a() -> None:
    logger.info("Triggering Agent A (The Scout)...")
    try:
        from scheduler.agent_a_cycle import main as agent_a_cycle_main
        import asyncio
        asyncio.run(agent_a_cycle_main())
    except SystemExit:
        return
    except Exception as exc:  # noqa: BLE001
        logger.error("Agent A run failed: %s", exc, exc_info=True)


def run_agent_b() -> None:
    logger.info("Triggering Agent B (Vault)...")
    try:
        from scheduler.agent_b_cycle import worker_loop as agent_b_cycle_main
        import asyncio
        asyncio.run(agent_b_cycle_main(poll_interval=0.1))
    except SystemExit:
        return
    except Exception as exc:  # noqa: BLE001
        logger.error("Agent B run failed: %s", exc, exc_info=True)


def start_scheduler() -> None:
    logger.info("Starting APScheduler for A2Z Agents...")

    scheduler.add_job(
        run_agent_a,
        trigger=IntervalTrigger(minutes=2),
        next_run_time=datetime.now(),
        id="agent_a_job",
        name="Agent A Scout Cycle",
        replace_existing=True,
    )

    scheduler.add_job(
        run_agent_b,
        trigger=IntervalTrigger(seconds=30),
        next_run_time=datetime.now(),
        id="agent_b_job",
        name="Agent B Worker Cycle",
        replace_existing=True,
        max_instances=3,
    )

    scheduler.start()


def stop_scheduler() -> None:
    logger.info("Stopping APScheduler...")
    scheduler.shutdown()
