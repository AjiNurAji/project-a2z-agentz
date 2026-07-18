"use client";

import React, { useEffect } from "react";
import { Wallet, X, Loader2, ShieldAlert } from "lucide-react";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import type { WalletSession, WalletStatus } from "@/lib/wallet";

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: (session: WalletSession) => void;
  onContinue?: () => void;
  /** Zero-Friction: when supplied, selecting a wallet immediately triggers
   *  the full SIWE sign+verify flow (connect -> sign -> dashboard),
   *  collapsing the separate login/register barrier into one tap. */
  onSiweConnect?: () => void;
}

function statusLabel(status: WalletStatus) {
  if (status === "detected") return "Detected";
  if (status === "available") return "Available";
  if (status === "open_wallet_browser") return "Open in wallet browser";
  return "Install required";
}

function statusClass(status: WalletStatus) {
  if (status === "detected") return "text-[var(--color-fg-success)] bg-[var(--color-bg-success-subtle)] border-[var(--color-border-success)]";
  if (status === "open_wallet_browser") return "text-[var(--color-fg-info)] bg-[var(--color-bg-info-subtle)] border-[var(--color-border-info)]";
  return "text-[var(--color-fg-warning)] bg-[var(--color-bg-warning-subtle)] border-[var(--color-border-warning)]";
}

export default function WalletConnectModal({ open, onClose, onConnected, onContinue, onSiweConnect }: WalletConnectModalProps) {
  const wallet = useWalletConnect();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-md transition-all" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-connect-title"
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl transition-all"
        style={{
          background: "color-mix(in srgb, var(--color-surface) 90%, transparent)",
          border: "1px solid var(--color-border-default)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, var(--color-brand), var(--color-accent-purple))" }}>
              <Wallet className="h-5 w-5" aria-hidden="true" style={{ color: "#ffffff" }} />
            </div>
            <div>
              <h2 id="wallet-connect-title" className="text-lg font-bold" style={{ color: "var(--color-heading)" }}>Connect Wallet</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--color-body-subtle)" }}>Choose an EVM wallet for Base Network.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close wallet connect modal"
            className="rounded-lg p-2 focus-ring transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: "var(--color-body-subtle)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          {wallet.wallets.map((option) => (
            <button
              key={option.id}
              onClick={async () => {
                if (onSiweConnect) {
                  // Zero-Friction: one tap -> connect + SIWE sign + verify + dashboard.
                  onSiweConnect();
                  return;
                }
                const session = await wallet.connect(option);
                if (session) onConnected?.(session);
              }}
              disabled={wallet.state === "connecting"}
              aria-label={`Connect ${option.name}`}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all hover:border-[var(--color-border-brand)] hover:shadow-md disabled:opacity-60 focus-ring"
              style={{
                border: "1px solid var(--color-border-default)",
                background: "color-mix(in srgb, var(--color-neutral-secondary-soft) 40%, transparent)",
              }}
            >
              <div className="flex-1 min-w-0 pr-3">
                <span className="block text-sm font-semibold truncate" style={{ color: "var(--color-heading)" }}>{option.name}</span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--color-body-subtle)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{option.description}</span>
              </div>
              <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(option.status)}`}>{statusLabel(option.status)}</span>
            </button>
          ))}
        </div>

        {wallet.state === "connecting" && (
          <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: "var(--color-body-subtle)" }}>
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-fg-brand)]" aria-hidden="true" /> Waiting for wallet approval...
          </p>
        )}

        {wallet.error && (
          <p role="alert" className="mt-4 rounded-xl p-3 text-sm" style={{ color: "var(--color-fg-danger)", border: "1px solid rgba(239, 68, 68, 0.15)", background: "rgba(239, 68, 68, 0.05)" }}>
            {wallet.error}
          </p>
        )}

        <div className="mt-4 rounded-xl p-3 text-xs leading-relaxed" style={{ color: "var(--color-body-subtle)", border: "1px solid var(--color-border-default)", background: "color-mix(in srgb, var(--color-neutral-secondary-soft) 50%, transparent)" }}>
          One tap connects your wallet, signs the SIWE message, and drops you
          straight into the dashboard — a self-custodial wallet is created
          automatically for new addresses.
        </div>

        {wallet.session && (
          <div className="mt-4 rounded-xl p-4" style={{ color: "var(--color-fg-warning)", border: "1px solid rgba(245, 158, 11, 0.15)", background: "rgba(245, 158, 11, 0.05)" }}>
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-sm">Wallet login is live</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-fg-warning)]/80">
                  Connected as <span className="font-mono font-bold">{wallet.formattedAddress}</span>. Backend SIWE is ready — your signature authenticates you and a self-custodial vault is created automatically.
                </p>
              </div>
            </div>
            <button
              onClick={onContinue}
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.99] focus-ring"
              style={{
                background: "linear-gradient(135deg, #ffe2a0, #ffc65e)",
                color: "#16100a",
              }}
            >
              Continue to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
