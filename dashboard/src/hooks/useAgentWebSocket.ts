"use client";

import { useEffect, useRef, useState } from "react";
import { createAgentSocket, type WsStatus, type RawTransaction, type AgentLogPayload, type SystemLogPayload } from "@/lib/ws";

const MAX_LOGS = 50;

export interface WsCallbacks {
  onAgentLog?: (log: AgentLogPayload) => void;
  onSystemLog?: (log: SystemLogPayload) => void;
  onTransactions?: (txs: RawTransaction[]) => void;
}

export interface UseAgentWebSocketResult {
  status: WsStatus;
  transactions: RawTransaction[];
  agentLogs: AgentLogPayload[];
  systemLogs: SystemLogPayload[];
  lastMessageAt: number | null;
}

export function useAgentWebSocket(callbacks?: WsCallbacks): UseAgentWebSocketResult {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const [transactions, setTransactions] = useState<RawTransaction[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLogPayload[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogPayload[]>([]);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const ctrlRef = useRef<ReturnType<typeof createAgentSocket> | null>(null);

  useEffect(() => {
    ctrlRef.current = createAgentSocket({
      onStatusChange: setStatus,
      onTransactions: (txs) => {
        setTransactions(txs);
        setLastMessageAt(Date.now());
        callbacks?.onTransactions?.(txs);
      },
      onAgentLog: (log) => {
        setAgentLogs((prev) => [...prev, log].slice(-MAX_LOGS));
        setLastMessageAt(Date.now());
        callbacks?.onAgentLog?.(log);
      },
      onSystemLog: (log) => {
        setSystemLogs((prev) => [...prev, log].slice(-MAX_LOGS));
        setLastMessageAt(Date.now());
        callbacks?.onSystemLog?.(log);
      },
    });

    return () => {
      ctrlRef.current?.close();
      ctrlRef.current = null;
    };
  }, []);

  return { status, transactions, agentLogs, systemLogs, lastMessageAt };
}
