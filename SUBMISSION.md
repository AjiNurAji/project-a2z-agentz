# Submission Checklist — AMD Developer Hackathon: ACT II

> Reference: [lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii)

## ✅ Submission Form (lablab.ai)

| Field | Status | Notes |
|---|---|---|
| Project Title | ⬜ | "A2Z Agentz — Autonomous A2A Payment Agent on AMD" |
| Short Description | ⬜ | 1–2 sentences mentioning the AMD stack and Agent-to-Agent theme |
| Long Description | ⬜ | 3–5 paragraphs with a link to `PRD.md` |
| Technology Tags | ⬜ | `DeepSeek v4`, `Fireworks AI`, `AMD Instinct MI300X`, `ROCm`, `AMD AI Workbench`, `AMD Inference Microservice`, `vLLM`, `LangGraph`, `Base Network`, `ECDSA`, `Next.js`, `Web3` |
| Category Tags | ⬜ | `AI Agents`, `Web3`, `FinTech` |
| Cover Image | ⬜ | 1200×630px, dark theme + AMD branding + Mermaid architecture |
| Video Presentation | ⬜ | 3 minutes, end-to-end live demo |
| Slide Presentation | ⬜ | 10–12 slides, pitch narrative |
| Public GitHub Repo | ✅ | https://github.com/axzss/project-a2z-agentz |
| Demo Application URL | ⬜ | Hosted on AMD Developer Cloud (or Vercel) |
| Submission Deadline | ⚠️ | TBD — monitor the lablab.ai ACT II page regularly |

## 📦 Submission Package (Deliverables)

### Code
- [ ] `src/orchestrator/main_graph.py` — LangGraph entry point
- [ ] `src/agent_a/` — Scout (scraper, AIM client, scoring)
- [ ] `src/agent_b/` — Vault (KMS, RPC, signer, dry-run)
- [ ] `contracts/A2ZVault.sol` — Pausable + Ownable Solidity contract
- [ ] `docker-compose.yml` — PostgreSQL + ChromaDB
- [ ] `dashboard/` — Next.js (ready, pending backend connection)
- [ ] `tests/` — Unit + integration tests (idempotency, signature, dry-run)
- [ ] `.env.example` — Secrets template (no real keys)
- [ ] `Dockerfile` for Agent A & B (ROCm-ready)

### Documentation
- [x] `README.md` — Overview + AMD stack
- [x] `PRD.md` — Full product spec
- [x] `docs/01-architecture.md` — Mermaid diagram
- [x] `docs/02-agent-a-scout.md` — Scout spec + AMD AI Workbench
- [x] `docs/03-agent-b-vault.md` — Vault spec
- [x] `docs/04-communication-protocol.md` — ECDSA + vLLM
- [x] `docs/05-setup-guide.md` — End-to-end install
- [x] `docs/06-amd-stack.md` — Judge-facing alignment doc
- [x] `memory.md` — Changelog
- [x] `LICENSE` — MIT

### Submission Artifacts
- [ ] **Cover image** (PNG/JPG, 1200×630)
- [ ] **Video** (YouTube unlisted / Loom, 3 min)
- [ ] **Slide deck** (PDF/PPTX, 10–12 slides)
- [ ] **Live demo URL** (public, HTTPS)

## 🎯 Video Demo Flow (3 minutes)

1. **[0:00–0:30]** Hook: "What if AI agents could pay each other autonomously on-chain?"
2. **[0:30–1:00]** Problem: missed Web3 opportunities + manual capital bootstrapping pain
3. **[1:00–1:30]** Solution: A2Z Agentz + AMD stack (show AMD AI Workbench workspace)
4. **[1:30–2:30]** **LIVE DEMO**:
   - Trigger Agent A → AIM inference
   - Hybrid scoring (70% sentiment + 30% TVL)
   - Agent B signing payload
   - Tx broadcast → show on Basescan
   - Dashboard live log streaming
5. **[2:30–2:50]** Safety: Circuit Breaker kill switch demo
6. **[2:50–3:00]** Closing: tech stack recap + team AnTS Groups + GitHub link

## 🚨 Risk Watch

- **Submission deadline TBD** — monitor the lablab.ai ACT II page every 2–3 days
- **AMD Cloud credits** — apply immediately if not yet claimed
- **Base mainnet ETH** — small amount required for tx fees (~$5)
- **Demo data** — never use real user data; always use dev / sandbox mode during the pitch

## 📞 Submission Channels

- Lab: https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii
- Discord: https://discord.gg/lablabai
- AMD Community: via AMD AI Developer Program
