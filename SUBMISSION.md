# Submission Checklist — AMD Developer Hackathon: ACT II

> Reference: [lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii)

## ✅ Submission Form (lablab.ai)

| Field | Status | Catatan |
|---|---|---|
| Project Title | ⬜ | "A2Z Agentz — Autonomous A2A Payment Agent on AMD" |
| Short Description | ⬜ | 1-2 kalimat, mention AMD stack + Agent-to-Agent |
| Long Description | ⬜ | 3-5 paragraf, link ke PRD.md |
| Technology Tags | ⬜ | `AMD Instinct MI300X`, `ROCm`, `AMD AI Workbench`, `AMD Inference Microservice`, `SGLang`, `LangGraph`, `Base Network`, `ECDSA`, `Next.js`, `Web3` |
| Category Tags | ⬜ | `AI Agents`, `Web3`, `FinTech` |
| Cover Image | ⬜ | 1200x630px, dark theme + AMD branding + Mermaid arch |
| Video Presentation | ⬜ | 3 menit, demo end-to-end live |
| Slide Presentation | ⬜ | 10-12 slide, pitch narrative |
| Public GitHub Repo | ✅ | https://github.com/axzss/project-a2z-agentz |
| Demo Application URL | ⬜ | Hosted di AMD Developer Cloud (atau Vercel) |
| Submission Deadline | ⚠️ | TBD — monitor lablab.ai ACT II page |

## 📦 Submission Package (Deliverables)

### Code
- [ ] `src/orchestrator/main_graph.py` — LangGraph entry point
- [ ] `src/agent_a/` — Scout (scraper, AIM client, scoring)
- [ ] `src/agent_b/` — Vault (KMS, RPC, signer, dry-run)
- [ ] `contracts/A2ZVault.sol` — Pausable + Ownable Solidity contract
- [ ] `docker-compose.yml` — PostgreSQL + ChromaDB
- [ ] `dashboard/` — Next.js (sudah ada, tinggal connect ke backend)
- [ ] `tests/` — Unit + integration test (idempotency, signature, dry-run)
- [ ] `.env.example` — Template secrets (no real keys)
- [ ] `Dockerfile` untuk Agent A & B (ROCm-ready)

### Documentation
- [x] `README.md` — Overview + AMD stack
- [x] `PRD.md` — Full product spec
- [x] `docs/01-architecture.md` — Mermaid diagram
- [x] `docs/02-agent-a-scout.md` — Scout spec + AMD AI Workbench
- [x] `docs/03-agent-b-vault.md` — Vault spec
- [x] `docs/04-communication-protocol.md` — ECDSA + SGLang
- [x] `docs/05-setup-guide.md` — End-to-end install
- [x] `docs/06-amd-stack.md` — Alignment untuk juri
- [x] `memory.md` — Changelog
- [x] `LICENSE` — MIT

### Submission Artifacts
- [ ] **Cover image** (PNG/JPG, 1200×630)
- [ ] **Video** (YouTube unlisted / Loom, 3 min)
- [ ] **Slide deck** (PDF/PPTX, 10-12 slides)
- [ ] **Live demo URL** (public, https)

## 🎯 Demo Flow untuk Video (3 menit)

1. **[0:00-0:30]** Hook: "What if AI agents could pay each other autonomously on-chain?"
2. **[0:30-1:00]** Problem: Web3 opportunities lost + manual capital bootstrapping pain
3. **[1:00-1:30]** Solution: A2Z Agentz + AMD stack (show AMD AI Workbench workspace)
4. **[1:30-2:30]** **LIVE DEMO**:
   - Trigger Agent A → AIM inference
   - Hybrid scoring (70% sentiment + 30% TVL)
   - Agent B signing payload
   - Tx broadcast → show on Basescan
   - Dashboard live log streaming
5. **[2:30-2:50]** Safety: Circuit Breaker kill switch demo
6. **[2:50-3:00]** Closing: tech stack summary + team AnTS Groups + github link

## 🚨 Risk Watch

- **Submission deadline TBD** — monitor lablab.ai ACT II page every 2-3 days
- **AMD Cloud credits** — apply ASAP if not yet claimed
- **Base mainnet ETH** — need small amount for tx fees (~$5)
- **Demo data** — jangan pakai data real user, selalu mode dev/sandbox saat pitching

## 📞 Submission Channels

- Lab: https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii
- Discord: https://discord.gg/lablabai
- AMD Community: via AMD AI Developer Program
