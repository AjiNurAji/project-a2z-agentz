# 03. Agent B (The Vault)

**Agent B** adalah sistem brankas eksekutor yang beroperasi di jaringan blockchain **Base**. Karena berurusan dengan uang sungguhan, desain arsitektur Agent B sepenuhnya difokuskan pada tingkat keamanan militer (*bulletproof security*) dan keandalan sistem.

## 1. Manajemen Wallet & Kunci (Keys)
Agent B menggunakan *Externally Owned Account* (EOA) untuk kesederhanaan *deployment* selama hackathon, namun dikelilingi oleh lapisan perlindungan ketat:
- **AWS KMS / HashiCorp Vault**: *Private key* tidak pernah disimpan di dalam file `.env` biasa atau *hardcoded*. Private key dikelola secara eksternal melalui layanan *Key Management Service* dengan rotasi otomatis.
- **Smart Contract Modifier**: Agent B hanya dapat berinteraksi dengan sebuah *Custom Smart Contract* yang memiliki fungsi `onlyOwner` (di mana Owner-nya adalah KMS Agent B).

## 2. Strategi Gas & Multi-RPC Fallback
Untuk menjamin 99.9% *uptime* dan mencegah transaksi menggantung (*stuck*):
- **Gas Oracle API**: Sebelum mengeksekusi, Agent B melakukan ping ke *Alchemy/Infura Gas Station API* dan menyetel `maxFeePerGas` pada nominal rata-rata + 15%.
- **Multi-RPC Fallback**: Eksekusi utama dikirim melalui Alchemy. Jika jaringan Alchemy *timeout* / *down*, Agent B secara otomatis melakukan *fail-over* me-routing transaksi via Infura atau RPC Publik Base.

## 3. Idempotensi & Circuit Breaker
- **Mencegah Double-Spending**: Sebelum *broadcasting* transaksi ke mempool, Agent B mencatat *hash* kombinasi unik `(AgentA_ID, Project_Address, Timestamp)` ke dalam database **PostgreSQL** lokal. Jika Agent A tanpa sengaja mengirim *payload* ganda karena jaringan *retry*, Agent B akan membatalkannya secara lokal berdasarkan catatan DB.
- **Emergency Pause (Kill Switch)**: Terdapat variabel global yang terhubung dengan Dashboard Next.js. Manusia dapat memicu tombol darurat yang menghentikan semua operasi on-chain seketika jika LLM terdeteksi berhalusinasi parah.
- **Limit Per Transaksi**: Menggunakan *hard-cap* sebesar $1 hingga $2 per transaksi maksimal untuk keamanan ekstra. Jika lebih dari batas ini, wajib masuk fase *Manual Approval* (Hybrid-mode).

## 4. Validasi Keamanan Transaksi (Anti-Honeypot)
Sebelum mengirimkan dana ke *address* project, Agent B melakukan **Dry Run** (simulasi transaksi lokal) misalnya mem-fork state menggunakan *Tenderly* atau *forge script*. Jika simulasi menunjukkan transaksi akan *revert* (gagal) atau menguras token yang tidak semestinya, transaksi akan diblokir.
