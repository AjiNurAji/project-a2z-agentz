import sys
import os
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Add root directory to sys.path so we can import the existing agent modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

# If you have an agent_a.py, import it here
# import agent_a
try:
    import agent_b
except ImportError:
    agent_b = None

logger = logging.getLogger("a2z.scheduler")

scheduler = BackgroundScheduler()

def run_agent_a():
    """Wrapper to run Agent A logic (Scraping & Sentiment Analysis)"""
    logger.info("Triggering Agent A (Scout)...")
    # try:
    #     agent_a.run_pipeline()
    # except Exception as e:
    #     logger.error(f"Agent A failed: {e}")
    pass

def run_agent_b():
    """Wrapper to run Agent B logic (Execution & Payment)"""
    logger.info("Triggering Agent B (Vault)...")
    if agent_b:
        try:
            # We assume agent_b has some run loop or single execution function
            # agent_b.execute_pending_transactions()
            pass
        except Exception as e:
            logger.error(f"Agent B failed: {e}")

def start_scheduler():
    logger.info("Starting APScheduler for A2Z Agents...")
    
    # Run Agent A every 1 hour (as per README)
    # For hackathon demo, we might set this to a shorter interval like 5 minutes
    scheduler.add_job(
        run_agent_a,
        trigger=IntervalTrigger(minutes=5),
        id='agent_a_job',
        name='Agent A Scraping Loop',
        replace_existing=True
    )
    
    # Run Agent B every 1 minute to check for new approved targets
    scheduler.add_job(
        run_agent_b,
        trigger=IntervalTrigger(minutes=1),
        id='agent_b_job',
        name='Agent B Execution Loop',
        replace_existing=True
    )
    
    scheduler.start()

def stop_scheduler():
    logger.info("Stopping APScheduler...")
    scheduler.shutdown()
