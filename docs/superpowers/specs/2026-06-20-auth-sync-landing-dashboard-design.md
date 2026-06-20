# Design Spec: Auth System + Landing/Dashboard Synchronization

**Date:** 2026-06-20
**Topic:** Sistem autentikasi (login/register) + sinkronisasi alur antara landing page dan dashboard
**Status:** Draft (menunggu review user)
**Branch target:** `develop` (setelah sync fast-forward ke `origin/develop`)

---

## 1. Konteks & Latar Belakang

### 1.1 Kondisi Awal (sebelum pekerjaan ini)

Proyek A2Z Agentz adalah submission **AMD Hackathon ACT II** dengan tema *Agent-to-Agent Payments*. Repo memiliki 3 komponen utama:

- **Landing page** (`dashboard/src/app/(landing)/page.tsx`) — hero showcase dengan `AgentScene`, GIF animasi, 3 CTA
- **Dashboard** (`dashboard/src/app/(dashboard)/`) — multi-halaman (analytics, agents, memory, history, settings) dengan Sidebar + Navbar + DashboardContext
- **Backend**:
  - `backend/` (Starlette, port 8000) — REST API `/api/stats`, `/api/targets`, `/api/transactions`, dll. Pakai PostgreSQL via `database.py`
  - `agent_b.py` (FastAPI, port 8080) — vault executor untuk transaksi on-chain

### 1.2 Masalah yang Dipecahkan

1. **Tidak ada autentikasi** — tombol "Log In", "Launch App", "Enter Mission Control" di landing semua langsung `router.push("/dashboard")` tanpa cek apa pun. Siapa saja bisa masuk.
2. **Backend tanpa endpoint auth** — `backend/routes/api.py` hanya punya endpoint data, tidak ada register/login/me/logout.
3. **Tidak ada tabel users** — `database_schema.sql` hanya punya `target_addresses` dan `execution_logs`.
4. **Tidak ada proteksi route** — Next.js tidak punya middleware; semua route dashboard bisa diakses publik.
5. **Navbar tidak tahu user** — tidak ada info user/login state di UI dashboard.

### 1.3 Sinkronisasi yang Sudah Dilakukan (di luar scope spec ini)

