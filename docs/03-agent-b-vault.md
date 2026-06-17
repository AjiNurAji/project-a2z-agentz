# 03. Agent B (The Vault)

**Agent B** adalah sistem brankas eksekutor A2Z Agentz yang beroperasi di blockchain **Base**. Karena berurusan dengan dana sungguhan, Agent B difokuskan pada keamanan tingkat militer (*bulletproof security*) dan keandalan sistem.

> **Catatan:** Agent B **tidak menjalankan LLM** — semua decision-making ada di Agent A (AIM-tuned). Agent B murni eksekutor deterministik, jadi tidak ada perubahan stack AMD di sini. Yang berubah hanya **infrastruktur deployment** (Host di AMD Developer Cloud bersama Agent A atau dedicated compute).

## 1. Manajemen Wallet & Kunci (Keys)

Agent B menggunakan *Externally Owned Account* (EOA) untuk kesederhanaan *deployment* selama hackathon, dengan lapisan perlindungan ketat:

- **AWS KMS / HashiCorp Vault** — *Private key* tidak pernah disimpan di file `.env` atau *hardcoded*. Dikelola via *Key Management Service* dengan rotasi otomatis.
- **Smart Contract Modifier** — Agent B hanya berinteraksi dengan *Custom Smart Contract* yang memiliki fungsi `onlyOwner` (Owner = KMS Agent B).

## 2. Strategi Gas & Multi-RPC Fallback

Untuk menjamin 99.9% *uptime* dan mencegah transaksi menggantung (*stuck*):

- **Gas Oracle API** — Sebelum eksekusi, Agent B melakukan ping ke *Alchemy/Infura Gas Station API* dan menyetel `maxFeePerGas` pada nominal rata-rata + 15%.
- **Multi-RPC Fallback** — Eksekusi utama via Alchemy. Jika *timeout/down*, otomatis *fail-over* ke Infura atau RPC Publik Base.

## 3. Idempotensi & Circuit Breaker

- **Mencegah Double-Spending** — Sebelum *broadcasting* ke mempool, Agent B mencatat *hash* kombinasi unik `(AgentA_ID, Project_Address, Timestamp)` ke **PostgreSQL**. Jika Agent A kirim *payload* ganda, Agent B reject lokal.
- **Emergency Pause (Kill Switch)** — Variabel global terhubung dengan Dashboard Next.js. Manusia bisa memicu tombol darurat yang menghentikan semua operasi on-chain seketika.
- **Limit Per Transaksi** — *Hard-cap* $1 hingga $2 per transaksi. Jika lebih, wajib masuk fase *Manual Approval*.

## 4. Validasi Keamanan Transaksi (Anti-Honeypot)

Sebelum mengirim dana ke *address* project, Agent B melakukan **Dry Run** simulasi lokal (mem-fork state via *Foundry Anvil* atau *Tenderly*). Jika simulasi menunjukkan transaksi *revert* atau menguras token tidak semestinya → transaksi diblokir.

## 5. Deployment Context

- **Host**: Container di AMD Developer Cloud (region yang sama dengan Agent A untuk latensi rendah antar-agen via REST).
- **TIdak ada LLM di Agent B** — semua logika deterministic, hemat GPU.
- **Komunikasi dengan Agent A**: HTTPS REST dengan ECDSA signature verification (lihat [04-communication-protocol.md](04-communication-protocol.md)).
