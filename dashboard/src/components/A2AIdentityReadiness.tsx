"use client";

import React, { useEffect, useState } from "react";
import { Link2, ShieldCheck, Radio } from "lucide-react";
import { formatAddress, getWalletSession, type WalletSession } from "@/lib/wallet";
import type { User } from "@/lib/auth";

interface Props {
  wsStatus: "connecting" | "connected" | "disconnected";
  user: User | null;
}

function wsLabel(status: Props["wsStatus"]) {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting";
  // WebSocket may be blocked by browser CORS in some setups, but the
  // dashboard still receives live agent data via /api/status polling.
  return "Live (polling)";
}

export default function A2AIdentityReadiness({ wsStatus, user }: Props) {
  const [session, setSession] = useState<WalletSession | null>(null);

  useEffect(() => {
    setSession(getWalletSession());
  }, []);

  const walletConnected = Boolean(session?.address);
  const backendAuthTitle = user ? "JWT Authenticated" : walletConnected ? "Frontend wallet session" : "Auth unknown";
  const backendAuthDescription = user ? "Email/password backend session active" : walletConnected ? "SIWE endpoint needed" : "Backend unavailable or not signed in";

  return (
    <section className="rounded-2xl border p-5" style={{ background: "color-mix(in srgb, var(--color-surface) 84%, transparent)", borderColor: "var(--color-border-default)" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--color-fg-purple)" }}>Trading Backend</p>
          <h2 className="mt-1 text-xl font-bold" style={{ color: "var(--color-heading)" }}>Identity Handshake Status</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-body-subtle)" }}>Tracks wallet session, backend auth readiness, and A2A WebSocket state.</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ color: "var(--color-fg-warning)", borderColor: "var(--color-border-warning)", background: "var(--color-bg-warning-subtle)" }}>SIWE Pending</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}>
          <Link2 className="h-4 w-4" style={{ color: "var(--color-fg-success)" }} aria-hidden="true" />
          <p className="mt-3 text-xs" style={{ color: "var(--color-body-subtle)" }}>Wallet Session</p>
          <h3 className="mt-2 font-semibold" style={{ color: walletConnected ? "var(--color-fg-success)" : "var(--color-body)" }}>{walletConnected ? "Connected" : "Not connected"}</h3>
          <p className="mt-1 text-xs font-mono" style={{ color: "var(--color-body-subtle)" }}>{walletConnected ? `${session?.walletName} · ${formatAddress(session?.address ?? "")}` : "Use Connect Wallet from login/register"}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}>
          <ShieldCheck className="h-4 w-4" style={{ color: user ? "var(--color-fg-success)" : "var(--color-fg-warning)" }} aria-hidden="true" />
          <p className="mt-3 text-xs" style={{ color: "var(--color-body-subtle)" }}>Backend Auth</p>
          <h3 className="mt-2 font-semibold" style={{ color: user ? "var(--color-fg-success)" : "var(--color-fg-warning)" }}>{backendAuthTitle}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-body-subtle)" }}>{backendAuthDescription}</p>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-border-default)", background: "var(--color-neutral-secondary-medium)" }}>
          <Radio className="h-4 w-4" style={{ color: "var(--color-fg-cyan)" }} aria-hidden="true" />
          <p className="mt-3 text-xs" style={{ color: "var(--color-body-subtle)" }}>A2A WebSocket</p>
          <h3 className="mt-2 font-semibold" style={{ color: "var(--color-fg-cyan)" }}>{wsLabel(wsStatus)}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-body-subtle)" }}>Agent A ↔ Agent B sync</p>
        </div>
      </div>

      <p className="mt-4 rounded-xl border p-3 text-xs leading-relaxed" style={{ color: "var(--color-fg-cyan)", borderColor: "var(--color-border-brand)", background: "var(--color-bg-info-subtle)" }}>
        Wallet connect (SIWE) is live on both frontend and backend. Sign in with MetaMask or scan the WalletConnect QR from any mobile wallet — both issue the same JWT session as email login.
      </p>
    </section>
  );
}
