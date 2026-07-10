# Auth Backend Spec — For the Backend Developer

> **This document** describes the authentication endpoints required by the already-built frontend. The frontend is ready and calls the endpoints listed below. The backend must implement them.

## Overview

Frontend auth system uses:
- **JWT** in the httpOnly cookie (cookie name: `a2z-token`) for email/password auth
- **bcrypt** to hash the password
- **PostgreSQL** `users` table (new)
- **Frontend-only wallet demo session** (`a2z-wallet-session`) for the demo Connect Wallet until the SIWE endpoint is available

> Wallet auth status: the UI already has the Connect Wallet modal, provider detection, demo fallback, and dashboard readiness card. Production backend still needs a SIWE endpoint so wallet login can issue a secure `a2z-token` JWT cookie.

## Database — Table `users`

Run this SQL after `database_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL        PRIMARY KEY,
    email           VARCHAR(255)  UNIQUE NOT NULL,
    password_hash   TEXT          NOT NULL,        -- bcrypt $2b$...
    wallet_address  VARCHAR(42),                   -- optional, 0x... Base address
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at   TIMESTAMP,
    CONSTRAINT chk_wallet CHECK (
        wallet_address IS NULL OR wallet_address ~ '^0x[a-fA-F0-9]{40}$'
    )
);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
```

## Required Endpoints

### 1. `POST /api/auth/register`

**Request:**
```json
{
  "email": "user@agent.io",
  "password": "securepass123",
  "wallet_address": "0x..." // optional
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
- `422` — `{"error": "Invalid email format"}` or `{"error": "Password must be at least 8 characters"}`

**Logic:**
1. Validate email format + password min 8 chars
2. Check whether the email already exists in the `users` table
3. Hash the password with bcrypt (12 rounds)
4. INSERT into `users`
5. Return the user (WITHOUT `password_hash`)

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
- `401` — `{"error": "Invalid email or password"}` (email does not exist OR password is wrong — keep the message identical to avoid user enumeration)

**Logic:**
1. Find the user by email
2. Verify the password with bcrypt
3. Update `last_login_at`
4. Sign JWT (HS256, exp 7 days, payload: `{sub: user_id, email: email}`)
5. Set cookie `a2z-token` httpOnly
6. Return user

---

### 3. `GET /api/auth/me`

**Request:** No body. Reads only the `a2z-token` cookie.

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
- `401` — `{"error": "Not authenticated"}` (cookie missing)
- `401` — `{"error": "Invalid or expired token"}` (JWT invalid/expired)

**Logic:**
1. Read the `a2z-token` cookie
2. Decode + verify JWT
3. Query the user by `id` from the payload `sub`
4. Return the user (WITHOUT `password_hash`)

---

### 4. `POST /api/auth/logout`

**Request:** No body.

**Response (200):**
```json
{"ok": true}
```

**Response Headers:**
```
Set-Cookie: a2z-token=; HttpOnly; Path=/; Max-Age=0
```

**Logic:**
1. Clear the `a2z-token` cookie (set Max-Age=0)

---

### 5. Future Wallet Auth / SIWE Endpoints

The frontend is currently ready for the wallet UX, but does not yet treat the wallet session as a backend-authenticated identity. For production, add the following SIWE endpoints.

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
1. Validate the EVM address.
2. Generate a one-time-use nonce with a short expiry (e.g. 5 minutes).
3. Return a SIWE message that includes the frontend domain, address, chain id, nonce, and issued-at.

#### `POST /api/auth/wallet/verify`

**Request:**
```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "message": "SIWE message from challenge",
  "signature": "0x..."
}
```

**Response Success (200):** same as `/api/auth/login`, plus `Set-Cookie: a2z-token=<JWT>; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`.

**Logic:**
1. Verify the signature against the address.
2. Verify the nonce has not been used and has not expired.
3. Upsert/find the user by `wallet_address`.
4. Set `last_login_at`.
5. Issue JWT cookie `a2z-token`.

**Security note:** do not use the `a2z-wallet-session` cookie for backend authorization decisions. That cookie is only a frontend demo flag and is not httpOnly.

---

## Mount in Starlette

```python
# main.py
from routes.auth import routes as auth_routes

# In the routes list:
Mount("/api/auth", routes=auth_routes),
```

## Required Dependencies

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

**CORS note:** currently `allow_origins=["*"]` with `allow_credentials=True`. This can be a problem in production because browsers reject `*` + credentials. It is acceptable for local development, but for production it must be changed to `FRONTEND_ORIGIN`.

## Response Shape (Consistent)

All endpoints that return a user must use this shape (WITHOUT `password_hash`):

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
