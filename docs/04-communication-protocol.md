# 04. Protokol Komunikasi Antar Agen

Dokumen ini menjembatani komunikasi antara **Agent A** (Scout, ditenagai AIM-tuned LLM di SGLang/MI300X) dan **Agent B** (Vault, eksekutor on-chain).

## Format Payload (REST API)

Komunikasi menggunakan protokol HTTP REST standar dengan payload **JSON**. Backend Agent B (Vault API) menerima request dan men-translasi / *encode* menjadi `calldata` blockchain.

### Contoh Request (Agent A → Agent B)

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

API Agent B tidak bisa dipanggil sembarangan. Pencegahan terhadap serangan *Man-in-the-Middle* (MitM) atau request palsu:

- Agent A memiliki sepasang kunci kriptografi (*public-private keypair*).
- Setiap *payload JSON* di-*hash* lalu di-*sign* (ECDSA) menggunakan private key Agent A.
- Agent B memiliki *whitelist* public key milik Agent A.
- Saat request masuk, Agent B me-verifikasi *signature*. Jika valid dan `timestamp` masih *fresh* (belum kadaluwarsa), instruksi dijalankan.

## LangGraph Orchestration

Keduanya diorkestrasi via **LangGraph**. *State* grafik menyimpan:

- `current_step`: `"Scraping"` → `"Analyzing"` → `"Approval"` → `"Executing"`
- `transaction_status`: `"Pending"` / `"Success"` / `"Failed"`

## Inference Endpoint Reference

Agent A memanggil **AMD Inference Microservice (AIM)** yang di-serve via **SGLang** di MI300X. Format request mengikuti OpenAI-compatible API:

```json
POST {SGLANG_ENDPOINT}/v1/chat/completions
{
  "model": "a2z-web3-tuned",
  "messages": [
    {"role": "system", "content": "You are a Web3 project sentiment analyzer..."},
    {"role": "user", "content": "<raw_farcaster_post_or_onchain_data>"}
  ],
  "temperature": 0.1,
  "max_tokens": 512
}
```

Response dari AIM-tuned LLM kemudian di-parse oleh Agent A, digabung dengan on-chain TVL metric (30%), dan jika total score > threshold, payload diteruskan ke Agent B via endpoint `/api/v1/vault/execute` di atas.

## Retry Policy

Jika eksekusi gagal di Agent B (alasan apa pun), `transaction_status` berubah menjadi `"Failed"` dan LangGraph memicu **Exponential Backoff** retry (2s, 4s, 8s) sebelum akhirnya menandai sebagai terminal failure.
