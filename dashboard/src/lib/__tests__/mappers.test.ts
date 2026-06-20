import { describe, it, expect } from "vitest";
import { mapLogToAgentMessage, mapRawTxToTransaction } from "../mappers";
import type { AgentLogPayload, RawTransaction } from "../ws";

describe("mapLogToAgentMessage", () => {
  it("maps sender, content, metadata to AgentMessage", () => {
    const log: AgentLogPayload = {
      sender: "agent_a",
      content: "Scanning Farcaster...",
      metadata: { projectName: "ZeroGravity", score: 92, amountUsd: 2.0, txHash: "0xabc" },
    };
    const msg = mapLogToAgentMessage(log);
    expect(msg.sender).toBe("agent_a");
    expect(msg.content).toBe("Scanning Farcaster...");
    expect(msg.status).toBe("done");
    expect(msg.metadata).toEqual({ projectName: "ZeroGravity", score: 92, amountUsd: 2.0, txHash: "0xabc" });
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  it("works without metadata", () => {
    const msg = mapLogToAgentMessage({ sender: "system", content: "init" });
    expect(msg.metadata).toBeUndefined();
    expect(msg.sender).toBe("system");
  });

  it("assigns unique ids", () => {
    const a = mapLogToAgentMessage({ sender: "agent_a", content: "x" });
    const b = mapLogToAgentMessage({ sender: "agent_a", content: "x" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("mapRawTxToTransaction", () => {
  const base: RawTransaction = {
    tx_hash_id: "0xhash1",
    project_target_address: "0xaddr",
    amount_usd: 1.5,
    status: "SUCCESS",
    created_at: "2026-06-21T10:00:00",
  };

  it("maps SUCCESS to success", () => {
    expect(mapRawTxToTransaction({ ...base, status: "SUCCESS" }).status).toBe("success");
  });

  it("maps PENDING_APPROVAL to pending", () => {
    expect(mapRawTxToTransaction({ ...base, status: "PENDING_APPROVAL" }).status).toBe("pending");
  });

  it("maps FAILED to failed", () => {
    expect(mapRawTxToTransaction({ ...base, status: "FAILED" }).status).toBe("failed");
  });

  it("maps unknown status to failed", () => {
    expect(mapRawTxToTransaction({ ...base, status: "WAT" }).status).toBe("failed");
  });

  it("preserves id, address, amount, hash, timestamp", () => {
    const tx = mapRawTxToTransaction(base);
    expect(tx.id).toBe("0xhash1");
    expect(tx.targetAddress).toBe("0xaddr");
    expect(tx.amountUsd).toBe(1.5);
    expect(tx.txHash).toBe("0xhash1");
    expect(tx.timestamp).toEqual(new Date("2026-06-21T10:00:00"));
  });
});
