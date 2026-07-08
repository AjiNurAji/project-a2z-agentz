export const WALLET_SESSION_KEY = "a2z-wallet-session";
export const WALLET_SESSION_COOKIE = "a2z-wallet-session";

export type WalletId = "metamask" | "coinbase" | "rabby" | "injected";
export type WalletStatus = "detected" | "available" | "install_required" | "open_wallet_browser";

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface WalletOption {
  id: WalletId;
  name: string;
  description: string;
  status: WalletStatus;
  provider?: Eip1193Provider;
}

export interface WalletSession {
  address: string;
  walletName: string;
  chainId?: string;
  connectedAt: string;
  frontendOnly: true;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function isMobileUserAgent() {
  if (!isBrowser()) return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
}

function allInjectedProviders(): Eip1193Provider[] {
  if (!isBrowser() || !window.ethereum) return [];
  const root = window.ethereum;
  return Array.isArray(root.providers) && root.providers.length > 0 ? root.providers : [root];
}

function fallbackStatus(): WalletStatus {
  return isMobileUserAgent() ? "open_wallet_browser" : "install_required";
}

export function detectWalletProviders(): WalletOption[] {
  const providers = allInjectedProviders();
  const findProvider = (predicate: (provider: Eip1193Provider) => boolean) => providers.find(predicate);

  const metamask = findProvider((provider) => provider.isMetaMask === true && provider.isRabby !== true);
  const coinbase = findProvider((provider) => provider.isCoinbaseWallet === true);
  const rabby = findProvider((provider) => provider.isRabby === true);
  const generic = providers.find((provider) => provider !== metamask && provider !== coinbase && provider !== rabby) ?? providers[0];
  const noProviderStatus = fallbackStatus();

  return [
    {
      id: "metamask",
      name: "MetaMask",
      description: "Browser extension or MetaMask mobile browser",
      status: metamask ? "detected" : noProviderStatus,
      provider: metamask,
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      description: "Coinbase Wallet extension or mobile browser",
      status: coinbase ? "detected" : noProviderStatus,
      provider: coinbase,
    },
    {
      id: "rabby",
      name: "Rabby",
      description: "Rabby browser wallet for EVM chains",
      status: rabby ? "detected" : noProviderStatus,
      provider: rabby,
    },
    {
      id: "injected",
      name: "Browser Wallet",
      description: "Generic injected EVM provider",
      status: generic ? "detected" : noProviderStatus,
      provider: generic,
    },
  ];
}

export function formatAddress(address: string) {
  if (!address) return "Not connected";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function saveWalletSession(session: WalletSession) {
  if (!isBrowser()) return;
  window.localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(session));
  document.cookie = `${WALLET_SESSION_COOKIE}=1; path=/; SameSite=Lax; Max-Age=2592000`;
  document.cookie = `a2z-token=guest; path=/; SameSite=Lax; Max-Age=2592000`;
}

export function getWalletSession(): WalletSession | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(WALLET_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WalletSession;
    if (!parsed.address || !parsed.walletName || parsed.frontendOnly !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWalletSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(WALLET_SESSION_KEY);
  document.cookie = `${WALLET_SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `a2z-token=; path=/; Max-Age=0; SameSite=Lax`;
}
