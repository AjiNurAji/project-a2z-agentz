export type WsStatus = "connecting" | "connected" | "disconnected";

export interface RawTransaction {
  tx_hash_id: string;
  project_target_address: string;
  amount_usd: number;
  status: string;
  created_at: string;
}

export interface AgentLogPayload {
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  metadata?: {
    txHash?: string;
    score?: number;
    projectName?: string;
    amountUsd?: number;
  };
}

export interface SystemLogPayload {
  level: "INFO" | "WARN" | "SUCCESS" | "ERROR" | "AGENT_A" | "AGENT_B";
  message: string;
}

export interface WsMessageHandlers {
  onTransactions?: (txs: RawTransaction[]) => void;
  onAgentLog?: (log: AgentLogPayload) => void;
  onSystemLog?: (log: SystemLogPayload) => void;
  onStatusChange?: (status: WsStatus) => void;
}

export interface AgentSocketController {
  close(): void;
}

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

function buildWsUrl(): string {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const wsProto = api.startsWith("https") ? "wss" : "ws";
  const host = api.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `${wsProto}://${host}/ws`;
}

export function createAgentSocket(handlers: WsMessageHandlers): AgentSocketController {
  // SSR guard — no WebSocket on server
  if (typeof window === "undefined") {
    return { close() {} };
  }

  let closed = false;
  let socket: WebSocket | null = null;
  let backoff = INITIAL_BACKOFF_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (s: WsStatus) => handlers.onStatusChange?.(s);

  const connect = () => {
    if (closed) return;
    setStatus("connecting");

    // WS auth travels via Sec-WebSocket-Protocol (browsers cannot set
    // arbitrary handshake headers). Send NEXT_PUBLIC_API_KEY so the
    // Railway backend accepts the handshake; fall back to no subprotocol.
    const wsToken = process.env.NEXT_PUBLIC_API_KEY || "";
    const protocols = wsToken ? [wsToken] : [];
    socket = protocols.length ? new WebSocket(buildWsUrl(), protocols) : new WebSocket(buildWsUrl());

    socket.onopen = () => {
      backoff = INITIAL_BACKOFF_MS;
      setStatus("connected");
    };

    socket.onmessage = (event: MessageEvent) => {
      let msg: { type?: string; data?: unknown };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "LATEST_TRANSACTIONS") {
        handlers.onTransactions?.(msg.data as RawTransaction[]);
      } else if (msg.type === "AGENT_LOG") {
        handlers.onAgentLog?.(msg.data as AgentLogPayload);
      } else if (msg.type === "SYSTEM_LOG") {
        handlers.onSystemLog?.(msg.data as SystemLogPayload);
      }
    };

    socket.onclose = () => {
      setStatus("disconnected");
      if (closed) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    };

    socket.onerror = () => {
      // Errors normally precede close; reconnect is handled by onclose.
    };
  };

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.onclose = null;
        try {
          socket.close();
        } catch {
          // ignore close errors
        }
        socket = null;
      }
    },
  };
}
