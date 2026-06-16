# 04. Protokol Komunikasi Antar Agen

Dokumen ini mendefinisikan jembatan komunikasi antara **Agent A** (pengambil keputusan) dan **Agent B** (eksekutor).

## Format Payload (REST API)
Karena kita membangun arsitektur internal tertutup (lebih aman untuk hackathon), komunikasi menggunakan protokol HTTP REST standar dengan payload **JSON**. Backend Agent B (Vault API) akan menerima request ini dan men-translasi / *encode* menjadi `calldata` blockchain.

### Contoh Request (Agent A ke Agent B)
```json
POST /api/v1/vault/execute
{
  "timestamp": 1718500000,
  "project_target_address": "0x1234567890abcdef1234567890abcdef12345678",
  "amount_usd": 1.50,
  "reason": "High positive sentiment on Farcaster + Verified TVL > 500k",
  "signature": "0xabc123...def456" 
}
```

## Keamanan & Autentikasi (Signature Verification)
API Agent B tidak bisa dipanggil sembarangan. Mencegah eksploitasi serangan *Man-in-the-Middle* (MitM) atau request palsu:
- Agent A memiliki sepasang kunci kriptografi (*public-private keypair*).
- Setiap *payload JSON* yang dibuat, harus di-*hash* lalu di-*sign* (ditandatangani) menggunakan private key Agent A.
- Agent B memiliki daftar *whitelist* public key milik Agent A.
- Saat request masuk, Agent B me-verifikasi *signature* tersebut. Jika *signature* valid dan `timestamp` masih *fresh* (belum kadaluwarsa), maka instruksi dijalankan.

## LangGraph Orchestration
Keduanya dikelola (*orchestrated*) melalui **LangGraph**. *State* grafik LangGraph menyimpan:
- `current_step`: "Scraping" -> "Analyzing" -> "Approval" -> "Executing"
- `transaction_status`: "Pending" / "Success" / "Failed"

Jika eksekusi gagal di Agent B (karena alasan apa pun), status `transaction_status` berubah menjadi "Failed", dan LangGraph akan memicu **Sistem Retry Otomatis (Exponential Backoff)** yang mengirim ulang payload setelah jeda yang semakin panjang (misal: 2s, 4s, 8s).
