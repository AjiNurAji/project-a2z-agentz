# Wallet Connect Hybrid Auth + A2A Dashboard Readiness — Design Spec

> **Tanggal:** 2026-06-21  
> **Scope:** Frontend `dashboard/` saja. Backend auth tetap email/password + JWT sampai backend memiliki SIWE/sign-in-with-wallet.  
> **Mockup preview:** `wallet-connect-mockups.html` di root proyek.  
> **Pilihan desain final:** Opsi B — Modal Wallet Selector.

---

## 1. Tujuan

Tambahkan wallet connect pada halaman login/register dengan deteksi wallet EVM multi-provider, sambil mempertahankan pendekatan hybrid:

1. Frontend dapat connect wallet dan membuat wallet session lokal.
2. User dapat melanjutkan ke dashboard melalui wallet session frontend-only.
3. UI secara eksplisit memperingatkan bahwa backend SIWE/sign-in-with-wallet belum tersedia.
4. Backend auth saat ini tetap email/password + JWT cookie.
5. Dashboard menampilkan section baru yang cocok dengan Agent-to-Agent backend: status wallet session, status backend auth, dan status A2A WebSocket.
6. Perbaiki error frontend yang mengganggu dalam scope wallet/auth/dashboard: SSR safety, wallet typing, modal accessibility, dan error handling.

---

## 2. Keputusan Desain

| Area | Keputusan | Alasan |
|---|---|---|
| Wallet UX | **Modal Wallet Selector** | Paling profesional dan scalable untuk multi-wallet. |
| Wallet target | Multi-wallet EVM UX dengan Base/EVM sebagai inti | Cocok dengan Base Network dan existing Web3 product direction. |
| Providers | MetaMask, Coinbase Wallet, Rabby, Generic injected EIP-1193 provider | Provider paling relevan untuk browser extension/desktop/mobile wallet browser. |
| Auth model | Hybrid frontend wallet session + backend email/password | Backend belum punya SIWE; jangan klaim backend-authenticated wallet login. |
| Wallet login behavior | Hard redirect dengan warning dan tombol Continue | User bisa demo wallet login, tetapi warning mengingatkan backend task ke teman developer. |
| Dashboard addition | `A2A Identity & Backend Readiness` section | Menjelaskan status identity/auth/A2A secara eksplisit. |
| Register behavior | Connected wallet dapat mengisi/menautkan wallet address otomatis | Lebih baik daripada input wallet manual saja. |
| No WalletConnect QR | Tidak masuk scope | User minta extension/mobile/desktop detection; QR bisa future milestone. |
| No SIWE backend | Tidak masuk scope | Backend sign-in-with-wallet belum tersedia. |

---

## 3. Login/Register Wallet Connect Design

### 3.1 User Flow

1. User membuka `/login` atau `/register`.
2. User klik tombol `Connect Wallet`.
3. App membuka modal overlay `Connect Wallet`.
4. Modal menampilkan daftar wallet EVM berdasarkan deteksi runtime:
   - MetaMask
   - Coinbase Wallet
   - Rabby
   - Browser / Generic Injected Wallet
5. Setiap wallet memiliki badge status:
   - `Detected`
   - `Available`
   - `Install required`
   - `Open in wallet browser`
6. User memilih wallet.
7. App request account via EIP-1193:
   - `eth_requestAccounts`
8. Jika connect berhasil:
   - App menyimpan wallet session lokal.
   - Modal menampilkan shortened address, contoh `0x12...89ab`.
   - Modal menampilkan warning bahwa wallet login masih frontend-only sampai SIWE backend tersedia.
9. User klik `Continue to dashboard`.
10. App redirect ke `/dashboard`.

### 3.2 Login Page Behavior

Halaman login tetap mempertahankan email/password sebagai primary backend-authenticated auth path.

Tombol wallet connect menjadi secondary path:

- Label: `Connect Wallet`
- Tidak memakai emoji sebagai structural icon; gunakan icon vector/Lucide.
- Klik membuka modal, bukan inline dropdown.
- Setelah wallet connect, user tidak otomatis redirect tanpa membaca warning; user harus klik `Continue to dashboard`.

Wallet-only login state tidak boleh menampilkan copy seperti “Authenticated with backend”. Copy yang benar:

> Wallet session active. Backend SIWE is pending.

### 3.3 Register Page Behavior

Halaman register tetap mempertahankan email/password sebagai backend registration path.

Wallet connect pada register memiliki tambahan:

- Setelah connect berhasil, wallet address otomatis diisi/ditampilkan sebagai linked wallet.
- Jika existing register form masih memiliki input wallet address manual, input dapat menjadi read-only/auto-filled saat wallet session ada, dengan opsi disconnect/change.
- Submit register tetap menggunakan email/password backend flow saat user menekan create account.

### 3.4 Modal Content

Modal layout:

- Overlay backdrop blur/dim.
- Container card dengan title, subtitle, close button.
- Wallet list buttons dengan provider name, description/status, badge.
- Info note:

```txt
Wallet login currently creates a frontend-only session until backend SIWE is implemented.
```

After successful connect:

```txt
Wallet login is frontend-only until backend SIWE is ready.
This session can open the dashboard, but protected backend auth still requires email/password.
```

Primary success action:

```txt
Continue to dashboard
```

Secondary action:

```txt
Use email/password instead
```

### 3.5 Error Handling

| Case | UI Behavior |
|---|---|
| No injected provider | Show install/open wallet browser guidance. |
| Desktop no wallet | Show install hints for MetaMask/Coinbase/Rabby. |
| Mobile normal browser | Show `Open this page in MetaMask/Coinbase wallet browser`. |
| User rejects request | Show `Connection rejected. Please approve the request in your wallet.` |
| Provider request fails | Show retry action. |
| Wrong chain | Show `Base Network recommended`; do not block in first version. |
| SSR access | Never access `window` outside client-side guards/effects. |

---

## 4. Wallet Detection Design

### 4.1 Provider Interface

Use a minimal EIP-1193-compatible interface rather than adding a heavy wallet library.

```ts
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
}
```

Global type extension should be isolated in a wallet typing file or local module declaration.

### 4.2 Detection Rules

1. If `window.ethereum.providers` exists, inspect each provider.
2. Detect known providers:
   - `provider.isMetaMask`
   - `provider.isCoinbaseWallet`
   - `provider.isRabby`
3. If no known flag but provider exists, expose `Browser Wallet` / `Injected Wallet`.
4. If none exists:
   - Desktop: status `Install required`.
   - Mobile: status `Open in wallet browser`.

### 4.3 Wallet Session Storage

Store only non-sensitive session metadata in localStorage:

```ts
interface WalletSession {
  address: string;
  walletName: string;
  chainId?: string;
  connectedAt: string;
  frontendOnly: true;
}
```

Storage key:

```txt
a2z-wallet-session
```

Do not store private keys, signatures, tokens, or secrets.

---

## 5. Dashboard Section Design

### 5.1 Component

Add a new dashboard component:

```txt
dashboard/src/components/A2AIdentityReadiness.tsx
```

### 5.2 Placement

Add it to:

```txt
dashboard/src/app/(dashboard)/dashboard/page.tsx
```

Recommended placement:

1. `PageHeader`
2. `DashboardKpis`
3. `A2AIdentityReadiness`
4. `CircuitBreaker`
5. Existing A2A panels/logs/transactions

### 5.3 UI Content

Title:

```txt
Identity Handshake Status
```

Eyebrow:

```txt
Agent-to-Agent Backend
```

Description:

```txt
Tracks wallet session, backend auth readiness, and A2A WebSocket state.
```

Status badge:

```txt
SIWE Pending
```

Cards:

1. **Wallet Session**
   - Connected: show wallet name and shortened address.
   - Not connected: show `Not connected`.
2. **Backend Auth**
   - Email/JWT user: `JWT Authenticated`.
   - Wallet-only session: `Frontend wallet session`.
   - Unknown/offline: `Auth unknown`.
3. **A2A WebSocket**
   - Use `wsStatus` from dashboard context:
     - `connected` → `Connected`
     - `connecting` → `Connecting`
     - `disconnected` → `Fallback / Demo Mode`

Callout copy:

```txt
Wallet connect is ready on the frontend. Backend sign-in-with-wallet is pending.
Next backend milestone: add SIWE challenge/verify endpoint and issue the same auth cookie used by email login.
```

### 5.4 Dashboard Auth Semantics

If the app currently has route middleware that blocks `/dashboard` without backend JWT, implementation must choose the smallest safe change that allows frontend-only wallet sessions to view the dashboard without claiming protected backend access.

Preferred behavior:

- Email/password login: current JWT-authenticated flow unchanged.
- Wallet-only session: allow dashboard route on frontend if local wallet session exists.
- Protected API calls may still fail/401; dashboard should already support fallback/mock where applicable.
- Section must clearly show `Frontend wallet session` and `SIWE Pending`.