Sebelum desain ini, local `develop` tertinggal 10 commit dari `origin/develop`. Sudah dilakukan **fast-forward pull** (`git pull --ff-only origin develop`) yang berhasil membawa masuk:
- Landing page lengkap + `AgentScene` (PR #5)
- Backend folder lengkap (PR #4)
- Agent A pipeline (`agent_a_scraper.py`, `agent_a_inference.py`, `agent_a_chroma.py`)
- Restrukturisasi route group `(landing)` + `(dashboard)`

Setelah sync, local HEAD = `1de775a` (Merge PR #5). Pekerjaan auth ini berdiri di atas kondisi tersebut.

---

## 2. Keputusan Desain (dari brainstorming)

| # | Pertanyaan | Keputusan |
|---|-----------|-----------|
| Q1 | Kedalaman autentikasi | **Frontend + mock API** — backend jadi source of truth, bukan demo localStorage |
| Q2 | Metode login | **Email + Password + opsional Web3 wallet** — default email/password, tombol "Connect Wallet" opsional saat register untuk link alamat Base |
| Q3 | Penempatan route | **`(auth)/login` + `(auth)/register`** — route group baru dengan layout sendiri (centered, no Sidebar/Navbar) |
| Q4 | Model sesi/proteksi | **Middleware + JWT cookie** — Next.js middleware cek cookie httpOnly, redirect ke `/login` jika belum auth |
| Q5 | Layout visual | **Opsi C: Background AgentScene + Centered Compact form** — reuse `AgentScene` sebagai latar penuh, form melayang di tengah. **Responsive mobile & desktop WAJIB** |
| Q6 | Backend auth | **Starlette `backend/` yang sudah ada** — endpoint auth ditambahkan ke `backend/routes/`, tabel `users` baru di PostgreSQL |
| — | Pendekatan state | **Pendekatan A: Context + Middleware** — middleware proteksi + `AuthProvider` Context untuk UI state (Navbar tahu user, logout proper) |

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
│   ├─ no token + akses /dashboard/* ──▶ redirect /login?next=│
│   ├─ valid token + akses /login|/register ──▶ redirect /dashboard │
│   └─ else ──▶ NextResponse.next()                           │
│                                                             │
│  (auth)/login/page.tsx ──POST──┐                            │
│  (auth)/register/page.tsx ──POST──┤                         │
│                                   ▼                          │
│  AuthProvider (Context) ◀── GET /api/auth/me                │
│   └─ { user, loading, login, register, logout, refresh }    │
│       └─ Navbar tampilkan email + tombol Logout             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼  (fetch, credentials:'include')
┌─────────────────────────────────────────────────────────────┐
│  Starlette backend/ (port 8000)                             │
│                                                             │
│  routes/auth.py (BARU)                                      │
│   ├─ POST /api/auth/register  → hash bcrypt, insert users   │
│   ├─ POST /api/auth/login     → verify bcrypt, sign JWT     │
│   │                             Set-Cookie: a2z-token (httpOnly) │
│   ├─ GET  /api/auth/me        → verify JWT, return user     │
│   └─ POST /api/auth/logout    → clear cookie                │
│                                                             │
│  auth.py (BARU — pure logic)                                │
│   └─ hash_password, verify_password, create_jwt, decode_jwt │
│                                                             │
│  database.py (existing, reused)                             │
│   └─ _get_cursor() untuk query tabel users                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL                                                 │
│                                                             │
│  users (TABEL BARU)                                         │
│   ├─ id            SERIAL PK                                │
│   ├─ email         VARCHAR(255) UNIQUE NOT NULL             │
│   ├─ password_hash TEXT NOT NULL  (bcrypt $2b$...)          │
│   ├─ wallet_address VARCHAR(42) NULL (opsional Base addr)   │
│   ├─ created_at    TIMESTAMP DEFAULT now()                  │
│   └─ last_login_at TIMESTAMP NULL                           │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Dependencies

- **Backend (baru):** `bcrypt>=4.x`, `PyJWT>=2.x` → tambah ke `backend/requirements.txt`
- **Frontend:** tanpa package baru (native `fetch` + React Context)
- **Env (baru):** `JWT_SECRET` (wajib, ≥32 char), `FRONTEND_ORIGIN` (default `http://localhost:3000`)

---

## 4. Detail Backend

### 4.1 `backend/database_schema_patch_users.sql` (BARU)

```sql
-- Tabel users untuk autentikasi (login/register)
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

### 4.2 `backend/auth.py` (BARU — modul pure logic)

```python
hash_password(plain: str) -> str          # bcrypt.hashpw, rounds=12
verify_password(plain: str, hash: str) -> bool  # bcrypt.checkpw
create_jwt(user_id: int, email: str) -> str     # PyJWT, exp 7 hari, HS256
decode_jwt(token: str) -> dict | None           # verify exp + signature; None if invalid
```

- `JWT_SECRET` dibaca dari env `JWT_SECRET` (raise RuntimeError jika kosong, seperti pattern `POSTGRES_URI` di `database.py`)
- Token payload: `{ "sub": user_id, "email": email, "exp": now+7d, "iat": now }`

### 4.3 `backend/routes/auth.py` (BARU — 4 endpoint)

| Endpoint | Method | Body | Sukses | Error |
|----------|--------|------|--------|-------|
| `/api/auth/register` | POST | `{email, password, wallet_address?}` | 201 `{user: {id,email,wallet_address,created_at}}` | 409 email exists, 422 validasi |
| `/api/auth/login` | POST | `{email, password}` | 200 `{user}` + Set-Cookie `a2z-token` | 401 invalid creds |
| `/api/auth/me` | GET | — (cookie) | 200 `{user}` | 401 no/invalid token |
| `/api/auth/logout` | POST | — | 200 `{ok:true}` + clear cookie | — |

**Response user shape** (konsisten, tidak expose `password_hash`):
```json
{ "id": 1, "email": "user@agent.io", "wallet_address": "0x...", "created_at": "...", "last_login_at": "..." }
```

**Cookie contract:**
- Name: `a2z-token`
- `HttpOnly=True`, `SameSite=Lax`, `Secure=True` (prod) / `False` (dev HTTP), `Path=/`
- `Max-Age=604800` (7 hari)

**Validasi input (di routes/auth.py):**
- `email`: regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`, di-lowercase + strip
- `password`: min 8 char
- `wallet_address`: opsional, regex `^0x[a-fA-F0-9]{40}$`
- Body malformed → 422

### 4.4 `backend/main.py` (UBAH)

- Mount `/api/auth` → `routes.auth.routes`
- Fix CORS (saat ini `allow_origins=["*"]` + `allow_credentials=True` — browser menolak kombinasi ini):
  ```python
  allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
  allow_credentials=True,
  ```

### 4.5 `backend/requirements.txt` (UBAH)

Tambah:
```
bcrypt>=4.0.0
PyJWT>=2.8.0
```

---

## 5. Detail Frontend

### 5.1 Struktur folder baru/ubah

```
dashboard/src/
├── middleware.ts                          ← BARU
├── lib/
│   ├── auth.ts                           ← BARU
│   └── api.ts                            ← BARU
├── components/
│   ├── AuthProvider.tsx                  ← BARU
│   └── landing/AgentScene.tsx            ← ADA (reuse bg auth)
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                    ← BARU
│   │   ├── login/page.tsx                ← BARU
│   │   └── register/page.tsx             ← BARU
│   ├── (landing)/page.tsx                ← UBAH
│   ├── (dashboard)/layout.tsx            ← UBAH
│   └── layout.tsx                        ← UBAH
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

**Catatan:** middleware Next.js berjalan di edge runtime — tidak bisa verify JWT signature secara reliable. Middleware hanya cek **keberadaan cookie**. Verifikasi signature tetap di backend (`/api/auth/me`). Aman karena semua akses data lewat backend yang verify. Jika token palsu ada di cookie, `/me` akan return 401 → AuthProvider set user null → redirect kembali ke login.

### 5.3 `lib/api.ts` — fetch wrapper

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
// fetch wrapper dengan credentials:'include', JSON parse, error throw
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
- `login/register` → POST, lalu `refresh()` untuk update state
- `logout` → POST /logout, clear state, `router.push('/login')`

### 5.6 `(auth)/layout.tsx`

```tsx
<AgentScene isTransitioning={false} onTransitionComplete={() => {}} />  // bg penuh
<div className="relative z-10 min-h-screen flex items-center justify-center p-4">
  {children}  {/* form card centered, responsive */}
</div>
```

### 5.7 `(auth)/login/page.tsx` & `register/page.tsx`

Komponen form **responsive wajib**:
- **Mobile (<640px):** full-width card, `w-full max-w-sm`, padding `p-6`, font size lebih besar untuk input (44px touch target)
- **Desktop (≥640px):** centered card `max-w-md`, `p-8`, shadow lebih besar, hover effects

**Elemen form:**
- Logo A2Z + heading ("Log In" / "Create Account")
- Email input
- Password input (+ confirm password di register)
- Remember me + forgot password (login only)
- Submit button dengan loading state (spinner + "Authenticating...")
- Divider "─── or ───"
- "🦊 Connect Wallet" button (register only — link alamat Base opsional)
- Link ke halaman lawan ("No account? Register" / "Already have an account? Log In")

**Aksesibilitas (mengikuti pola UI/UX Pro Max yang sudah ada):**
- `aria-label`, `aria-invalid` saat error, `aria-describedby` ke error message
- Error message `role="alert"`
- `focus-visible:ring-2` untuk keyboard nav
- Touch target ≥ 44×44px
- `role="form"`, label terkait via `<label htmlFor>`

**Animasi:** reuse motion pattern landing (fade/slide entrance, `motion.div` + `AnimatePresence`)

### 5.8 `Navbar.tsx` (UBAH)

- Import `useAuth()` dari AuthProvider
- Tambah badge `user.email` (truncated jika panjang) di sisi kanan
- Tambah tombol **Logout** (icon `LogOut` dari lucide-react) sebelum ThemeToggle
- Saat `loading=true` → tampilkan skeleton badge

### 5.9 `(landing)/page.tsx` (UBAH)

- Ganti semua `router.push("/dashboard")` → `router.push("/login")` di `handleEnterDashboard`
- 3 tombol ("Log In", "Launch App", "Enter Mission Control") semua menuju `/login`
- Middleware akan arahkan ke `/dashboard` otomatis jika user sudah punya cookie valid

---

## 6. Error Handling & UX

### 6.1 Error states (form)

| Skenario | Tampilan |
|----------|----------|
| Email kosong/format salah | inline error merah di bawah field + `aria-invalid` |
| Password < 8 char | inline error |
| Login gagal (401 backend) | toast error "Invalid email or password" |
| Register email sudah ada (409) | inline error "Email already registered" |
| Backend down / network error | toast error "Server unavailable. Is backend running?" |
| Wallet connect gagal | inline error "Could not connect wallet" |
| Loading submit | button disabled + spinner, text "Authenticating..." |

### 6.2 Loading states

- **Initial app load:** AuthProvider `loading=true` → Navbar tampilkan skeleton badge. Halaman dashboard tetap render (DashboardContext punya skeleton sendiri).
- **Form submit:** button spinner + disabled
- **`/me` 401 (token invalid/expired):** AuthProvider set `user=null`, biarkan middleware handle redirect di navigasi berikutnya

### 6.3 Protected route redirect flow

- User belum login + akses `/dashboard` → middleware redirect `/login?next=/dashboard` → setelah login sukses, AuthProvider redirect ke nilai `next` (default `/dashboard`)
- User sudah login + akses `/login` → middleware redirect `/dashboard`

---

## 7. Testing

### 7.1 Backend (Python)

- **Unit test `auth.py`:** hash/verify password (correct, wrong), create/decode JWT (valid, expired, tampered, wrong secret)
- **Integration test routes:** register → login → me → logout flow end-to-end; duplikat email → 409; login salah → 401; validasi input → 422
- Pakai SQLite in-memory atau mock `_get_cursor` untuk test (tanpa PostgreSQL nyala)
- File: `backend/tests/test_auth.py`

### 7.2 Frontend (Vitest — config sudah ada)

- **`AuthProvider.test.tsx`:** login sukses set user + redirect, logout clear user, `/me` 401 set user null
- **`middleware.test.ts`:** pure function test (input path+cookie → expected redirect destination)
- **`login.test.tsx` / `register.test.tsx`:** render form, validasi error muncul, submit calls `auth.login`/`auth.register`
- File: `dashboard/src/components/__tests__/auth.test.tsx`, `dashboard/src/lib/__tests__/auth.test.ts`

### 7.3 E2E (manual untuk demo)

- Daftar user baru → auto-login → lihat dashboard (data render)
- Logout → redirect ke landing
- Akses `/dashboard` tanpa login → redirect `/login`
- Akses `/login` saat sudah login → redirect `/dashboard`
- Responsive check: login/register di mobile (375px) dan desktop (1440px)

---

## 8. Implementation Phases (urutan kerja)

| Fase | Lingkup | Output verifiable |
|------|---------|-------------------|
| **1. Backend auth** | `database_schema_patch_users.sql` + `auth.py` + `routes/auth.py` + `requirements.txt` + `main.py` mount + CORS fix | `curl POST /api/auth/register` + `/login` + `/me` + `/logout` works |
| **2. Frontend lib + middleware** | `lib/auth.ts`, `lib/api.ts`, `middleware.ts` | Route protection aktif (redirect `/dashboard` → `/login`) |
| **3. AuthProvider + halaman auth** | `AuthProvider.tsx`, `(auth)/layout.tsx`, `(auth)/login/page.tsx`, `(auth)/register/page.tsx`, reuse AgentScene | Bisa daftar/login via UI, responsive |
| **4. Integrasi Navbar + landing** | Navbar logout/email badge, `(landing)/page.tsx` tombol ke `/login`, root layout wrap AuthProvider | End-to-end flow lengkap |
| **5. Testing** | backend `test_auth.py` + frontend `auth.test.tsx` + middleware test | `npm run test:e2e` + pytest pass |
| **6. Dokumentasi** | update `memory.md` (Sesi baru), `README.md` setup `JWT_SECRET` + `FRONTEND_ORIGIN` | Docs lengkap |

---

## 9. Scope (YAGNI)

### 9.1 Yang TERMASUK

- Login + register (email/password)
- Optional wallet connect saat register
- Middleware route protection
- AuthProvider Context
- Navbar user badge + logout
- Landing → /login redirect
- Backend endpoints + users table
- Unit + integration tests

### 9.2 Yang TIDAK TERMASUK (di luar scope)

- ❌ Password reset via email (forgot password link ada di UI tapi hanya placeholder)
- ❌ Email verification
- ❌ OAuth (Google/GitHub login)
- ❌ Full SIWE (Sign-In with Ethereum) — wallet connect di register hanya link address, bukan sign challenge
- ❌ Role-based access control (admin/user) — semua user sama
- ❌ Rate limiting login attempts
- ❌ 2FA / MFA
- ❌ User profile page / settings edit
- ❌ Session di multiple device management

### 9.3 Trade-off Penting

- **Middleware cek cookie eksistensi, bukan verify JWT** — tidak bisa verify signature di edge runtime. Aman karena backend tetap verify di `/me`. Jika token dipalsukan, akses data tetap ditolak backend.
- **Wallet connect "opsional" di register, bukan SIWE penuh** — menjaga kompleksitas tetap terkendali untuk hackathon. Link address saja, tidak sign challenge.
- **Forgot password hanya placeholder** — implementasi reset email butuh SMTP service, di luar scope demo.

---

## 10. File Inventory

### 10.1 Backend (4 baru, 2 ubah)

| File | Aksi | Deskripsi |
|------|------|-----------|
| `backend/database_schema_patch_users.sql` | BARU | Tabel users |
| `backend/auth.py` | BARU | Pure logic: hash, verify, JWT |
| `backend/routes/auth.py` | BARU | 4 endpoint auth |
| `backend/tests/test_auth.py` | BARU | Unit + integration test |
| `backend/main.py` | UBAH | Mount /api/auth + fix CORS |
| `backend/requirements.txt` | UBAH | + bcrypt, PyJWT |

### 10.2 Frontend (9 baru, 4 ubah)

| File | Aksi | Deskripsi |
|------|------|-----------|
| `dashboard/src/middleware.ts` | BARU | Route protection |
| `dashboard/src/lib/api.ts` | BARU | Fetch wrapper |
| `dashboard/src/lib/auth.ts` | BARU | Auth helpers |
| `dashboard/src/components/AuthProvider.tsx` | BARU | React Context |
| `dashboard/src/app/(auth)/layout.tsx` | BARU | Centered layout + AgentScene bg |
| `dashboard/src/app/(auth)/login/page.tsx` | BARU | Login form |
| `dashboard/src/app/(auth)/register/page.tsx` | BARU | Register form |
| `dashboard/src/components/__tests__/auth.test.tsx` | BARU | Test AuthProvider |
| `dashboard/src/lib/__tests__/auth.test.ts` | BARU | Test middleware + auth helpers |
| `dashboard/src/app/layout.tsx` | UBAH | Wrap AuthProvider di root (di dalam ToastProvider) |
| `dashboard/src/components/Navbar.tsx` | UBAH | + user badge + logout button |
| `dashboard/src/app/(landing)/page.tsx` | UBAH | Tombol → /login |

**(dashboard)/layout.tsx tidak diubah** — AuthProvider di root layout sudah mencakup semua route termasuk Navbar.

Total frontend: **9 file baru, 3 file diubah**.

### 10.3 Dokumentasi (2 ubah)

| File | Aksi | Deskripsi |
|------|------|-----------|
| `memory.md` | UBAH | Tambah Sesi baru dengan ringkasan pekerjaan |
| `README.md` | UBAH | Setup guide: `JWT_SECRET`, `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL` |

---

## 11. Acceptance Criteria

Implementasi dianggap selesai ketika SEMUA terpenuhi:

1. ✅ User bisa mendaftar via `/register` dengan email + password (+ opsional wallet)
2. ✅ User bisa login via `/login`, redirect ke `/dashboard` setelah sukses
3. ✅ Cookie `a2z-token` diset (httpOnly), persist setelah refresh & tutup browser
4. ✅ Akses `/dashboard/*` tanpa login → redirect `/login?next=...`
5. ✅ Akses `/login` saat sudah login → redirect `/dashboard`
6. ✅ Navbar menampilkan email user + tombol Logout berfungsi
7. ✅ Logout menghapus cookie, redirect ke landing
8. ✅ Password di-hash bcrypt di DB (tidak plain text)
9. ✅ Form login/register responsive di mobile (375px) & desktop (1440px)
10. ✅ Form accessible (aria, focus-visible, touch target ≥44px)
11. ✅ Backend test pass: `pytest backend/tests/test_auth.py`
12. ✅ Frontend test pass: `npm run test:e2e`
13. ✅ Error states tampil dengan benar (401, 409, 422, network error)
14. ✅ Landing page 3 tombol semua menuju `/login`
15. ✅ Tidak ada password_hash yang ter-expose di response API manapun
