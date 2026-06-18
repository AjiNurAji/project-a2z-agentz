# AMD Ecosystem Reference — Scraped & Curated untuk A2Z Agentz

> **Dokumen ini adalah hasil scraping detail (Juni 2026) dari 3 pilar utama ekosistem AMD yang wajib dipahami untuk submission AMD Developer Hackathon: ACT II.**
>
> Setiap section mencakup: deskripsi, benefit teknis, link resmi, snippet perintah/setup, dan rekomendasi penerapan untuk A2Z Agentz.

---

## Daftar Isi

1. [AMD Developer Cloud](#1-amd-developer-cloud)
2. [ROCm — Open-Source GPU Computing Platform](#2-rocm--open-source-gpu-computing-platform)
3. [AMD Training & Learning Resources](#3-amd-training--learning-resources)
4. [AMD AI Developer Program — Membership Benefits](#4-amd-ai-developer-program--membership-benefits)
5. [Hardware Reference — AMD Instinct MI300X](#5-hardware-reference--amd-instinct-mi300x)
6. [A2Z Agentz — Pemetaan ke AMD Stack](#6-a2z-agentz--pemetaan-ke-amd-stack)
7. [Quick Reference — URL Penting](#7-quick-reference--url-penting)

---

## 1. AMD Developer Cloud

### Deskripsi

**AMD Developer Cloud** adalah platform GPU *cloud-based* yang memberikan akses *on-demand* ke **AMD Instinct MI300X** untuk AI researcher, engineer, dan builder. Didesain untuk komputasi GPU *high-memory* untuk training, fine-tuning, benchmarking, dan inference — **tanpa harus manage hardware fisik sendiri**.

| Aspek | Detail |
|---|---|
| **Provider** | AMD (powered by DigitalOcean) |
| **Hardware** | AMD Instinct MI300X (192GB HBM3) |
| **Pricing** | $100 credits untuk Developer Program members; pay-as-you-go available |
| **Akses** | [AMD AI Developer Program](https://www.amd.com/en/developer/ai-dev-program.html) |
| **Dokumentasi** | [AMD Developer Cloud Overview](https://www.amd.com/en/developer/resources/rocm-hub/amd-developer-cloud.html) |

### Highlights

- **$100 credits** untuk member baru AMD AI Developer Program
- **MI300X @ $1.99/jam** — kompetitif vs H100 ($3-6/jam di cloud lain)
- **$100 ≈ 50 jam GPU time** — cukup untuk 4-6 minggu hackathon build
- **No waiting list, no enterprise contract** — langsung spin up Droplet
- **OpenAI-compatible API** untuk inference (default vLLM image)

### Use Cases

1. **Fine-tuning LLMs** — Llama, DeepSeek, Mistral, Qwen via PyTorch + ROCm. HuggingFace Optimum-AMD untuk training pipeline yang dioptimasi.
2. **Large Model Inference** — 192GB HBM3 cukup untuk model 70B+ di single GPU tanpa model parallelism.
3. **Benchmarking & Prototyping** — Test workload AMD sebelum on-prem.
4. **Hackathon Development** — Credits untuk AMD-sponsored hackathon di lablab.ai.

### Setup Step-by-Step (dari Lablab tutorial)

**Step 1: Claim $100 Credits**
1. Register untuk [AMD Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer) di Lablab
2. Redirect ke halaman pembuatan akun AMD Developer Cloud
3. **Tambah payment method** (wajib, meski pakai credits — tidak dicharge selama tidak exceed)
4. $100 credit applied otomatis

**Step 2: Spin Up GPU Instance**
- Pilih image: **vLLM Quick Start**
- Pilih plan: MI300X
- Tunggu ~3 menit untuk inisialisasi Droplet
- Hasilnya: **OpenAI-compatible API endpoint** running Llama/Qwen model

**Step 3: Hit The API**

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://YOUR_DROPLET_IP:8000/v1",
    api_key="not-required",  # vLLM doesn't enforce auth by default
)

response = client.chat.completions.create(
    model="Qwen/Qwen2.5-1.5B-Instruct",
    messages=[{"role": "user", "content": "Hello from AMD!"}],
)

print(response.choices[0].message.content)
```

**Catatan penting:** Credits expire **30 hari** dari pembuatan akun. Fireworks AI credits (opsional) expire **90 hari**.

### Rekomendasi untuk A2Z Agentz

- ✅ **Gunakan AMD Developer Cloud sebagai host** Agent A (Scout) + Agent B (Vault)
- ✅ **Quickstart image `vLLM` → swap ke SGLang** untuk serve AIM-tuned LLM
- ✅ **Monitor credit usage** — $100 harus cukup untuk 4 minggu, jangan biarkan Droplet idle
- ✅ **Stop Droplet saat tidak dipakai** (auto-suspend via dashboard)

---

## 2. ROCm — Open-Source GPU Computing Platform

### Deskripsi

**ROCm** adalah *open-source GPU computing stack* dari AMD — dirancang untuk AI, ML, HPC, dan scientific computing. **Answer AMD untuk NVIDIA CUDA**, dengan fokus pada portability dan *open ecosystem*.

| Aspek | Detail |
|---|---|
| **Lisensi** | Open-source (MIT-style untuk banyak komponen) |
| **GitHub** | [ROCm/ROCm](https://github.com/ROCm/rocm) (3,514 commits, 72 releases) |
| **Dokumentasi** | [rocm.docs.amd.com](https://rocm.docs.amd.com/en/latest/) |
| **Blog** | [rocm.blogs.amd.com](https://rocm.blogs.amd.com/) |
| **Versi terbaru** | ROCm 7.x (2025) — **3.5x more inference capability** vs ROCm 6 |

### Highlights

- **Powered by HIP** (Heterogeneous-Compute Interface for Portability) — C++ runtime API + kernel language untuk AMD GPUs
- **CUDA-like programming model** — porting CUDA workloads relatif mudah
- **Integrated with PyTorch & TensorFlow** — workflow mainstream port dengan minimal changes
- **HuggingFace compatible** — vLLM, Transformers, dll. jalan native
- **ROCm 7 (2025)** delivers **3.5x more inference** vs ROCm 6
- **Fully open-source** — tidak terikat proprietary runtime

### Supported Hardware (Compatibility Matrix)

**GPU Architectures:**
- **CDNA/Instinct™** — CDNA4, CDNA3, CDNA2 (datacenter)
- **RDNA/Radeon™** — RDNA4, RDNA3, Radeon Pro (workstation)

**Operating Systems:**
- Ubuntu, RHEL, SLES, Oracle Linux, Debian, Rocky Linux

> Untuk AMD Radeon GPUs atau Ryzen APUs dengan display connected → lihat [ROCm on Radeon and Ryzen docs](https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/index.html).

### Core Components

ROCm disusun dalam 7 kategori komponen:

1. **Math libraries** (BLAS, FFT, RNG, dll.)
2. **ML and computer vision** (MIOpen, MIGraphX, dll.)
3. **Collective communication and primitives** (RCCL)
4. **System management tools** (rocm-smi, rocminfo)
5. **Profiling tools** (rocprof, omnitrace)
6. **Development tools** (HIP, HIPIFY, debugger)
7. **Runtimes and compilers** (HIP runtime, LLVM)

### PyTorch on ROCm — Setup

**Opsi 1: Prebuilt Docker Image (Recommended)**

```bash
# Latest public PyTorch Docker image (ROCm 7.2.4, PyTorch 2.9.1, Ubuntu 24.04)
docker pull rocm/pytorch:rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.9.1

# Validated image tags (per 2026-05-29):
# - rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.9.1
# - rocm7.2.4_ubuntu22.04_py3.10_pytorch_release_2.9.1
# - rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.8.0
# - rocm7.2.4_ubuntu22.04_py3.10_pytorch_release_2.8.0
# - rocm7.2.4_ubuntu24.04_py3.12_pytorch_release_2.7.1
# - rocm7.2.4_ubuntu22.04_py3.10_pytorch_release_2.7.1
```

**Opsi 2: Wheels Package**

Kunjungi [pytorch.org/get-started/locally/](https://pytorch.org/get-started/locally/) → pilih **Linux, Python, pip, ROCm** untuk dapat command install spesifik.

> Catatan: ROCm release availability berbeda antara PyTorch **Stable** vs **Nightly**. Yang lebih baru biasanya di Nightly.

**Opsi 3: PyTorch Upstream Dockerfile**

Untuk kustomisasi penuh, pakai PyTorch upstream Dockerfile.

### Resources

- 📖 **Docs:** [rocm.docs.amd.com/en/latest](https://rocm.docs.amd.com/en/latest/)
- 📝 **Blogs:** [rocm.blogs.amd.com](https://rocm.blogs.amd.com/)
- 🎓 **AI Developer Hub:** [rocm.docs.amd.com/projects/ai-developer-hub](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/)
- 🤖 **ROCm for AI:** [rocm.docs.amd.com/how-to/rocm-for-ai](https://rocm.docs.amd.com/en/latest/how-to/rocm-for-ai/index.html)
- 🛠️ **New build platform (TheRock):** [github.com/ROCm/TheRock](https://github.com/ROCm/TheRock) — unified CMake + Windows support

### Rekomendasi untuk A2Z Agentz

- ✅ **Base image** untuk Agent A container: `rocm/sglang:latest`
- ✅ **JANGAN install ROCm manual** di host — pakai Docker image
- ✅ **PyTorch image `rocm/pytorch:7.2.4_*`** untuk fine-tune job di AI Workbench
- ✅ **Monitor release notes** di [rocm.docs.amd.com/en/latest/release/versions.html](https://rocm.docs.amd.com/en/latest/release/versions.html)

---

## 3. AMD Training & Learning Resources

### Deskripsi

AMD menyediakan ekosistem edukasi lengkap untuk AI developers — dari beginner sampai production-ready. Resources-nya **100% free** untuk AMD AI Developer Program members.

### A. AMD AI Academy

| Aspek | Detail |
|---|---|
| **URL** | [academy.amd.com](https://www.amd.com/en/developer/resources/training/amd-ai-academy.html) |
| **Akses** | Gratis untuk AMD AI Developer Program members |
| **Format** | Self-paced courses + YouTube videos + ROCm tutorials |
| **Terbaru** | "Intro to Post-training" course |

**Empat Learning Path:**

| Path | Fokus |
|---|---|
| **AI Foundations** | Konsep AI/ML/GenAI + run models on AMD |
| **Build AI** | Apps, agents, multimodal workflows pakai framework modern + open-source models |
| **Optimize & Deploy AI** | Production deployment, AMD GPUs, inference frameworks, K8s, GPU perf optimization |
| **Academic Developers** | Hands-on tutorials untuk teaching & research |

**Resource Tambahan:**
- 🎥 [AI Academy on YouTube](https://www.youtube.com/playlist?list=PLYw1WVX5aNHBKLP4_hTEhMet2Zq6HcxqS) — AMD Developer Central channel
- 📖 [Tutorials for AI Developers](https://rocm.docs.amd.com/projects/ai-developer-hub/en/latest/) — ROCm tutorials untuk inference, fine-tuning, training, GPU optimization

### B. DeepLearning.AI Pro — 1 Month Free

Benefit eksklusif AMD AI Developer Program: **1 bulan gratis DeepLearning.AI Pro membership**.

| Aspek | Detail |
|---|---|
| **Konten** | Short courses, specializations, certificates |
| **Relevan untuk A2Z** | "A2A: The Agent2Agent Protocol", "Agent Memory: Building Memory-Aware Agents", "Efficient Inference with SGLang", "Multimodal Llama 3.2", "Practical Multi-AI Agents with CrewAI" |
| **Cara klaim** | Buat akun di deeplearning.ai, masukkan promo code dari AMD AI Developer Program member site |
| **URL courses** | [deeplearning.ai/courses](https://www.deeplearning.ai/courses) |

### C. "From Zero to AI Builder with AMD" — Featured Article

| Aspek | Detail |
|---|---|
| **URL** | [lablab.ai/ai-articles/from-zero-to-ai-builder-amd-developer-program](https://lablab.ai/ai-articles/from-zero-to-ai-builder-amd-developer-program) |
| **Author** | Lablab.ai editorial |
| **Highlight** | Walkthrough end-to-end: dari register → Droplet → running LLM endpoint dalam < 1 jam |

**Key Insight dari Artikel:**
- **Cost comparison**: MI300X on AMD Developer Cloud **$1.99/jam** vs H100 di major cloud **$3-6/jam**
- **MI300X sering butuh 1/2 jumlah GPU** dari H100 (192GB vs 80GB VRAM)
- Microsoft Azure's EVP: *"The most cost-effective GPU out there right now for Azure OpenAI."*

**Rekomendasi Course Path untuk A2Z Agentz (urutan belajar):**
1. AI Foundations → run first model on AMD
2. Fine-tuning course → pakai Unsloth + GRPO workflow
3. SGLang short course di DeepLearning.AI
4. AMD AI Workbench tutorial (fine-tune GUI)
5. LangGraph / multi-agent course

### D. Lablab.ai AI Hackathons

AMD-sponsored hackathons (termasuk ACT II saat ini) provide:
- $100 AMD Cloud credits
- Akses MI300X
- AMD AI Academy
- 1 bulan DeepLearning.AI Pro
- Private Discord dengan AMD engineers
- Office hours bulanan

**Rekomendasi untuk A2Z Agentz:**
- ✅ **Klaim DeepLearning.AI Pro** via AMD AI Developer Program (1 bulan free) — habiskan untuk course SGLang, A2A Protocol, Agent Memory
- ✅ **Selesaikan course fine-tuning Unsloth di AMD AI Academy** sebelum mulai custom training
- ✅ **Join AMD Discord** untuk tanya ke AMD experts langsung

---

## 4. AMD AI Developer Program — Membership Benefits

### Overview

**AMD AI Developer Program** adalah program **free** untuk build, optimize, dan scale AI di AMD hardware. Join sekali, dapat semua benefit di bawah ini.

| Aspek | Detail |
|---|---|
| **Harga** | **GRATIS** |
| **Sign up** | [amd.com/en/developer/ai-dev-program.html](https://www.amd.com/en/developer/ai-dev-program.html) |
| **Portal** | [developer.amd.com](https://developer.amd.com) |
| **Sweepstakes** | US/Canada only — Radeon GPU / Ryzen AI PC monthly |

### Member vs Non-Member

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

### Cloud Credit Details (Penting!)

**AMD Developer Cloud ($100):**
- Expire **30 hari** dari account creation/login via redemption link
- Wajib add payment method (tidak dicharge selama di bawah $100 usage)
- Aktivasi via member perks page di AMD AI Developer Program portal

**Fireworks AI ($50, opsional):**
- Expire **90 hari** dari issuance
- Redeem via promo code
- Fireworks = third-party platform (AMD tidak tanggung availability)

### Cara Join (5 Langkah)

1. **Create** free AMD account + complete AI Developer Program form
2. **Verify** email (activation code)
3. **Access** AMD AI Developer Program Portal
4. **Join** member Discord (link via email)
5. **Activate** cloud credit via member perks page

### Rekomendasi untuk A2Z Agentz

- ✅ **JOIN HARI INI** — agar $100 credits langsung aktif
- ✅ **Klaim DeepLearning.AI Pro** sebelum sprint panjang
- ✅ **Add payment method** untuk Droplet (wajib, tapi aman selama usage < $100)
- ✅ **Catat tanggal expiry** credits di kalender — 30 hari dari sekarang

---

## 5. Hardware Reference — AMD Instinct MI300X

### Spec Sheet

| Aspek | Detail |
|---|---|
| **GPU** | AMD Instinct™ MI300X |
| **Memory** | **192 GB HBM3** (single GPU) |
| **Memory Bandwidth** | **5.3 TB/s** |
| **Harga cloud** | $1.99/jam (AMD Developer Cloud) |
| **Harga kompetitor** | NVIDIA H100: $3-6/jam |
| **Production user** | Meta (Llama 405B production inference) |

### Mengapa 192GB Matters

- **Run 70B+ models** sebagai "brain" tanpa latency penalty dari quantization
- **Run vision/multimodal** pada full precision/resolution
- **Long-context agents** (research assistants, coding agents) — memory headroom cukup

### Use Case untuk A2Z Agentz

- **AIM-tuned LLM inference** (8B → 70B+ model) — single GPU cukup
- **Vector search** (ChromaDB embeddings) — bandwidth 5.3 TB/s
- **Concurrent inference** — bisa serve 50+ request paralel per cron tick

---

## 6. A2Z Agentz — Pemetaan ke AMD Stack

### End-to-End Pipeline

```
[Dataset Web3 sentiment]
        ↓
[AMD AI Workbench GUI] → Fine-tune Llama 3 8B
        ↓
[AIM-tuned weights (.safetensors)]
        ↓
[AMD Inference Microservice (AIM) — wrap as container]
        ↓
[SGLang server — load AIM di ROCm backend]
        ↓
[AMD Instinct MI300X di AMD Developer Cloud]
        ↓
[Agent A panggil AIM via OpenAI-compatible API]
        ↓
[Hybrid Scoring: 70% sentiment + 30% on-chain TVL]
        ↓
[JSON payload → Agent B → Base network on-chain]
```

### Pemetaan Komponen

| A2Z Component | AMD Stack | Resource |
|---|---|---|
| Host VM | AMD Developer Cloud Droplet | $100 credits |
| GPU | MI300X (192GB HBM3) | $1.99/jam |
| Runtime | ROCm 7.x | Docker `rocm/sglang` |
| Training | AMD AI Workbench | [academy.amd.com](https://academy.amd.com) |
| Deployment | AMD Inference Microservice (AIM) | [AIM blog](https://rocm.blogs.amd.com/) |
| Serving | SGLang | [SGLang on AMD](https://rocm.blogs.amd.com/software-tools-optimization/disaggregation/README.html) |
| Base model | Llama 3 8B Instruct | HuggingFace |
| Fine-tune dataset | Custom Web3 sentiment | Internal |

### Total Cost Estimate (4 minggu hackathon)

| Item | Hours | Cost |
|---|---|---|
| Fine-tune (one-time) | 5 hours | ~$10 |
| SGLang serving (always-on) | 24×7 × 28 days = 672 hours | ~$1,338 |
| Buffer + iterations | - | $50-100 |
| **Total** | - | **~$1,400-1,500** |

⚠️ **Cost Alert:** $100 credits CUKUP untuk fine-tune + serving ringan. Untuk serving 24/7 selama 4 minggu, perlu pay-as-you-go tambahan ~$1,300. **Atau** auto-suspend Droplet saat idle untuk hemat.

**Rekomendasi hemat:**
- ✅ **SGLang serving hanya saat Agent A cron tick** (1×/jam × 5 menit = 80 menit/hari)
- ✅ 80 menit/hari × $1.99/jam × 28 hari = **~$75** — MASUK di $100 credits!
- ✅ **Agent B (non-LLM) di instance kecil** (bukan MI300X) — bisa pakai shared CPU atau AMD Radeon

---

## 7. Quick Reference — URL Penting

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
- [SGLang on MI300X Blog](https://rocm.blogs.amd.com/software-tools-optimization/disaggregation/README.html)
- [Adapting AIM LLMs Fine-Tuning](https://rocm.blogs.amd.com/software-tools-optimization/aiwb-fine-tuning/README.html)

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
- [AMD Developer Discord](https://discord.gg/amd-developer-program) (link di member email)
- [AMD Developer Forums](https://community.amd.com)
- [AMD Developer LinkedIn](https://www.linkedin.com/showcase/amd-developer/)
- [AMD AI Developer Program Email](mailto:ai_dev_program@amd.com) (untuk project submission/social highlight)

---

*Dokumen ini di-scrape Juni 2026 dari sumber resmi AMD & lablab.ai. Selalu cek update dari URL referensi karena AMD ecosystem berkembang cepat (ROCm 7.x → 8.x, AIM updates, dll.).*
