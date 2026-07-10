# 04. Inter-Agent Communication Protocol

This document bridges communication between **Agent A** (Scout, powered by a vLLM-served LLM on an AMD vLLM server) and **Agent B** (Vault, the on-chain executor).

## Payload Format (REST API)

Communication uses standard HTTP REST with a **JSON** payload. Agent B's backend (Vault API) receives the request and translates / *encodes* it into blockchain `calldata`.

### Example Request (Agent A → Agent B)

```json
POST /api/v1/vault/execute
{
 "timestamp": 1718500000,
 "project_target_address": "0x1234567890abcdef1234567890abcdef12345678",
 "amount_usd": 1.50,
 "reason": "High positive sentiment on Farcaster + Verified TVL > 500k",
 "signature": "0xabc123...def456"
}
```

## Security & Authentication (Signature Verification)

Agent B's API should never accept arbitrary calls. The following guardrails protect against *Man-in-the-Middle* (MitM) attacks or spoofed requests:

- Agent A holds a cryptographic *public-private keypair*.
- Every JSON *payload* is *hashed* and then *signed* (ECDSA) using Agent A's private key.
- Agent B maintains a *whitelist* of Agent A's public keys.
- When a request arrives, Agent B *verifies* the *signature*. If it is valid and the `timestamp` is still *fresh* (not expired), the instruction is executed.

## LangGraph Orchestration

Both agents are orchestrated through **LangGraph**. The graph *state* stores:
- `current_step`: `"Scraping"` -> `"Analyzing"` -> `"Approval"` -> `"Executing"`
- `transaction_status`: `"Pending"` / `"Success"` / `"Failed"`

## Inference Endpoint Reference

Agent A calls a **vLLM model server** served via **vLLM** on MI300X. The request format follows the OpenAI-compatible API:

```json
POST {AI_ENDPOINT}/v1/chat/completions
{
 "model": "a2z-web3-tuned",
 "messages": [
 {"role": "system", "content": "You are a Web3 project sentiment analyzer..."},
 {"role": "user", "content": "<raw_farcaster_post_or_onchain_data>"}
 ],
 "temperature": 0.1,
 "max_tokens": 512
}
```

The response from the vLLM-served LLM is then parsed by Agent A, merged with the on-chain TVL metric (30%), and if the combined score exceeds the threshold, the payload is forwarded to Agent B via the `/api/v1/vault/execute` endpoint shown above.

## Retry Policy

If execution fails in Agent B (for any reason), `transaction_status` changes to `"Failed"` and LangGraph triggers an **Exponential Backoff** retry (2s, 4s, 8s) before finally marking the run as a terminal failure.
