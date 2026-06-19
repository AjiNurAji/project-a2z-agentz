import asyncio
import json
from starlette.endpoints import WebSocketEndpoint
from starlette.routing import WebSocketRoute
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
import database

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
        await manager.connect(websocket)

    async def on_receive(self, websocket, data):
        pass # ignore incoming

    async def on_disconnect(self, websocket, close_code):
        manager.disconnect(websocket)

routes = [
    WebSocketRoute("/ws", WSEndpoint)
]
