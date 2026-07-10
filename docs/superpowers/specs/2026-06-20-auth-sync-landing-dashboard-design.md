# Design Spec: Auth System + Landing/Dashboard Synchronization

**Date:** 2026-06-20
**Topic:** Authentication system (login/register) + flow synchronization between the landing page and the dashboard
**Status:** Draft (awaiting user review)
**Branch target:** `develop` (after fast-forward sync to `origin/develop`)

---

## 1. Context & Background

### 1.1 Initial State (before this work)

The A2Z Agentz project is a submission to the **AMD Hackathon ACT II** with the theme *Agent-to-Agent Payments*. The repo has 3 main components:

- **Landing page** (`dashboard/src/app/(landing)/page.tsx`) — hero showcase with `AgentScene`, animated GIF, 3 CTAs
- **Dashboard** (`dashboard/src/app/(dashboard)/`) — multi-page (analytics, agents, memory, history, settings) with Sidebar + Navbar + DashboardContext
- **Backend**:
  - `backend/` (Starlette, port 8000) — REST API `/api/stats`, `/api/targets`, `/api/transactions`, etc. Uses PostgreSQL via `database.py`
  - `agent_b.py` (FastAPI, port 8080) — vault executor for on-chain transactions

### 1.2 Masalah yang Dipecahkan

1. **No authentication** — the "Log In", "Launch App", "Enter Mission Control" buttons on the landing page all call `router.push("/dashboard")` without any check. Anyone can enter.
2. **Backend without auth endpoints** — `backend/routes/api.py` only has data endpoints, no register/login/me/logout.
3. **No users table** — `database_schema.sql` only has `target_addresses` and `execution_logs`.
4. **No route protection** — Next.js has no middleware; all dashboard routes are publicly accessible.
5. **Navbar does not know the user** — there is no user/login-state info in the dashboard UI.

### 1.3 Synchronization Already Performed (outside this spec's scope)

