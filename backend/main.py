from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Mount, Route
from starlette.responses import JSONResponse, HTMLResponse
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from routes.api import routes as api_routes
from routes.auth import routes as auth_routes
from routes.websockets import routes as ws_routes
from routes.websockets import poll_and_broadcast
from scheduler.agent_runner import start_scheduler, stop_scheduler

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: Starlette):
    print("Starting A2Z Agentz Backend (Starlette)...")
    start_scheduler()
    task = asyncio.create_task(poll_and_broadcast())
    yield
    print("Shutting down A2Z Agentz Backend...")
    stop_scheduler()
    task.cancel()

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
            }
        }
    })

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

middleware = [
    Middleware(CORSMiddleware, allow_origins=[frontend_origin], allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
]

app = Starlette(
    debug=True,
    routes=[
        Route("/", read_root, methods=["GET"]),
        Route("/docs", get_docs, methods=["GET"]),
        Route("/openapi.json", get_openapi, methods=["GET"]),
        Mount("/api/auth", routes=auth_routes),
        Mount("/api", routes=api_routes),
        Mount("/", routes=ws_routes) # /ws is defined in ws_routes
    ],
    middleware=middleware,
    lifespan=lifespan
)
