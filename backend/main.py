from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse, HTMLResponse
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env", override=False)

# On serverless platforms (Vercel) there are no long-lived connections or
# background processes, so we drop WebSockets and the APScheduler loop.
IS_SERVERLESS = os.getenv("A2Z_PLATFORM", "").lower() in ("vercel", "serverless")

FIREWORKS_API_KEY = os.getenv("AGENT_B_API_KEY", "")

from routes.api import routes as api_routes
from routes.auth import routes as auth_routes
from scheduler.agent_runner import start_scheduler, stop_scheduler
import database

if not IS_SERVERLESS:
    from routes.websockets import routes as ws_routes
    from routes.websockets import poll_and_broadcast

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: Starlette):
    print("Starting A2Z Agentz Backend (Starlette)...")
    if IS_SERVERLESS:
        print("Serverless platform detected: skipping scheduler + WebSocket broadcast.")
    else:
        start_scheduler()
        task = asyncio.create_task(poll_and_broadcast())
        # Agent B runs as a dedicated daemon (continuous queue poll) so it
        # never hits APScheduler's max_instances cap. worker_loop is a pure
        # coroutine (await poll + await process_task + await broadcast) so it
        # runs directly on the server's event loop via create_task -- no
        # thread / asyncio.run wrapper needed.
        from scheduler.agent_b_cycle import worker_loop
        try:
            agent_b_task = asyncio.create_task(worker_loop(poll_interval=2.0))
            print("[STARTUP] Agent B daemon task created:", agent_b_task)
        except Exception as exc:
            print(f"[STARTUP-ERROR] Agent B daemon failed to start: {exc}")
        # Self-heal the system/owner user (id=1) so Agent A's enqueue_target
        # FK (scraping_queue_user_fk) doesn't fail on fresh Railway databases.
        database.ensure_system_user()
        # Startup guard: warn (not crash) if real execution is enabled but the
        # required secrets/RPCs are missing, so failures aren't silent.
        if os.getenv("AGENT_B_REAL_EXECUTION", "0") == "1":
            _missing = []
            if not os.getenv("VAULT_ADDRESS"):
                _missing.append("VAULT_ADDRESS")
            if not os.getenv("PRIVATE_KEY"):
                _missing.append("PRIVATE_KEY")
            _net = os.getenv("ACTIVE_NETWORK", "base").strip().lower()
            if _net == "base_sepolia":
                if not any(os.getenv(k) for k in ("BASE_SEPOLIA_RPC", "BASE_SEPOLIA_RPC_1", "BASE_SEPOLIA_RPC_2")):
                    _missing.append("BASE_SEPOLIA_RPC_*")
            else:
                if not any(os.getenv(k) for k in ("BASE_RPC_1", "BASE_RPC_2", "BASE_RPC_3", "BASE_RPC_4")):
                    _missing.append("BASE_RPC_*")
            if _missing:
                print(f"[WARN] AGENT_B_REAL_EXECUTION=1 but missing: {', '.join(_missing)}")
        yield
        print("Shutting down A2Z Agentz Backend...")
        stop_scheduler()
        task.cancel()
        agent_b_task.cancel()
        return
    yield

async def read_root(request):
    return JSONResponse({"message": "A2Z Agentz API is running."})

async def get_docs(request):
    html = """
    <!DOCTYPE html>
    <html>
    <head>
    <title>A2Z Agentz API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
    </head>
    <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
    </script>
    </body>
    </html>
    """
    return HTMLResponse(html)

async def get_openapi(request):
    return JSONResponse({
        "openapi": "3.0.2",
        "info": {"title": "A2Z Agentz API", "version": "1.0.0"},
        "paths": {
            "/api/stats": {
                "get": {
                    "summary": "Get Stats",
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/targets": {
                "get": {
                    "summary": "Get Targets",
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/transactions": {
                "get": {
                    "summary": "Get Transactions",
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/system-status": {
                "get": {
                    "summary": "Get System Status",
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/circuit-breaker": {
                "post": {
                    "summary": "Circuit Breaker",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "action": {"type": "string", "example": "pause"}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/analyze": {
                "post": {
                    "summary": "Analyze Target Wallet",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "target_address": {"type": "string", "example": "0x123..."},
                                        "description": {"type": "string", "example": "A highly innovative protocol"},
                                        "project_name": {"type": "string", "example": "Project X"},
                                        "use_mock": {"type": "boolean", "example": False}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/status": {
                "get": {
                    "summary": "Get Execution Status",
                    "responses": {"200": {"description": "Successful Response"}}
                }
            },
            "/api/auth/register": {
                "post": {
                    "summary": "Register new user",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "email": {"type": "string", "example": "user@agent.io"},
                                        "password": {"type": "string", "example": "securepass123"},
                                        "wallet_address": {"type": "string", "example": "0x000..."}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"201": {"description": "User created"}, "409": {"description": "Email already registered"}, "422": {"description": "Invalid input"}}
                }
            },
            "/api/auth/login": {
                "post": {
                    "summary": "Login user",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "email": {"type": "string", "example": "user@agent.io"},
                                        "password": {"type": "string", "example": "securepass123"}
                                    }
                                }
                            }
                        }
                    },
                    "responses": {"200": {"description": "Login successful"}, "401": {"description": "Invalid credentials"}}
                }
            },
            "/api/auth/me": {
                "get": {
                    "summary": "Get current user profile",
                    "responses": {"200": {"description": "User profile"}, "401": {"description": "Not authenticated"}}
                }
            },
            "/api/auth/logout": {
                "post": {
                    "summary": "Logout user",
                    "responses": {"200": {"description": "Logout successful"}}
                }
            }
        }
    })

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
# Support comma-separated list of allowed origins (Railway/Vercel dashboards
# often live on a different host than localhost). When allow_credentials is
# True Starlette forbids "*", so we expand the env into an explicit list.
allow_origins = [o.strip() for o in frontend_origin.split(",") if o.strip()]
# In debug mode, also allow any origin so local/dev dashboards just work.
if os.getenv("DEBUG", "false").lower() == "true":
    allow_origins = ["*"]

middleware = [
    Middleware(CORSMiddleware, allow_origins=allow_origins, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
]

debug = os.getenv("DEBUG", "false").lower() == "true"

app = Starlette(
    debug=debug,
    routes=[
        Route("/", read_root, methods=["GET"]),
        Route("/docs", get_docs, methods=["GET"]),
        Route("/openapi.json", get_openapi, methods=["GET"]),
        Mount("/api/auth", routes=auth_routes),
        Mount("/api", routes=api_routes),
    ] + ([Mount("/", routes=ws_routes)] if not IS_SERVERLESS else []),
    middleware=middleware,
    lifespan=lifespan
)
