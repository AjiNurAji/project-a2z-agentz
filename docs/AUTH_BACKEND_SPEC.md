# Auth Backend Spec — Untuk Backend Developer

> **Dokumen ini** menjelaskan endpoint autentikasi yang dibutuhkan oleh frontend yang sudah dibuat. Frontend sudah siap dan memanggil endpoint-endpoint di bawah. Backend perlu mengimplementasikannya.

## Overview

Frontend auth system menggunakan:
- **JWT** di httpOnly cookie (nama cookie: `a2z-token`) untuk email/password auth
- **bcrypt** untuk hash password
- **PostgreSQL** tabel `users` baru
- **Frontend-only wallet demo session** (`a2z-wallet-session`) untuk demo Connect Wallet sampai SIWE endpoint tersedia

> Status wallet auth: UI sudah punya Connect Wallet modal, provider detection, demo fallback, dan dashboard readiness card. Backend production masih perlu endpoint SIWE agar wallet login bisa menerbitkan cookie JWT `a2z-token` yang aman.

## Database — Tabel `users`

Jalankan SQL ini setelah `database_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL        PRIMARY KEY,
    email           VARCHAR(255)  UNIQUE NOT NULL,
    password_hash   TEXT          NOT NULL,        -- bcrypt $2b$...
    wallet_address  VARCHAR(42),                   -- opsional, 0x... Base addr
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    CONSTRAINT chk_wallet CHECK (
        wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$'
    )
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
```

## Endpoints yang Dibutuhkan

### 1. `POST /api/auth/register`

**Request:**
```json
{
  "email": "user@agent.io",
  "password": "securepass123",
  "wallet_address": "0x..." // opsional
}
```

**Response Success (201):**
```json
{
  "user": {
    "id": 1,
    "email": "user@agent.io",
    "wallet_address": null,
    "created_at": "2026-01-01 00:00:00",
    "last_login_at": null
  }
}
```

**Response Error:**
- `409` — `{"error": "Email already registered"}`
- `422` — `{"error": "Invalid email format"}` atau `{"error": "Password must be at least 8 characters"}`

**Logic:**
1. Validasi email format + password min 8 char
2. Cek apakah email sudah ada di tabel `users`
3. Hash password dengan bcrypt (12 rounds)
4. INSERT ke `users`
5. Return user (TANPA `password_hash`)

---

### 2. `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@agent.io",
  "password": "securepass123"
}
```

**Response Success (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@agent.io",
    "wallet_address": null,
    "created_at": "2026-01-01 00:00:00",
    "last_login_at": "2026-06-20 12:00:00"
  }
}
```

**Response Headers:**
```
Set-Cookie: a2z-token=<JWT>; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax
```

**Response Error:**
- `401` — `{"error": "Invalid email or password"}` (email tidak ada ATAU password salah — samakan pesannya untuk hindari enumeration)

**Logic:**
1. Cari user by email
2. Verify password dengan bcrypt
3. Update `last_login_at`
4. Sign JWT (HS256, exp 7 hari, payload: `{sub: user_id, email: email}`)
5. Set cookie `a2z-token` httpOnly
6. Return user

---

### 3. `GET /api/auth/me`

**Request:** Tidak ada body. Hanya baca cookie `a2z-token`.

**Response Success (200):**
```json
{
  "user": {
    "id": 1,
    "email": "user@agent.io",
    "wallet_address": null,
    "created_at": "2026-01-01 00:00:00",
    "last_login_at": "2026-06-20 12:00:00"
  }
}
```

**Response Error:**
- `401` — `{"error": "Not authenticated"}` (cookie tidak ada)
- `401` — `{"error": "Invalid or expired token"}` (JWT invalid/expired)

**Logic:**
1. Baca cookie `a2z-token`
2. Decode + verify JWT
3. Query user by `id` dari payload `sub`
4. Return user (TANPA `password_hash`)

---

### 4. `POST /api/auth/logout`

**Request:** Tidak ada body.

**Response (200):**
```json
{"ok": true}
```

**Response Headers:**
```
Set-Cookie: a2z-token=; HttpOnly; Path=/; Max-Age=0
```

**Logic:**
1. Clear cookie `a2z-token` (set Max-Age=0)

---

### 5. Future Wallet Auth / SIWE Endpoints

Frontend saat ini sudah siap untuk wallet UX, tetapi belum menganggap wallet session sebagai backend-authenticated identity. Untuk production, tambahkan endpoint SIWE berikut.

#### `POST /api/auth/wallet/challenge`

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "chain_id": "0x2105"
}
```

**Response Success (200):**
```json
{
  "nonce": "random-nonce",
  "message": "a2z.agentz wants you to sign in with your Ethereum account..."
}
```

**Logic:**
1. Validasi address EVM.
2. Generate nonce one-time-use dengan expiry pendek (mis. 5 menit).
3. Return SIWE message yang mencakup domain frontend, address, chain id, nonce, issued-at.

#### `POST /api/auth/wallet/verify`

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "message": "SIWE message from challenge",
  "signature": "0x..."
}
```

**Response Success (200):** sama seperti `/api/auth/login`, plus `Set-Cookie: a2z-token=<JWT>; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`.

**Logic:**
1. Verify signature terhadap address.
2. Verify nonce belum dipakai dan belum expired.
3. Upsert/find user berdasarkan `wallet_address`.
4. Set `last_login_at`.
5. Issue JWT cookie `a2z-token`.

**Catatan keamanan:** jangan gunakan cookie `a2z-wallet-session` untuk keputusan backend authorization. Cookie itu hanya frontend demo flag dan bukan httpOnly.

---

## Mount di Starlette

```python
# main.py
from routes.auth import routes as auth_routes

# Di routes list:
Mount("/api/auth", routes=auth_routes),
```

## Dependencies yang Dibutuhkan

```
# requirements.txt
bcrypt
PyJWT
```

## Environment Variables

```
# .env
JWT_SECRET=<random-string-min-32-chars>
FRONTEND_ORIGIN=http://localhost:3000
```

**Catatan CORS:** Saat ini `allow_origins=["*"]` dengan `allow_credentials=True`. Ini bisa jadi masalah di production karena browser menolak `*` + credentials. Untuk development lokal cukup, tapi untuk production perlu ganti ke `FRONTEND_ORIGIN`.

## Response Shape (Konsisten)

Semua endpoint yang mengembalikan user harus menggunakan shape ini (TANPA `password_hash`):

```json
{
  "user": {
    "id": 1,
    "email": "user@agent.io",
    "wallet_address": "0x..." | null,
    "created_at": "2026-01-01 00:00:00",
    "last_login_at": "2026-06-20 12:00:00" | null
  }
}
```
