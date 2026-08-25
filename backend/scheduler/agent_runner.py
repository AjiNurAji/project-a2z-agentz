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


def run_agent_b_daemon() -> None:
    """Blocking entry for the dedicated Agent B asyncio daemon task.

    Agent B is NOT scheduled via APScheduler. Running an infinite
    ``while True`` worker inside an APScheduler job triggers
    'maximum number of running instances reached (1)' and silently kills
    execution. Instead we run it as a long-lived asyncio task started once
    in the Starlette lifespan (like poll_and_broadcast), so it polls the
    queue continuously without being capped by max_instances.
    """
    logger.info("Starting Agent B (Vault) daemon (continuous poll)...")
    try:
        from scheduler.agent_b_cycle import worker_loop
        import asyncio
        asyncio.run(worker_loop(poll_interval=2.0))
    except SystemExit:
        return
    except Exception as exc:  # noqa: BLE001
        logger.error("Agent B daemon crashed: %s", exc, exc_info=True)


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

    # Agent B is now a daemon task (see main.py lifespan), not an APScheduler
    # job, so it can poll forever without hitting max_instances limits.

    scheduler.start()


def stop_scheduler() -> None:
    logger.info("Stopping APScheduler...")
    scheduler.shutdown()
