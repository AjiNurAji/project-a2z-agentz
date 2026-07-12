# 06. AMD Stack Alignment (for Hackathon Reviewers)

This document explains **why A2Z Agentz is a perfect fit for the AMD Developer Hackathon: ACT II theme and required tooling**, and how every project component maps to the AMD ecosystem.

## Position Summary

A2Z Agentz goes beyond "using an AMD GPU." It adopts an **end-to-end AMD-native pipeline** from training to deployment:

```
[Data Web3] -> [AMD AI Workbench: fine-tune] -> [vLLM: model]
 |
[Dashboard] <- [vLLM inference MI300X] <- [vLLM-served LLM]
 |
[Agent B: Base on-chain] <- [vLLM-served output]
```

## Mapping to ACT II Themes

| Theme / Requirement | A2Z Implementation |
|---|---|
| **"Build AI agents on AMD GPUs in the cloud"** | ✅ Agent A (Scout) runs 100% on AMD Instinct MI300X via AMD Developer Cloud. |
| **AMD AI Workbench** | ✅ Used to fine-tune base LLM -> vLLM-served Qwen/Qwen2.5-72B-Instruct-AWQ specialized for Web3 sentiment. GUI no-code, no custom training loop. |
| **vLLM model server** | ✅ Fine-tune result is wrapped as an AIM, served via a vLLM OpenAI-compatible endpoint. |
| **vLLM on ROCm** | ✅ Serving engine for vLLM, AMD's recommendation for high-throughput inference. |
| **Akash Systems (co-sponsor)** | 🟡 Optional: Agent A inference can later be bid out to Akash decentralized compute via X402 payment (post-hackathon). |
| **$100 AMD Cloud Credits** | ✅ Used for: 1) training job AI Workbench (~30 credits), 2) hosting vLLM server for 4 weeks (~50 credits), 3) buffer. |

## Why This Approach Is Strong for ACT II

### 1. End-to-end AMD stack showcase

Most submissions use OpenAI API or HuggingFace Inference. A2Z trains and deploys its own model on AMD hardware -- from Workbench (training) -> vLLM model (packaging) -> vLLM serving. This shows full command of the AMD toolchain.

### 2. Fine-tuning as the main differentiator

Most ACT II submissions will use an out-of-the-box model without fine-tuning. A2Z fine-tunes a base LLM into a Web3-sentiment vLLM-served Qwen/Qwen2.5-72B-Instruct-AWQ via AMD AI Workbench. This:
- Uses AMD tooling that most other participants have not explored yet.
- Improves inference accuracy for the target domain (Web3 / DeFi).
- Is easy for judges to reproduce: dataset, hyperparameters, and training workflow are all visible in the Workbench GUI.

### 3. Production-grade safety layer

A2Z is not just a happy-path demo. It includes:
- KMS key management (not a hardcoded private key)
- ECDSA signature verification between agents
- PostgreSQL idempotency check
- Circuit Breaker + Manual Approval
- Foundry Anvil dry-run for honeypot detection

This addresses judge concerns about agents interacting with real funds.

### 4. Real on-chain execution

Not a simulation. Agent B executes real transactions on Base mainnet (with a hard cap of $1-2 for safety during the hackathon). Judges can verify the Tx Hash on Basescan.

## Demo Flow for Judges (Suggested Pitch Order)

1. **Show AMD Developer Cloud console** -- workspace running on MI300X.
2. **Open AMD AI Workbench** -- show fine-tune job history + resulting vLLM model.
3. **Open vLLM endpoint** -- `curl /v1/models` -> show vLLM-served LLM loaded.
4. **Trigger Agent A manual run** -- call vLLM with sample Farcaster post -> get sentiment + reason.
5. **Hybrid Scoring** -- combine with on-chain TVL check -> score > 85.
6. **Agent B signing + execution** -- show the signed payload -> tx hash on Base.
7. **Open Dashboard** -- live log of every step above, Tx Hash link to Basescan.
8. **Trigger Circuit Breaker** -- show the global kill switch pause.

## External References

- AMD Blog: [Adapting vLLM models For Specific Use Cases Through Fine-Tuning in AMD AI Workbench](https://rocm.blogs.amd.com/software-tools-optimization/aiwb-fine-tuning/README.html)
- AMD Blog: [Unleashing AMD Instinct MI300X GPUs for LLM Serving with vLLM](https://rocm.blogs.amd.com/software-tools-optimization/disaggregation/README.html)
- AMD Docs: [vLLM distributed inference with MoRI](https://rocm.docs.amd.com/en/latest/how-to/rocm-for-ai/inference/benchmark-docker/vllm-mori-distributed.html)
- AMD Hackathon ACT II: [lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii)