---

## 6. Frontend Error Fix Scope

Implementation must address errors likely to arise from wallet auth and existing frontend behavior:

1. **TypeScript wallet typing**
   - Add EIP-1193 provider types to avoid `window.ethereum` compile errors.
2. **SSR safety**
   - Guard `window`, `localStorage`, and provider access.
3. **Modal accessibility**
   - `role="dialog"`
   - `aria-modal="true"`
   - descriptive label/title
   - close button
   - Escape key closes modal
   - visible focus states
4. **No emoji structural icon**
   - Replace wallet emoji in login with vector icon.
5. **Clear connection state**
   - idle, detecting, connecting, connected, error.
6. **Error messages**
   - Display actionable recovery text near wallet selector.
7. **Route/auth clarity**
   - Wallet-only dashboard access is frontend session, not backend auth.

---

## 7. Components and Modules

Proposed files:

```txt
dashboard/src/lib/wallet.ts
dashboard/src/hooks/useWalletConnect.ts
dashboard/src/components/WalletConnectModal.tsx
dashboard/src/components/A2AIdentityReadiness.tsx
```

Possible test files:

```txt
dashboard/src/lib/__tests__/wallet.test.ts
dashboard/src/components/__tests__/WalletConnectModal.test.tsx
dashboard/src/components/__tests__/A2AIdentityReadiness.test.tsx
```

Existing files likely modified:

```txt
dashboard/src/app/(auth)/login/page.tsx
dashboard/src/app/(auth)/register/page.tsx
dashboard/src/app/(dashboard)/dashboard/page.tsx
dashboard/src/middleware.ts
dashboard/src/components/AuthProvider.tsx or related auth helper if route semantics require it
```

The implementation should keep file boundaries small. Wallet provider detection belongs in `lib/wallet.ts`; React state belongs in `useWalletConnect`; UI belongs in modal/dashboard components.

---

## 8. Testing Strategy

### 8.1 Unit Tests

Test wallet detection:

- no `window`
- no provider
- single MetaMask provider
- Coinbase provider
- Rabby provider
- multiple providers via `ethereum.providers`
- generic injected provider
- mobile user-agent/no provider hint

Test wallet session helpers:

- save session
- read session
- clear session
- invalid JSON fallback
- SSR-safe no-op/fallback

### 8.2 Component Tests

Wallet modal:

- opens with wallet options
- shows detected badges
- calls provider `eth_requestAccounts`
- shows connected address
- shows frontend-only SIWE warning
- handles rejected connection
- close button works

Dashboard section:

- no wallet session state
- wallet session connected state
- backend JWT user state if available
- ws connected/connecting/disconnected labels

### 8.3 Verification Commands

Run from `dashboard/`:

```bash
npm run lint
npm run test:e2e
npm run build
```

If existing tests have known unrelated failures, document them with exact output and still verify changed units where possible.

---

## 9. Out of Scope / Future Milestones

Not included in this implementation:

1. Backend SIWE challenge endpoint.
2. Backend SIWE verify endpoint.
3. Issuing JWT cookie after wallet signature.
4. WalletConnect QR modal.
5. Signing arbitrary messages/transactions for auth.
6. Auto switching to Base chain.
7. Persisting wallet identity server-side.

Recommended backend follow-up:

```txt
POST /api/auth/wallet/challenge
POST /api/auth/wallet/verify
```

Verify endpoint should issue the same `a2z-token` auth cookie used by email/password login after validating SIWE signature.

---

## 10. Acceptance Criteria

1. Login and register pages have `Connect Wallet` button that opens a modal wallet selector.
2. Modal detects MetaMask, Coinbase Wallet, Rabby, and generic injected EVM providers.
3. Modal handles desktop/mobile/no-wallet states.
4. Successful wallet connection stores a frontend-only wallet session locally.
5. Successful wallet connection shows a clear SIWE/backend warning before dashboard continuation.
6. User can continue to dashboard from wallet session without email/password.
7. Dashboard includes `A2A Identity & Backend Readiness` section.
8. Dashboard section displays wallet session, backend auth readiness, and A2A WebSocket status.
9. Register page can auto-fill/link connected wallet address.
10. Frontend avoids `window.ethereum` TypeScript/SSR runtime errors.
11. Modal is keyboard-accessible and has clear close/error states.
12. Tests/verification cover wallet detection, modal behavior, dashboard section, lint, and build.