Before this design, the local `develop` branch was 10 commits behind `origin/develop`. A **fast-forward pull** (`git pull --ff-only origin develop`) was performed, successfully bringing in:
- Landing page lengkap + `AgentScene` (PR #5)
- Backend folder lengkap (PR #4)
- Agent A pipeline (`agent_a_scraper.py`, `agent_a_inference.py`, `agent_a_chroma.py`)
- Restrukturisasi route group `(landing)` + `(dashboard)`

After sync, local HEAD = `1de775a` (Merge PR #5). This auth work builds on top of that state.

---

## 2. Design Decisions (from brainstorming)

| # | Pertanyaan | Keputusan |
|---|-----------|-----------|
| Q1 | Auth depth | **Frontend + mock API** — backend is the source of truth, not a localStorage demo |
| Q2 | Login method | **Email + Password + optional Web3 wallet** — email/password by default, optional "Connect Wallet" button at register to link a Base address |
| Q3 | Route placement | **`(auth)/login` + `(auth)/register`** — new route group with its own layout (centered, no Sidebar/Navbar) |
| Q4 | Session/protection model | **Middleware + JWT cookie** — Next.js middleware checks the httpOnly cookie and redirects to `/login` if not authenticated |
| Q5 | Visual layout | **Option C: Background AgentScene + Centered Compact form** — reuse `AgentScene` as the full background, form floating in the center. **Mobile & desktop responsive is REQUIRED** |
| Q6 | Backend auth | **The existing Starlette `backend/`** — auth endpoints added to `backend/routes/`, new `users` table in PostgreSQL |
| — | State approach | **Approach A: Context + Middleware** — protection middleware + `AuthProvider` Context for UI state (Navbar knows the user, proper logout) |

---

## 3. Arsitektur & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (Next.js 16)                                       │
│                                                             │
│  (landing)/page.tsx ──[click "Log In"]──▶ /login            │
│  (landing)/page.tsx ──[click "Launch App"]──▶ /login        │
│  (landing)/page.tsx ──[click "Enter Mission Control"]▶/login│
│                                                             │
│  middleware.ts ─── cek cookie 'a2z-token'                   │
│   ├─ no token + access /dashboard/* ──▶ redirect /login?next=│
│   ├─ valid token + access /login|/register ──▶ redirect /dashboard │
│   └─ else ──▶ NextResponse.next()                           │
│                                                             │
│  (auth)/login/page.tsx ──POST──┐                            │
│  (auth)/register/page.tsx ──POST──┤                         │
│                                   ▼                          │
│  AuthProvider (Context) ◀── GET /api/auth/me                │
│   └─ { user, loading, login, register, logout, refresh }    │
│       └─ Navbar shows email + Logout button             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼  (fetch, credentials:'include')
┌─────────────────────────────────────────────────────────────┐
│  Starlette backend/ (port 8000)                             │
│                                                             │
│  routes/auth.py (NEW)                                      │
│   ├─ POST /api/auth/register  → hash bcrypt, insert users   │
│   ├─ POST /api/auth/login     → verify bcrypt, sign JWT     │
│   │                             Set-Cookie: a2z-token (httpOnly) │
│   ├─ GET  /api/auth/me        → verify JWT, return user     │
│   └─ POST /api/auth/logout    → clear cookie                │
│                                                             │
│  auth.py (NEW — pure logic)                                │
│   └─ hash_password, verify_password, create_jwt, decode_jwt │
│                                                             │
│  database.py (existing, reused)                             │
│   └─ _get_cursor() to query the users table                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                 │
│                                                             │
│  users (NEW TABLE)                                         │
│   ├─ id            SERIAL PK                                │
│   ├─ email         VARCHAR(255) UNIQUE NOT NULL             │
│   ├─ password_hash TEXT NOT NULL  (bcrypt $2b$...)          │
│   ├─ wallet_address VARCHAR(42) NULL (opsional Base addr)   │
│   ├─ created_at    TIMESTAMP DEFAULT now()                  │
│   └─ last_login_at TIMESTAMP NULL                           │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Dependencies

- **Backend (new):** `bcrypt>=4.x`, `PyJWT>=2.x` → add to `backend/requirements.txt`
- **Frontend:** no new packages (native `fetch` + React Context)
- **Env (new):** `JWT_SECRET` (required, ≥32 char), `FRONTEND_ORIGIN` (default `http://localhost:3000`)

---

## 4. Detail Backend

### 4.1 `backend/database_schema_patch_users.sql` (NEW)

```sql
-- users table for authentication (login/register)
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

### 4.2 `backend/auth.py` (NEW — pure logic module)

```python
hash_password(plain: str) -> str          # bcrypt.hashpw, rounds=12
verify_password(plain: str, hash: str) -> bool  # bcrypt.checkpw
create_jwt(user_id: int, email: str) -> str     # PyJWT, exp 7 days, HS256
decode_jwt(token: str) -> dict | None           # verify exp + signature; None if invalid
```

- `JWT_SECRET` is read from the `JWT_SECRET` env (raises RuntimeError if empty, like the `POSTGRES_URI` pattern in `database.py`)
- Token payload: `{ "sub": user_id, "email": email, "exp": now+7d, "iat": now }`

### 4.3 `backend/routes/auth.py` (NEW — 4 endpoints)

| Endpoint | Method | Body | Sukses | Error |
|----------|--------|------|--------|-------|
| `/api/auth/register` | POST | `{email, password, wallet_address?}` | 201 `{user: {id,email,wallet_address,created_at}}` | 409 email exists, 422 validation |
| `/api/auth/login` | POST | `{email, password}` | 200 `{user}` + Set-Cookie `a2z-token` | 401 invalid creds |
| `/api/auth/me` | GET | — (cookie) | 200 `{user}` | 401 no/invalid token |
| `/api/auth/logout` | POST | — | 200 `{ok:true}` + clear cookie | — |

**Response user shape** (consistent, does not expose `password_hash`):
```json
{ "id": 1, "email": "user@agent.io", "wallet_address": "0x...", "created_at": "...", "last_login_at": "..." }
```

**Cookie contract:**
- Name: `a2z-token`
- `HttpOnly=True`, `SameSite=Lax`, `Secure=True` (prod) / `False` (dev HTTP), `Path=/`
- `Max-Age=604800` (7 days)

**Input validation (in routes/auth.py):**
- `email`: regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`, lowercased + stripped
- `password`: min 8 char
- `wallet_address`: opsional, regex `^0x[a-fA-F0-9]{40}$`
- Body malformed → 422

### 4.4 `backend/main.py` (MODIFY)

- Mount `/api/auth` → `routes.auth.routes`
- Fix CORS (currently `allow_origins=["*"]` + `allow_credentials=True` — browsers reject this combination):
  ```python
  allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
  allow_credentials=True,
  ```

### 4.5 `backend/requirements.txt` (MODIFY)

Add:
```
bcrypt>=4.0.0
PyJWT>=2.8.0
```

---

## 5. Detail Frontend

### 5.1 New/changed folder structure

```
dashboard/src/
├── middleware.ts                          ← NEW
├── lib/
│   ├── auth.ts                           ← NEW
│   └── api.ts                            ← NEW
├── components/
│   ├── AuthProvider.tsx                  ← NEW
│   └── landing/AgentScene.tsx            ← EXISTS (reuse bg auth)
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                    ← NEW
│   │   ├── login/page.tsx                ← NEW
│   │   └── register/page.tsx             ← NEW
│   ├── (landing)/page.tsx                ← MODIFY
│   ├── (dashboard)/layout.tsx            ← MODIFY
│   └── layout.tsx                        ← MODIFY
```

### 5.2 `middleware.ts` — proteksi route

```typescript
// Logic:
const token = request.cookies.get('a2z-token');
const PUBLIC = ['/', '/login', '/register'];
const isAuthPage = path === '/login' || path === '/register';

if (!token && !PUBLIC.includes(path)) → redirect(`/login?next=${path}`);
if (token && isAuthPage) → redirect('/dashboard');
// else: NextResponse.next()
```

**Note:** the Next.js middleware runs in the edge runtime — it cannot reliably verify the JWT signature. Middleware only checks **cookie presence**. Signature verification still happens in the backend (`/api/auth/me`). This is safe because all data access goes through the backend, which verifies. If a forged token is in the cookie, `/me` returns 401 → AuthProvider sets user to null → redirect back to login.

### 5.3 `lib/api.ts` — fetch wrapper

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
// fetch wrapper with credentials:'include', JSON parse, error throw
```

### 5.4 `lib/auth.ts` — auth helpers

```typescript
login(email, password): Promise<User>
register(email, password, walletAddress?): Promise<User>
me(): Promise<User | null>
logout(): Promise<void>
```

### 5.5 `AuthProvider.tsx` — React Context

```typescript
interface AuthState {
  user: { id: number; email: string; walletAddress?: string } | null;
  loading: boolean;
  login(email, password): Promise<void>;
  register(email, password, walletAddress?): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;  // GET /me
}
```

- `onMount` → `refresh()` (GET /api/auth/me)
- `login/register` → POST, then `refresh()` to update state
- `logout` → POST /logout, clear state, `router.push('/login')`

### 5.6 `(auth)/layout.tsx`

```tsx
<AgentScene isTransitioning={false} onTransitionComplete={() => {}} />  // full bg
<div className="relative z-10 min-h-screen flex items-center justify-center p-4">
  {children}  {/* form card centered, responsive */}
</div>
```

### 5.7 `(auth)/login/page.tsx` & `register/page.tsx`

Form component **responsive is required**:
- **Mobile (<640px):** full-width card, `w-full max-w-sm`, padding `p-6`, larger font size for inputs (44px touch target)
- **Desktop (≥640px):** centered card `max-w-md`, `p-8`, larger shadow, hover effects

**Form elements:**
- Logo A2Z + heading ("Log In" / "Create Account")
- Email input
- Password input (+ confirm password on register)
- Remember me + forgot password (login only)
- Submit button with loading state (spinner + "Authenticating...")
- Divider "─── or ───"
- "🦊 Connect Wallet" button (register only — link alamat Base opsional)
- Link to the opposite page ("No account? Register" / "Already have an account? Log In")

**Accessibility (following the existing UI/UX Pro Max pattern):**
- `aria-label`, `aria-invalid` on error, `aria-describedby` pointing to the error message
- Error message `role="alert"`
- `focus-visible:ring-2` for keyboard nav
- Touch target ≥ 44×44px
- `role="form"`, associated label via `<label htmlFor>`

**Animasi:** reuse motion pattern landing (fade/slide entrance, `motion.div` + `AnimatePresence`)

### 5.8 `Navbar.tsx` (MODIFY)

- Import `useAuth()` from AuthProvider
- Add a `user.email` badge (truncated if long) on the right side
- Add a **Logout** button (icon `LogOut` from lucide-react) before ThemeToggle
- When `loading=true` → show a skeleton badge

### 5.9 `(landing)/page.tsx` (MODIFY)

- Ganti semua `router.push("/dashboard")` → `router.push("/login")` in `handleEnterDashboard`
- 3 tombol ("Log In", "Launch App", "Enter Mission Control") semua menuju `/login`
- The middleware will redirect to `/dashboard` automatically if the user already has a valid cookie

---

## 6. Error Handling & UX

### 6.1 Error states (form)

| Skenario | Tampilan |
|----------|----------|
| Empty/wrong-format email | inline red error below the field + `aria-invalid` |
| Password < 8 char | inline error |
| Login failed (401 backend) | toast error "Invalid email or password" |
| Register email already exists (409) | inline error "Email already registered" |
| Backend down / network error | toast error "Server unavailable. Is backend running?" |
| Wallet connect failed | inline error "Could not connect wallet" |
| Loading submit | button disabled + spinner, text "Authenticating..." |

### 6.2 Loading states

- **Initial app load:** AuthProvider `loading=true` → Navbar shows a skeleton badge. The dashboard page still renders (DashboardContext has its own skeleton).
- **Form submit:** button spinner + disabled
- **`/me` 401 (token invalid/expired):** AuthProvider sets `user=null`, lets the middleware handle the redirect on the next navigation

### 6.3 Protected route redirect flow

- User not logged in + access `/dashboard` → middleware redirects to `/login?next=/dashboard` → after successful login, AuthProvider redirects to the `next` value (default `/dashboard`)
- User already logged in + access `/login` → middleware redirects to `/dashboard`

---

## 7. Testing

### 7.1 Backend (Python)

- **Unit test `auth.py`:** hash/verify password (correct, wrong), create/decode JWT (valid, expired, tampered, wrong secret)
- **Integration test routes:** register → login → me → logout flow end-to-end; duplicate email → 409; wrong login → 401; input validation → 422
- Use an in-memory SQLite or mocked `_get_cursor` for tests (no running PostgreSQL needed)
- File: `backend/tests/test_auth.py`

### 7.2 Frontend (Vitest — config already exists)

- **`AuthProvider.test.tsx`:** login sukses set user + redirect, logout clear user, `/me` 401 set user null
- **`middleware.test.ts`:** pure function test (input path+cookie → expected redirect destination)
- **`login.test.tsx` / `register.test.tsx`:** render the form, validation error appears, submit calls `auth.login`/`auth.register`
- File: `dashboard/src/components/__tests__/auth.test.tsx`, `dashboard/src/lib/__tests__/auth.test.ts`

### 7.3 E2E (manual for demo)

- Register a new user → auto-login → view dashboard (data renders)
- Logout → redirect to landing
- Access `/dashboard` without login → redirect `/login`
- Access `/login` when already logged in → redirect to `/dashboard`
- Responsive check: login/register on mobile (375px) and desktop (1440px)

---

## 8. Implementation Phases (work order)

| Phase | Scope | Verifiable output |
|------|---------|-------------------|
| **1. Backend auth** | `database_schema_patch_users.sql` + `auth.py` + `routes/auth.py` + `requirements.txt` + `main.py` mount + CORS fix | `curl POST /api/auth/register` + `/login` + `/me` + `/logout` works |
| **2. Frontend lib + middleware** | `lib/auth.ts`, `lib/api.ts`, `middleware.ts` | Route protection active (redirect `/dashboard` → `/login`) |
| **3. AuthProvider + auth pages** | `AuthProvider.tsx`, `(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/register/page.tsx`, reuse AgentScene | Can register/login via UI, responsive |
| **4. Navbar + landing integration** | Navbar logout/email badge, `(landing)/page.tsx` button to `/login`, root layout wraps AuthProvider | Complete end-to-end flow |
| **5. Testing** | backend `test_auth.py` + frontend `auth.test.tsx` + middleware test | `npm run test:e2e` + pytest pass |
| **6. Documentation** | update `memory.md` (new session), `README.md` setup for `JWT_SECRET` + `FRONTEND_ORIGIN` | Complete docs |

---

## 9. Scope (YAGNI)

### 9.1 What is INCLUDED

- Login + register (email/password)
- Optional wallet connect at register
- Middleware route protection
- AuthProvider Context
- Navbar user badge + logout
- Landing → /login redirect
- Backend endpoints + users table
- Unit + integration tests

### 9.2 What is NOT INCLUDED (out of scope)

- ❌ Password reset via email (the forgot-password link exists in the UI but is only a placeholder)
- ❌ Email verification
- ❌ OAuth (Google/GitHub login)
- ❌ Full SIWE (Sign-In with Ethereum) — wallet connect on register only links the address, not a sign challenge
- ❌ Role-based access control (admin/user) — all users are equal
- ❌ Rate limiting login attempts
- ❌ 2FA / MFA
- ❌ User profile page / settings edit
- ❌ Session management across multiple devices

### 9.3 Trade-off Penting

- **Middleware checks cookie existence, not JWT verification** — it cannot verify the signature in the edge runtime. Safe because the backend still verifies in `/me`. If a token is forged, data access is still rejected by the backend.
- **Wallet connect is "optional" at register, not full SIWE** — keeps complexity manageable for the hackathon. Only links the address, does not issue a sign challenge.
- **Forgot password is only a placeholder** — email reset needs an SMTP service, out of scope for the demo.

---

## 10. File Inventory

### 10.1 Backend (4 new, 2 modified)

| File | Aksi | Deskripsi |
|------|------|-----------|
| `backend/database_schema_patch_users.sql` | NEW | users table |
| `backend/auth.py` | NEW | Pure logic: hash, verify, JWT |
| `backend/routes/auth.py` | NEW | 4 auth endpoints |
| `backend/tests/test_auth.py` | NEW | Unit + integration test |
| `backend/main.py` | MODIFY | Mount /api/auth + fix CORS |
| `backend/requirements.txt` | MODIFY | + bcrypt, PyJWT |

### 10.2 Frontend (9 new, 4 modified)

| File | Aksi | Deskripsi |
|------|------|-----------|
| `dashboard/src/middleware.ts` | NEW | Route protection |
| `dashboard/src/lib/api.ts` | NEW | Fetch wrapper |
| `dashboard/src/lib/auth.ts` | NEW | Auth helpers |
| `dashboard/src/components/AuthProvider.tsx` | NEW | React Context |
| `dashboard/src/app/(auth)/layout.tsx` | NEW | Centered layout + AgentScene bg |
| `dashboard/src/app/(auth)/login/page.tsx` | NEW | Login form |
| `dashboard/src/app/(auth)/register/page.tsx` | NEW | Register form |
| `dashboard/src/components/__tests__/auth.test.tsx` | NEW | Test AuthProvider |
| `dashboard/src/lib/__tests__/auth.test.ts` | NEW | Test middleware + auth helpers |
| `dashboard/src/app/layout.tsx` | MODIFY | Wrap AuthProvider at root (inside ToastProvider) |
| `dashboard/src/components/Navbar.tsx` | MODIFY | + user badge + logout button |
| `dashboard/src/app/(landing)/page.tsx` | MODIFY | Button → /login |

**(dashboard)/layout.tsx is not changed** — AuthProvider at the root layout already covers all routes including the Navbar.

Total frontend: **9 new files, 3 modified files**.

### 10.3 Documentation (2 modified)

| File | Aksi | Deskripsi |
|------|------|-----------|
| `memory.md` | MODIFY | Add a new session with a work summary |
| `README.md` | MODIFY | Setup guide: `JWT_SECRET`, `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL` |

---

## 11. Acceptance Criteria

Implementation is considered complete when ALL of the following are met:

1. ✅ User can register via `/register` with email + password (+ optional wallet)
2. ✅ User can log in via `/login`, redirect to `/dashboard` after success
3. ✅ Cookie `a2z-token` is set (httpOnly), persists after refresh & browser close
4. ✅ Access `/dashboard/*` without login → redirect `/login?next=...`
5. ✅ Access `/login` when already logged in → redirect `/dashboard`
6. ✅ Navbar shows the user's email + a working Logout button
7. ✅ Logout clears the cookie, redirects to landing
8. ✅ Password is bcrypt-hashed in the DB (not plain text)
9. ✅ Form login/register responsive on mobile (375px) & desktop (1440px)
10. ✅ Form accessible (aria, focus-visible, touch target ≥44px)
11. ✅ Backend test pass: `pytest backend/tests/test_auth.py`
12. ✅ Frontend test pass: `npm run test:e2e`
13. ✅ Error states display correctly (401, 409, 422, network error)
14. ✅ Landing page 3 tombol semua menuju `/login`
15. ✅ No password_hash is exposed in any API response
