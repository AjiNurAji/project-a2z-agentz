import sys
import os
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Add root directory to sys.path so we can import the existing agent modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

# If you have an agent_a.py, import it here
try:
    import agent_a_scraper
except ImportError:
    agent_a_scraper = None
try:
    import agent_b
except ImportError:
    agent_b = None

import requests

logger = logging.getLogger("a2z.scheduler")

scheduler = BackgroundScheduler()

def run_agent_a():
    """Wrapper to run Agent A logic (Scraping & Sentiment Analysis)"""
    logger.info("Triggering Agent A (Scout)...")
    if not agent_a_scraper:
        logger.warning("agent_a_scraper not found")
        return
        
    try:
        source = os.getenv("AGENT_A_SOURCE", "mock")
        projects = agent_a_scraper.scrape_projects(source=source, limit=2)
        logger.info(f"Agent A scraped {len(projects)} projects.")
        
        for p in projects:
            payload = {
                "target_address": p.target_address,
                "description": p.description,
                "project_name": p.project_name,
                "use_mock": True if source == "mock" else False
            }
            # We call the local API to execute the full pipeline (Agent A Inference + Agent B Vault)
            api_url = os.getenv("INTERNAL_API_URL", "http://localhost:8080")
            api_key = os.getenv("API_KEY", "your_secret_api_key_for_agents")
            
            try:
                resp = requests.post(
                    f"{api_url}/api/analyze", 
                    json=payload, 
                    headers={"X-API-Key": api_key},
                    timeout=30.0
                )
                logger.info(f"Pipeline result for {p.project_name}: {resp.status_code} - {resp.text}")
            except Exception as req_e:
                logger.error(f"Pipeline request failed for {p.project_name}: {req_e}")
                
    except Exception as e:
        logger.error(f"Agent A failed: {e}")

def run_agent_b():
    """Wrapper to run Agent B logic (Execution & Payment)"""
    logger.info("Triggering Agent B (Vault)...")
    # In this architecture, Agent B is triggered directly via the /api/analyze endpoint 
    # when Agent A's score is > 85. So this background loop can be used for 
    # retrying failed transactions or processing manual approvals later.
    pass

from datetime import datetime

def start_scheduler():
    logger.info("Starting APScheduler for A2Z Agents...")
    
    # Run Agent A every 2 minutes for demo purposes, and trigger immediately on start
    scheduler.add_job(
        run_agent_a,
        trigger=IntervalTrigger(minutes=2),
        next_run_time=datetime.now(),
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
