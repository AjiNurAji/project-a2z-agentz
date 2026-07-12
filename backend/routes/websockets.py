import asyncio
import json
from starlette.endpoints import WebSocketEndpoint
from starlette.routing import WebSocketRoute
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

# Also add backend directory so we can import auth module
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from auth import verify_access_token

API_KEY = os.getenv("API_KEY", "your_secret_api_key_for_agents")
JWT_SECRET = os.getenv("JWT_SECRET", "")
# Frontend MUST authenticate via the Sec-WebSocket-Protocol subprotocol during
# the handshake. Two accepted forms:
#   1) a valid JWT signed with JWT_SECRET  (preferred, short-lived, no secret leak)
#   2) the server-side API_KEY            (dev fallback; NEVER bundled in the
#      frontend build -- it stays server-only)
ALLOWED_WS_PROTOCOLS = {p for p in (API_KEY,) if p and p != "your_secret_api_key_for_agents"}


def _ws_protocol_valid(protocol: str) -> bool:
    """
    Validate a Sec-WebSocket-Protocol value presented at handshake time.

    Why Sec-WebSocket-Protocol (not a query param / custom header):
      * Browsers cannot set arbitrary request headers on the WS handshake, but
        they CAN pass subprotocols via `new WebSocket(url, [proto])`.
      * It is NOT a secret channel: the value is visible in Cloudflare / proxy
        access logs exactly like a query param, so it must carry a JWT (which
        is safe to log) -- never a long-lived raw secret from the client.
    """
    if not protocol:
        return False
    # 1) Raw API_KEY (server-only dev fallback)
    if ALLOWED_WS_PROTOCOLS and protocol in ALLOWED_WS_PROTOCOLS:
        return True
    # 2) Valid JWT signed with JWT_SECRET (preferred)
    if JWT_SECRET and verify_access_token(protocol):
        return True
    return False


class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

# Background task to poll database and push updates to WebSockets
async def poll_and_broadcast():
    while True:
        await asyncio.sleep(5) # Poll every 5 seconds
        if not manager.active_connections:
            continue
            
        try:
            with database._get_cursor(dict_rows=True) as cur:
                cur.execute("SELECT tx_hash_id, project_target_address, amount_usd, status, created_at FROM execution_logs ORDER BY created_at DESC LIMIT 5")
                recent_logs = cur.fetchall()
                
            for t in recent_logs:
                if 'created_at' in t and t['created_at']:
                    t['created_at'] = str(t['created_at'])
                if 'amount_usd' in t and t['amount_usd'] is not None:
                    t['amount_usd'] = float(t['amount_usd'])

            payload = json.dumps({"type": "LATEST_TRANSACTIONS", "data": recent_logs})
            await manager.broadcast(payload)
        except Exception as e:
            print(f"WebSocket broadcast error: {e}")

class WSEndpoint(WebSocketEndpoint):
    encoding = "text"

    async def on_connect(self, websocket):
        # Cloudflare Tunnel rewrites the Origin header and browsers cannot set
        # arbitrary request headers on the WS handshake, so auth travels via the
        # Sec-WebSocket-Protocol subprotocol instead (set by the frontend via
        # `new WebSocket(url, [token])`). It MUST be a JWT (safe to log) -- the
        # raw API_KEY is only accepted as a server-side dev fallback.
        origin = websocket.headers.get("origin", "")
        # Always allow Cloudflare Tunnel + local dev. Also allow any origin
        # explicitly listed in FRONTEND_ORIGIN (comma-separated) so the Vercel
        # dashboard can open the A2A WebSocket.
        allowed_origins = [
            o.strip() for o in os.getenv("FRONTEND_ORIGIN", "").split(",") if o.strip()
        ]
        origin_allowed = (
            not origin
            or ".trycloudflare.com" in origin
            or "localhost" in origin
            or origin in allowed_origins
        )
        if not origin_allowed:
            await websocket.close(code=1008)
            return

        # Browsers require CORS headers on the WS upgrade response or they
        # silently close the socket (curl/python ignore this). Echo the
        # requesting origin and allow credentials so the Vercel dashboard can
        # open the socket cross-site.
        cors_headers = [
            (b"access-control-allow-origin", origin.encode() or b"*"),
            (b"access-control-allow-credentials", b"true"),
            (b"access-control-allow-methods", b"GET, OPTIONS"),
            (b"access-control-allow-headers", b"*"),
        ]
        existing = list(websocket.scope.get("headers", []))
        existing.extend(cors_headers)
        websocket.scope["headers"] = existing

        # Sec-WebSocket-Protocol may contain several comma/space separated
        # tokens; the client passes exactly one (the token). Accept the first
        # protocol value that validates.
        protocols = (websocket.headers.get("sec-websocket-protocol") or "").split(",")
        protocols = [p.strip() for p in protocols if p.strip()]
        if any(_ws_protocol_valid(proto) for proto in protocols):
            # Reflect the chosen subprotocol so the client handshake completes
            # (browsers require the server to echo an accepted protocol).
            websocket.scope.setdefault("subprotocol", protocols[0] if protocols else None)
            await manager.connect(websocket)
            return
        await websocket.close(code=1008)

    async def on_receive(self, websocket, data):
        pass # ignore incoming

    async def on_disconnect(self, websocket, close_code):
        manager.disconnect(websocket)

routes = [
    WebSocketRoute("/ws", WSEndpoint)
]
