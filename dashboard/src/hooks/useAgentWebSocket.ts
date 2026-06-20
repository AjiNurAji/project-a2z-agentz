"use client";

import { useEffect, useRef, useState } from "react";
import { createAgentSocket, type WsStatus, type RawTransaction, type AgentLogPayload } from "@/lib/ws";

const MAX_LOGS = 50;

export interface UseAgentWebSocketResult {
  status: WsStatus;
  transactions: RawTransaction[];
  agentLogs: AgentLogPayload[];
  lastMessageAt: number | null;
}

export function useAgentWebSocket(): UseAgentWebSocketResult {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogPayload[]>([]);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const ctrlRef = useRef<ReturnType<typeof createAgentSocket> | null>(null);

  useEffect(() => {
    ctrlRef.current = createAgentSocket({
      onStatusChange: setStatus,
      onTransactions: (txs) => {
        setTransactions(txs);
        setLastMessageAt(Date.now());
      },
      onAgentLog: (log) => {
        setAgentLogs((prev) => [...prev, log].slice(-MAX_LOGS));
        setLastMessageAt(Date.now());
      },
    });

    return () => {
      ctrlRef.current?.close();
      ctrlRef.current = null;
    };
  }, []);

  return { status, transactions, agentLogs, lastMessageAt };
}
