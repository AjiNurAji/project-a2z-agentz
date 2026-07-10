import type { AgentLogPayload, RawTransaction } from "./ws";

// Structural shapes matching DashboardContext's AgentMessage / Transaction
// (re-declared here to keep mappers.ts React-free).
export interface MappedAgentMessage {
  id: string;
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  timestamp: Date;
  status: "sending" | "sent" | "processing" | "done" | "error";
  metadata?: {
    txHash?: string;
    score?: number;
    projectName?: string;
    amountUsd?: number;
  };
}

export interface MappedTransaction {
  id: string;
  projectName: string;
  targetAddress: string;
  amountUsd: number;
  status: "success" | "failed" | "pending";
  txHash: string;
  timestamp: Date;
  reason: string;
  gasUsedGwei: number;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function mapLogToAgentMessage(log: AgentLogPayload): MappedAgentMessage {
  return {
    id: genId(),
    sender: log.sender,
    content: log.content,
    timestamp: new Date(),
    status: "done",
    metadata: log.metadata,
  };
}

export function mapRawTxToTransaction(tx: RawTransaction): MappedTransaction {
  const statusLower = (tx.status || "").toLowerCase();
  const status: MappedTransaction["status"] =
    statusLower === "success" ? "success"
      : statusLower === "pending_approval" ? "pending"
        : "failed";

  return {
    id: tx.tx_hash_id,
    projectName: "On-Chain Target",
    targetAddress: tx.project_target_address,
    amountUsd: tx.amount_usd,
    status,
    txHash: tx.tx_hash_id,
    timestamp: new Date(tx.created_at.replace(" ", "T") + "Z"),
    reason: "Autonomous Execution",
    gasUsedGwei: 42,
  };
}
