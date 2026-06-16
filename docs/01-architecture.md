# 01. Arsitektur Sistem Terintegrasi

Dokumen ini menjelaskan arsitektur *high-level* dari sistem **A2Z Agent** (Autonomous Airdrop / Web3 Scavenger Agent).

## Diagram Arsitektur (End-to-End)

```mermaid
graph TD
    subgraph Data Sources
        F[Farcaster / Neynar API]
        T[Twitter / X]
        O[On-Chain Block Explorer]
    end

    subgraph AMD MI300X Server (Agent A - The Scout)
        Sc[Scraper / Headless Browser]
        VDB[(ChromaDB - Memory)]
        LLM[Llama 3 8B via vLLM ROCm]
        Scoring[Hybrid Scoring Engine]
        
        Data Sources --> Sc
        Sc -->|Raw Text| VDB
        VDB -->|Context| LLM
        LLM -->|70% Sentiment| Scoring
        O -->|30% TVL Metric| Scoring
    end

    subgraph Communication Layer
        API[JSON REST API + Signature Verification]
        DB[(PostgreSQL - Tx Logs)]
    end

    subgraph Blockchain Node (Agent B - The Vault)
        VaultCore[Vault Engine]
        KMS[AWS KMS / Key Rotation]
        RPC[Multi-RPC: Alchemy -> Infura]
        Oracle[Gas Station Oracle]
        
        VaultCore <--> KMS
        VaultCore -->|Check Tx| DB
        Oracle --> VaultCore
    end

    subgraph Base Network (On-Chain)
        SC[Custom Smart Contract w/ Pausable]
    end

    subgraph User Interface
        UI[Next.js Web Dashboard]
    end

    Scoring -->|JSON Payload| API
    API --> VaultCore
    VaultCore -->|Execute Tx| RPC
    RPC --> SC
    SC -->|Tx Hash| DB
    VaultCore -->|Live Logs| UI
```

## Komponen Utama

1. **Hardware AMD MI300X**: Inti komputasi AI kita. Menggunakan `vLLM` yang dikompilasi khusus untuk ROCm agar *throughput* Llama 3 8B maksimal.
2. **LangGraph Framework**: Seluruh node dalam diagram di atas diorkestrasi menggunakan LangGraph, memungkinkan kita mengelola *state* yang kompleks dan *retry mechanism* dengan mudah.
3. **Database Relasional & Vector**: 
   - **ChromaDB**: Menjadi *Long-Term Memory* Agent A agar tidak menganalisis proyek yang sama berulang kali.
   - **PostgreSQL**: Menyimpan log transaksi Agent B untuk memastikan status *idempotency* (mencegah *double-spending*).
4. **Hybrid Approval Mode**: Semua transaksi < $2 berjalan otonom. Jika > $2, proses tertahan di *Dashboard Next.js* dan butuh klik "Approve" dari manusia.
