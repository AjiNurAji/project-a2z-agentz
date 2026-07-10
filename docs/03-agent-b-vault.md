# 03. Agent B (The Vault)

**Agent B** is the execution-vault system in A2Z Agentz, operating on the **Base** blockchain. Because it handles real funds, Agent B is built around bulletproof security and operational reliability.

> **Note:** Agent B does **not** run a language model. All decision-making lives in Agent A (vLLM-served). Agent B is purely a deterministic executor, so there is no AMD runtime requirement here. Only its **deployment host** changes (co-located with Agent A on AMD Developer Cloud, or on separate compute).

## 1. Wallet & Key Management

Agent B uses an Externally Owned Account (EOA) for hackathon-speed simplicity, wrapped in a strict protection layer:

- **AWS KMS / HashiCorp Vault** — the *private key* is never stored in `.env` files or hardcoded. It is managed through a Key Management Service with automatic rotation.
- **Smart Contract Modifier** — Agent B only interacts with a *Custom Smart Contract* that exposes an `onlyOwner` function (Owner = Agent B's KMS identity).

## 2. Gas Strategy & Multi-RPC Fallback

To guarantee **99.9% uptime** and avoid stuck transactions:

- **Gas Oracle API** — before execution, Agent B pings the Alchemy / Infura Gas Station API and sets `maxFeePerGas` at the market average plus a 15% buffer.
- **Multi-RPC Fallback** — primary execution through Alchemy. If the primary node times out or goes down, failover is automatic to Infura or the public Base RPC.

## 3. Idempotency & Circuit Breaker

- **Double-Spend Prevention** — before broadcasting to the mempool, Agent B records a unique hash combining `(AgentA_ID, Project_Address, Timestamp)` in **PostgreSQL**. If Agent A submits a duplicate payload, Agent B rejects it locally.
- **Emergency Pause (Kill Switch)** — wired to the Next.js Dashboard. A human can click a global emergency stop that halts all on-chain operations instantly.
- **Per-Transaction Cap** — a hard cap of $1 to $2 per autonomous transaction. Anything above that must enter the *Manual Approval* queue.

## 4. Transaction Security Validation (Anti-Honeypot)

Before sending funds to a project address, Agent B runs a **local dry-run simulation** by forking state through **Foundry Anvil** or **Tenderly**. If the simulation shows a revert or an unexpected token drain -> the transaction is blocked.

## 5. Deployment Context

- **Host**: Container on AMD Developer Cloud (same region as Agent A for low inter-agent REST latency).
- **No LLM on Agent B** — the entire decision stack is deterministic, so it does not consume GPU resources.
- **Communication with Agent A**: HTTPS REST with ECDSA signature verification (see `04-communication-protocol.md`).
