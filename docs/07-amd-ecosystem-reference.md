# AMD Ecosystem Reference — Curated and scraped for A2Z Agentz

> **This document details a targeted scrape from June 2026 across the three core pillars of the AMD ecosystem required for the AMD Developer Hackathon: ACT II submission.**
>
> Each section covers: description, technical benefits, official links, command/setup snippets, and recommended adoption for A2Z Agentz.

---

## Table of Contents

1. [AMD Developer Cloud](#1-amd-developer-cloud)
2. [ROCm — Open-Source GPU Computing Platform](#2-rocm--open-source-gpu-computing-platform)
3. [AMD Training & Learning Resources](#3-amd-training--learning-resources)
4. [AMD AI Developer Program — Membership Benefits](#4-amd-ai-developer-program--membership-benefits)
5. [Hardware Reference — AMD Instinct MI300X](#5-hardware-reference--amd-instinct-mi300x)
6. [A2Z Agentz — Mapping to the AMD Stack](#6-a2z-agentz--mapping-to-the-amd-stack)
7. [Quick Reference — Key URLs](#7-quick-reference--key-urls)

---

## 1. AMD Developer Cloud

### Description

**AMD Developer Cloud** is a cloud-based GPU platform that gives AI researchers, engineers, and builders *on-demand* access to **AMD Instinct MI300X** hardware. It is designed for *high-memory* GPU workloads: training, fine-tuning, benchmarking, and inference — **without requiring you to manage physical hardware**.

| Aspect | Detail |
|---|---|
| **Provider** | AMD (powered by DigitalOcean) |
| **Hardware** | AMD Instinct MI300X (192GB HBM3) |
| **Pricing** | $100 credits for Developer Program members; pay-as-you-go available |
| **Access** | [AMD AI Developer Program](https://www.amd.com/en/developer/ai-dev-program.html) |
| **Documentation** | [AMD Developer Cloud Overview](https://www.amd.com/en/developer/resources/rocm-hub/amd-developer-cloud.html) |

### Highlights

- **$100 credits** for new AMD AI Developer Program members
- **MI300X @ $1.99/hour** — competitive vs. H100 ($3–6/hour on other clouds)
- **$100 ≈ 50 hours of GPU time** — enough for 4–6 weeks of hackathon build time
- **No waiting list, no enterprise contract** — spin up a Droplet immediately
- **OpenAI-compatible API** for inference (default vLLM image)

### Use Cases

1. **Fine-tuning LLMs** — Llama, DeepSeek, Mistral, Qwen via PyTorch + ROCm. HuggingFace Optimum-AMD provides optimized training pipelines.
2. **Large Model Inference** — 192GB HBM3 easily handles 70B+ models on a single GPU without model parallelism.
3. **Benchmarking & Prototyping** — test AMD workloads before moving on-prem.
4. **Hackathon Development** — credits for AMD-sponsored hackathons on lablab.ai.

### Step-by-Step Setup (from the Lablab tutorial)

**Step 1: Claim $100 Credits**
1. Register for the [AMD Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer) on Lablab.
2. You will be redirected to the AMD Developer Cloud account-creation page.
3. **Add a payment method** (required, though you will not be charged while usage stays under $100).
4. The $100 credit is applied automatically.

**Step 2: Spin Up a GPU Instance**
- Choose image: **vLLM Quick Start**
- Choose plan: MI300X
- Wait roughly 3 minutes for the Droplet to initialize
- Result: an **OpenAI-compatible API endpoint** running Llama/Qwen model

**Step 3: Call the API**

```python
from openai import OpenAI

client = OpenAI(
 base_url="http://YOUR_DROPLET_IP:8000/v1",
 api_key="not-required", # vLLM does not enforce auth by default
)

response = client.chat.completions.create(
 model="Qwen/Qwen2.5-1.5B-Instruct",
 messages=[{"role": "user", "content": "Hello from AMD!"}],
)

print(response.choices[0].message.content)
```

**Important note:** Credits expire **30 days** after account creation. Fireworks AI credits (optional) expire **90 days**.

### Recommendations for A2Z Agentz

- ✅ **Use AMD Developer Cloud as the host** for Agent A (Scout) + Agent B (Vault)
- ✅ **Use vLLM as the inference endpoint** to serve the vLLM-served LLM
- ✅ **Monitor credit usage** — $100 should cover 4 weeks; do not leave the Droplet idle unnecessarily
- ✅ **Stop the Droplet when not in use** (auto-suspend is available from the dashboard)

---

## 2. ROCm — Open-Source GPU Computing Platform

### Description

**ROCm** is AMD's *open-source GPU computing stack*, designed for AI, ML, HPC, and scientific computing. It is AMD's answer to NVIDIA CUDA, with a focus on portability and an *open ecosystem*.

| Aspect | Detail |
|---|---|
| **License** | Open-source (MIT-style for many components) |
| **GitHub** | [ROCm/ROCm](https://github.com/ROCm/rocm) (3,514 commits, 72 releases) |
| **Documentation** | [rocm.docs.amd.com](https://rocm.docs.amd.com/en/latest/) |
| **Blog** | [rocm.blogs.amd.com](https://rocm.blogs.amd.com/) |
| **Latest version** | ROCm 7.x (2025) — **3.5x more inference capability** vs ROCm 6 |

### Highlights

- **Powered by HIP** (Heterogeneous-Compute Interface for Portability) — C++ runtime API + kernel language for AMD GPUs
- **CUDA-like programming model** — porting CUDA workloads is relatively straightforward
- **Integrated with PyTorch & TensorFlow** — mainstream workflows require minimal changes
- **HuggingFace compatible** — vLLM, Transformers, and related libraries run natively
- **ROCm 7 (2025)** delivers **3.5x more inference** vs ROCm 6
- **Fully open-source** — no proprietary runtime lock-in

### Supported Hardware (Compatibility Matrix)

**GPU Architectures:**
- **CDNA/Instinct™** — CDNA4, CDNA3, CDNA2 (datacenter)
- **RDNA/Radeon™** — RDNA4, RDNA3, Radeon Pro (workstation)

**Operating Systems:**
- Ubuntu, RHEL, SLES, Oracle Linux, Debian, Rocky Linux

> For AMD Radeon GPUs or Ryzen APUs with displays connected -> see [ROCm on Radeon and Ryzen docs](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/index.html).

### Core Components

ROCm is organized into 7 component categories:

1. **Math libraries** (BLAS, FFT, RNG, etc.)
2. **ML and computer vision** (MIOpen, MIGraphX, etc.)
3. **Collective communication and primitives** (RCCL)
4. **System management tools** (rocm-smi, rocminfo)
5. **Profiling tools** (rocprof, omnitrace)
6. **Development tools** (HIP, HIPIFY, debugger)
7. **Runtimes and compilers** (HIP runtime, LLVM)

### PyTorch on ROCm — Setup

**Option 1: Prebuilt Docker Image (Recommended)**

```bash
# Latest public PyTorch Docker image (ROCm 7.2.4, PyTorch 2.9.1, Ubuntu 24.04)
docker pull rocm/pytorch:rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.9.1

# Validated image tags (as of 2026-05-29):
# - rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.9.1
# - rocm7.2.4_ubuntu22.04_py3.10_pytorch_release_2.9.1
# - rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.8.0
# - rocm7.2.4_ubuntu22.04_py3.10_pytorch_release_2.8.0
# - rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.7.1
# - rocm7.2.4_ubuntu22.04_py3.10_pytorch_release_2.7.1
```

**Option 2: Wheels Package**

Visit [pytorch.org/get-started/locally/](https://pytorch.org/get-started/locally/) -> select **Linux, Python, pip, ROCm** for the specific install command.

> Note: ROCm release availability differs between PyTorch **Stable** and **Nightly**. The newer release is usually available in Nightly first.

**Option 3: PyTorch Upstream Dockerfile**

For full customization, use the PyTorch upstream Dockerfile.

### Resources

- 📖 **Docs:** [rocm.docs.amd.com/en/latest](https://rocm.docs.amd.com/en/latest/)
- 📝 **Blogs:** [rocm.blogs.amd.com](https://rocm.blogs.amd.com/)
- 🎓 **AI Developer Hub:** [rocm.docs.amd.com/projects/ai-developer-hub](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/)
- 🤖 **ROCm for AI:** [rocm.docs.amd.com/en/latest/how-to/rocm-for-ai](https://rocm.docs.amd.com/en/latest/how-to/rocm-for-ai/index.html)
- 🛠️ **New build platform (TheRock):** [github.com/ROCm/TheRock](https://github.com/ROCm/TheRock) — unified CMake + Windows support

### Recommendations for A2Z Agentz

- ✅ **Base image** for Agent A container: `rocm/vllm:latest`
- ✅ **Do NOT install ROCm manually** on the host — use the Docker image
- ✅ **PyTorch image `rocm/pytorch:7.2.4_*`** for fine-tune jobs in AI Workbench
- ✅ **Monitor release notes** at [rocm.docs.amd.com/en/latest/release/versions.html](https://rocm.docs.amd.com/en/latest/release/versions.html)

---

## 3. AMD Training & Learning Resources

### Description

AMD offers a complete educational ecosystem for AI developers — from beginner to production-ready. Resources are **100% free** for AMD AI Developer Program members.

### A. AMD AI Academy

| Aspect | Detail |
|---|---|
| **URL** | [academy.amd.com](https://www.amd.com/en/developer/resources/training/amd-ai-academy.html) |
| **Access** | Free for AMD AI Developer Program members |
| **Format** | Self-paced courses + YouTube videos + ROCm tutorials |
| **Latest** | "Intro to Post-training" course |

**Four Learning Paths:**

| Path | Focus |
|---|---|
| **AI Foundations** | AI/ML/GenAI concepts + run models on AMD |
| **Build AI** | Apps, agents, and multimodal workflows with modern frameworks and open-source models |
| **Optimize & Deploy AI** | Production deployment, AMD GPUs, inference frameworks, K8s, GPU performance optimization |
| **Academic Developers** | Hands-on tutorials for teaching and research |

**Additional Resources:**
- 🎥 [AI Academy on YouTube](https://www.youtube.com/playlist?list=PLYw1WVX5aNHBKLP4_hTEhMet2Zq6HcxqS) — AMD Developer Central channel
- 📖 [Tutorials for AI Developers](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/) — ROCm tutorials for inference, fine-tuning, training, and GPU optimization

### B. DeepLearning.AI Pro — 1 Month Free

Exclusive AMD AI Developer Program benefit: **free 1-month DeepLearning.AI Pro membership**.

| Aspect | Detail |
|---|---|
| **Content** | Short courses, specializations, certificates |
| **Relevant for A2Z** | "A2A: The Agent2Agent Protocol", "Agent Memory: Building Memory-Aware Agents", "Efficient Inference with vLLM", "Multimodal Llama 3.2", "Practical Multi-AI Agents with CrewAI" |
| **How to claim** | Create an account at deeplearning.ai and enter the promo code from the AMD AI Developer Program member site |
| **Course URLs** | [deeplearning.ai/courses](https://www.deeplearning.ai/courses) |

### C. "From Zero to AI Builder with AMD" — Featured Article

| Aspect | Detail |
|---|---|
| **URL** | [lablab.ai/ai-articles/from-zero-to-ai-builder-amd-developer-program](https://lablab.ai/ai-articles/from-zero-to-ai-builder-amd-developer-program) |
| **Author** | Lablab.ai editorial |
| **Highlight** | End-to-end walkthrough: register -> Droplet -> running LLM endpoint in under 1 hour |

**Key Insights from the Article:**
- **Cost comparison:** MI300X on AMD Developer Cloud **$1.99/hour** vs H100 on major clouds at **$3–6/hour**
- **MI300X often needs half the GPU count** of H100 (192GB vs 80GB VRAM)
- Microsoft Azure's EVP quote: *"The most cost-effective GPU out there right now for Azure OpenAI."*

**Recommended A2Z Agentz course path (learning order):**
1. AI Foundations -> run your first model on AMD
2. Fine-tuning course -> use Unsloth + GRPO workflow
3. vLLM short course on DeepLearning.AI
4. AMD AI Workbench tutorial (fine-tune GUI)
5. LangGraph / multi-agent course

### D. lablab.ai AI Hackathons

AMD-sponsored hackathons (including the current ACT II) provide:
- $100 AMD Cloud credits
- MI300X access
- AMD AI Academy
- 1 month of DeepLearning.AI Pro
- Private Discord with AMD engineers
- Monthly office hours

**Recommendations for A2Z Agentz:**
- ✅ **Join today** — activate the $100 credits immediately
- ✅ **Claim DeepLearning.AI Pro** before the longer sprint begins
- ✅ **Join the AMD Discord** to ask AMD experts directly
- ✅ **Add a payment method** for your Droplet (required, but safe while usage stays under $100)

---

## 4. AMD AI Developer Program — Membership Benefits

### Overview

The **AMD AI Developer Program** is a **free** program for building, optimizing, and scaling AI on AMD hardware. Join once and unlock all the benefits below.

| Aspect | Detail |
|---|---|
| **Cost** | **FREE** |
| **Sign up** | [amd.com/en/developer/ai-dev-program.html](https://www.amd.com/en/developer/ai-dev-program.html) |
| **Portal** | [developer.amd.com](https://developer.amd.com) |
| **Sweepstakes** | US/Canada only — monthly Radeon GPU / Ryzen AI PC |

### Members vs Non-Members

| Benefit | Members | Non-Members |
|---|---|---|
| Complimentary Cloud Credits | ✅ ($100) | ❌ |
| AMD AI Academy Courses | ✅ | ❌ |
| 1 Month DeepLearning.AI Pro | ✅ | ❌ |
| Technical Blog Authoring | ✅ | Read Only |
| "Ask the Experts" Office Hours | ✅ | ✅ |
| Developer Videos & Webinars | ✅ | ✅ |
| Newsletter | Personalized | Opt-in only |
| Forum Access | Private | General |
| Developer Events Registration | Early access | General |
| Recognition at AMD Events | ✅ | ❌ |
| Project Showcase on AMD Social | ✅ | ❌ |

### Cloud Credit Details (Important!)

**AMD Developer Cloud ($100):**
- Expire **30 days** from account creation / login via the redemption link
- You must add a payment method (you will not be charged while usage stays under $100)
- Activation happens from the member perks page inside the AMD AI Developer Program portal

**Fireworks AI ($50, optional):**
- Expire **90 days** from issuance
- Redeem via promo code
- Fireworks is a third-party platform (AMD does not guarantee its availability)

### How to Join (5 Steps)

1. **Create** a free AMD account + complete the AI Developer Program form
2. **Verify** your email (activation code)
3. **Access** the AMD AI Developer Program Portal
4. **Join** the member Discord (link sent via email)
5. **Activate** cloud credit from the member perks page

### Recommendations for A2Z Agentz

- ✅ **Join today** — activate the $100 credits immediately
- ✅ **Claim DeepLearning.AI Pro** before the longer sprint begins
- ✅ **Add a payment method** for your Droplet (required, but safe while usage stays under $100)
- ✅ **Record the credits expiry date** on your calendar — 30 days from today

---

## 5. Hardware Reference — AMD Instinct MI300X

### Spec Sheet

| Aspect | Detail |
|---|---|
| **GPU** | AMD Instinct™ MI300X |
| **Memory** | **192 GB HBM3** (single GPU) |
| **Memory Bandwidth** | **5.3 TB/s** |
| **Cloud price** | $1.99/hour (AMD Developer Cloud) |
| **Competitor price** | NVIDIA H100: $3–6/hour |
| **Production user** | Meta (Llama 405B production inference) |

### Why 192GB Matters

- **Run 70B+ models** as a "brain" without quantization latency penalties
- **Run vision / multimodal** workloads at full precision / resolution
- **Long-context agents** (research assistants, coding agents) — plenty of memory headroom

### Use Cases for A2Z Agentz

- **vLLM-served LLM inference** (8B -> 70B+ model) — a single GPU is sufficient
- **Vector search** (ChromaDB embeddings) — bandwidth up to 5.3 TB/s
- **Concurrent inference** — can serve 50+ parallel requests per cron tick

---

## 6. A2Z Agentz — Mapping to the AMD Stack

### End-to-End Pipeline

```
[Web3 sentiment dataset]
 |
[AMD AI Workbench GUI] -> Fine-tune Qwen/Qwen2.5-72B-Instruct-AWQ -> vLLM-served Web3 scorer
 |
[vLLM-served weights (.safetensors)]
 |
[AMD Inference Microservice (AIM) — wrap as container]
 |
[vLLM server — load model on ROCm backend]
 |
[AMD Instinct MI300X on AMD Developer Cloud]
 |
[Agent A calls vLLM via OpenAI-compatible API]
 |
[Hybrid Scoring: 70% sentiment + 30% on-chain TVL]
 |
[JSON payload -> Agent B -> Base network on-chain]
```

### Component Mapping

| A2Z Component | AMD Stack | Resource |
|---|---|---|
| Host VM | AMD Developer Cloud Droplet | $100 credits |
| GPU | MI300X (192GB HBM3) | $1.99/hour |
| Runtime | ROCm 7.x | Docker `rocm/vllm` |
| Training | AMD AI Workbench | [academy.amd.com](https://academy.amd.com) |
| Deployment | AMD Inference Microservice (AIM) | [AIM blog](https://rocm.blogs.amd.com/) |
| Serving | vLLM | [vLLM on AMD](https://rocm.blogs.amd.com/software-tools-optimization/disaggregation/README.html) |
| Base model | Qwen/Qwen2.5-72B-Instruct-AWQ | HuggingFace |
| Fine-tune dataset | Custom Web3 sentiment | Internal |

### 4-Week Hackathon Cost Estimate

| Item | Hours | Cost |
|---|---|---|
| One-time fine-tune | 5 hours | ~$10 |
| vLLM serving (always-on) | 24x7 x 28 days = 672 hours | ~$1,338 |
| Buffer + iterations | — | $50–100 |
| **Total** | — | **~$1,400–1,500** |

⚠️ **Cost alert:** $100 credits are enough for fine-tuning + light serving. For 24/7 serving across 4 weeks, you will need roughly $1,300 in additional pay-as-you-go credits. **Alternatively**, auto-suspend the Droplet during idle windows to save.

**Cost-saving recommendations:**
- ✅ **Only run vLLM serving when Agent A's cron tick fires** (1x/hour x 5 minutes = ~80 minutes/day)
- ✅ 80 minutes/day x $1.99/hour x 28 days = **~$75** — fits inside the $100 credits
- ✅ **Run Agent B (non-LLM) on a smaller instance** (no MI300X needed) — shared CPU or AMD Radeon is fine

---

## 7. Quick Reference — Key URLs

### AMD Official
- [AMD AI Developer Program](https://www.amd.com/en/developer/ai-dev-program.html)
- [AMD Developer Cloud Overview](https://www.amd.com/en/developer/resources/rocm-hub/amd-developer-cloud.html)
- [AMD AI Academy](https://www.amd.com/en/developer/resources/training/amd-ai-academy.html)
- [Introducing AMD AI Developer Program](https://www.amd.com/en/developer/resources/technical-articles/2025/amd-ai-developer-program.html)
- [Build Across the AI Stack — Hackathon Article](https://www.amd.com/en/developer/resources/technical-articles/2026/build-across-the-ai-stack--join-the-amd-x-lablab-ai-hackathon-.html)
- [AMD Developer Portal](https://developer.amd.com)

### ROCm
- [ROCm Documentation](https://rocm.docs.amd.com/en/latest/)
- [ROCm Installation (Linux)](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/quick-start.html)
- [PyTorch on ROCm](https://rocm.docs.amd.com/projects/install-on-linux/en/latest/install/3rd-party/pytorch-install.html)
- [AI Developer Hub](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/)
- [ROCm for AI Guide](https://rocm.docs.amd.com/en/latest/how-to/rocm-for-ai/index.html)
- [ROCm GitHub](https://github.com/ROCm/rocm)
- [TheRock — New Build Platform](https://github.com/ROCm/TheRock)
- [ROCm Blogs](https://rocm.blogs.amd.com/)
- [PyTorch Docker Hub](https://hub.docker.com/r/rocm/pytorch)
- [vLLM on MI300X Blog](https://rocm.blogs.amd.com/software-tools-optimization/disaggregation/README.html)
- [Adapting vLLM-served models Fine-Tuning](https://rocm.blogs.amd.com/software-tools-optimization/aiwb-fine-tuning/README.html)

### Learning
- [DeepLearning.AI Courses](https://www.deeplearning.ai/courses)
- [AMD Developer Central YouTube](https://www.youtube.com/playlist?list=PLYw1WVX5aNHBKLP4_hTEhMet2Zq6HcxqS)

### Lablab & Hackathon
- [AMD Developer Hackathon ACT II](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii)
- [AMD Developer Hackathon ACT I Recap](https://lablab.ai/ai-hackathons/amd-developer)
- [AMD Developer Cloud on Lablab](https://lablab.ai/tech/amd/amd-developer-cloud)
- [From Zero to AI Builder Article](https://lablab.ai/ai-articles/from-zero-to-ai-builder-amd-developer-program)
- [Submission Guidelines](https://lablab.ai/delivering-your-hackathon-solution)

### Community
- [AMD Developer Discord](https://discord.gg/amd-developer-program) (link sent via member email)
- [AMD Developer Forums](https://community.amd.com)
- [AMD Developer LinkedIn](https://www.linkedin.com/showcase/amd-developer/)
- [AMD AI Developer Program Email](mailto:ai_dev_program@amd.com) (for project submission / social highlight)

---

*This document was scraped in June 2026 from official AMD & lablab.ai sources. Always check for updates from the reference URLs because the AMD ecosystem evolves quickly (ROCm 7.x -> 8.x, vLLM updates, etc.).*
