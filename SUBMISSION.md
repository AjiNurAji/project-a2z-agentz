# Submission Checklist — AMD Developer Hackathon: Track 3 — Unicorn (Open Innovation)

> Reference: AMD Developer Hackathon submission guidance for Track 3.
> Pre-screening inspects GitHub repo, Slide Deck (PDF), and Live Demo / hosted URL.

## ✅ Submission Fields

| Field | Placeholder / Status |
|---|---|
| **Project Title** | A2Z Agentz — Autonomous A2A Payment Agent on AMD |
| **Short Description** | An autonomous multi-agent system that scores Web3 opportunities and settles payments on Base, with all LLM inference running on an AMD GPU via vLLM on ROCm. |
| **Long Description** | TBD — link to `PRD.md` |
| **Technology Tags** | `vLLM`, `ROCm`, `AMD Instinct`, `AMD GPU`, `Cloudflare Tunnel`, `OpenAI-compatible API`, `Starlette`, `PostgreSQL`, `Base Network`, `Web3`, `Next.js`, `Python` |
| **Category Tags** | `AI Agents`, `Web3`, `Open Innovation` |
| **GitHub Repository** | https://github.com/<YOUR-ORG>/project-a2z-agentz |
| **Slide Deck URL** | https://docsend.com/view/<YOUR-SLIDE-DECK> |
| **Demo Video URL** | https://youtu.be/<YOUR-VIDEO> |
| **Live Demo / Hosted URL** | https://<YOUR-DOMAIN> |

## 🎯 Why AMD? (Executive Summary for Pre-Screening)

A2Z Agentz is architected to **prove AMD compute usage beyond doubt**:

1. **Inference runs on AMD silicon only.** 
 The AI Brain is a dedicated AMD GPU server (AMD AI Developer Program instance) running **vLLM on ROCm** with Qwen/Qwen2.5-72B-Instruct-AWQ.

2. **Serving stack is AMD-native.** 
 No OpenAI API key is used for production inference. The model is served from a local AMD GPU process and exposed via an OpenAI-compatible API.

3. **Tunnel provenance is verifiable.** 
 The tunnel is initiated from the AMD instance terminal itself (Cloudflare Quick Tunnel), so the public endpoint traces back to AMD hardware.

4. **Performance + cost are AMD-specific claims.** 
 Throughput, VRAM utilization, and latency figures are all gathered from an AMD GPU running ROCm.

## 📋 Deliverables

- [ ] **README.md** — includes the AMD Compute Layer section, tunnel pattern, and log placeholder.
- [ ] **Slide Deck (PDF)** — 10–12 slides, one dedicated "Why AMD?" slide with `rocm-smi` output.
- [ ] **Demo Video (YouTube unlisted)** — 3 minutes showing the tunnel, AMD terminal, and dashboard round-trip.
- [ ] **Live Demo URL** — dashboard with system status proving AI Brain connectivity.

## 🎬 Demo Video Must-Haves

1. AMD Jupyter terminal showing the vLLM launch command and `rocm-smi` output.
2. Cloudflare tunnel URL resolving to the AMD instance.
3. Backend log showing `AI endpoint OK | model=Qwen/Llama-3.1-8B-Instruct-AWQlatency=XXXms`.
4. Dashboard view with live logs + transaction result.

## 🚨 Disqualification Guardrails

- Ensure the Slide Deck or README contains **both words** "ROCm" and "AMD" in context of inference serving.
- Active Security Gatekeeper (Agent B) is documented separately from the inference engine in `docs/01-architecture.md`.
