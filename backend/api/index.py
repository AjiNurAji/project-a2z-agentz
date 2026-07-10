"""Vercel serverless entry point for the A2Z Agentz backend.

Vercel's Python runtime serves any `api/*.py` that exposes a WSGI/ASGI
`app`/`handler`. We keep the real ASGI app in `main.py` and only adapt it
here so the rest of the codebase stays framework-agnostic.

Vercel constraints handled here:
  * No long-lived WebSocket connections -> the WS mount is dropped.
  * No background processes -> the APScheduler + poll_and_broadcast task
    are skipped (deployment platform runs one short-lived request at a time).
  * `PYTHONPATH` is set to the function root, so `import database`,
    `import web3_async`, `from routes.api import ...` all resolve.
"""
import os
import sys
from pathlib import Path

# Ensure the backend package root is importable (Vercel sets the cwd to the
# function directory, i.e. this `api/` folder's parent).
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Load .env if present (Vercel injects env vars directly, but a local .env
# in the backend folder is convenient for `vercel dev`).
from dotenv import load_dotenv
load_dotenv(BACKEND_ROOT / ".env", override=False)

# Flag consumed by main.py to disable serverful features on Vercel.
os.environ.setdefault("A2Z_PLATFORM", "vercel")

from main import app  # noqa: E402  (import after path/env setup)

# Vercel expects the ASGI app under the name `app`.
handler = app
