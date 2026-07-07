# 06. AMD Stack Alignment (untuk Penilai Hackathon)

Dokumen ini menjelaskan **mengapa A2Z Agentz adalah submission yang 100%契合 (cocok) dengan tema & tooling wajib AMD Developer Hackathon: ACT II**, dan bagaimana setiap komponen proyek dipetakan ke ekosistem AMD.

## Ringkasan Posisi

A2Z Agentz bukan sekadar "pakai GPU AMD" — kami mengadopsi **end-to-end AMD-native pipeline** dari training hingga deployment:

```
[Data Web3] → [AMD AI Workbench: fine-tune] → [AIM: container]
                                                       ↓
[Dashboard] ← [SGLang inference MI300X] ← [AIM-tuned LLM]
        ↓
[Agent B: on-chain Base] ← [AIM-tuned output]
```

## Pemetaan ke Tema ACT II

| Tema / Persyaratan | Implementasi A2Z |
|---|---|
| **"Build AI agents on AMD GPUs in the cloud"** | ✅ Agent A (Scout) berjalan 100% di AMD Instinct MI300X via AMD Developer Cloud. |
|| **AMD AI Workbench** | ✅ Digunakan untuk fine-tune base LLM → AIM-tuned Qwen 2.5 72B khusus Web3 sentiment. GUI no-code, no custom training loop. |
| **AMD Inference Microservice (AIM)** | ✅ Hasil fine-tune di-wrap sebagai AIM, di-serve via SGLang OpenAI-compatible endpoint. |
| **SGLang di ROCm** | ✅ Serving engine untuk AIM, rekomendasi AMD untuk high-throughput inference. |
| **Akash Systems (co-sponsor)** | 🟡 Opsional: Agent A inference bisa di-bid ke Akash decentralized compute via X402 payment (post-hackathon). |
| **$100 AMD Cloud Credits** | ✅ Digunakan untuk: 1) training job AI Workbench (~30 credits), 2) hosting SGLang server 4 minggu (~50 credits), 3) buffer. |

## Mengapa Pendekatan Ini Kuat untuk ACT II

### 1. Showcase end-to-end AMD stack
Submission lain biasanya pakai OpenAI API atau HuggingFace Inference. A2Z melatih & men-deploy model **sendiri** di infrastruktur AMD — dari Workbench (training) → AIM (packaging) → SGLang (serving). Ini menunjukkan penguasaan penuh toolchain AMD.

### 2. Fine-tuning sebagai pembeda utama
Mayoritas submission ACT II akan pakai model *out-of-the-box* tanpa fine-tuning. A2Z **fine-tune base LLM to AIM-tuned Qwen 2.5 72B untuk Web3 sentiment** via AMD AI Workbench. Ini:
- Menggunakan tooling AMD yang belum banyak dieksplorasi peserta lain.
- Meningkatkan akurasi inference untuk domain spesifik (Web3/DeFi).
- Mudah direproduksi juri: dataset, hyperparameter, dan workflow training semua di Workbench GUI.

### 3. Production-grade safety layer
A2Z tidak hanya demo happy path. Ada:
- KMS key management (bukan hardcoded private key)
- ECDSA signature verification antar-agen
- PostgreSQL idempotency check
- Circuit Breaker + Manual Approval
- Foundry Anvil dry-run untuk honeypot detection

Ini menjawab juri yang concern tentang agent yang "bermain" dengan uang sungguhan.

### 4. Real on-chain execution
Bukan simulasi. Agent B execute transaksi **real on Base mainnet** (dengan hard-cap $1-2 untuk keamanan selama hackathon). Juri bisa verify Tx Hash di Basescan.

## Demo Flow untuk Juri (Saran Urutan Pitch)

1. **Show AMD Developer Cloud console** — workspace running di MI300X.
2. **Buka AMD AI Workbench** — tunjukkan fine-tune job history + hasil AIM model.
3. **Buka SGLang endpoint** — `curl /v1/models` → tunjukkan AIM-tuned LLM loaded.
4. **Trigger Agent A manual run** — panggil AIM dengan sample Farcaster post → dapat sentiment + reason.
5. **Hybrid Scoring** — kombinasikan dengan TVL check on-chain → score > 85.
6. **Agent B signing + execute** — tunjukkan signature payload → tx hash di Base.
7. **Buka Dashboard** — live log semua step di atas, Tx Hash link ke Basescan.
8. **Trigger Circuit Breaker** — tunjukkan pause global kill switch.

## Referensi Eksternal

- AMD Blog: [Adapting AIM LLMs For Specific Use Cases Through Fine-Tuning in AMD AI Workbench](https://rocm.blogs.amd.com/software-tools-optimization/aiwb-fine-tuning/README.html)
- AMD Blog: [Unleashing AMD Instinct MI300X GPUs for LLM Serving with SGLang](https://rocm.blogs.amd.com/software-tools-optimization/disaggregation/README.html)
- AMD Docs: [SGLang distributed inference with MoRI](https://rocm.docs.amd.com/en/latest/how-to/rocm-for-ai/inference/benchmark-docker/sglang-mori-distributed.html)
- AMD Hackathon ACT II: [lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii](https://lablab.ai/ai-hackathons/amd-developer-hackathon-act-ii)
