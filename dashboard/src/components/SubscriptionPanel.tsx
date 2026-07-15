"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/lib/api";
import { useToast } from "./ui/Toast";
import { CreditCard, Check, Loader2 } from "lucide-react";

const PLANS = [
  { id: "free", name: "Free", price: "0 USDC", desc: "3 trades/day · demo mode" },
  { id: "pro", name: "Pro", price: "29 USDC", desc: "Unlimited trades · priority RPC" },
  { id: "enterprise", name: "Enterprise", price: "199 USDC", desc: "Multi-wallet · API access" },
];

export default function SubscriptionPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState<string>("pro");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [vault, setVault] = useState("");
  const [activePlan, setActivePlan] = useState<string>("");

  // Fetch plan catalog (includes payment vault address)
  const loadPlans = async () => {
    try {
      const data = await apiFetch<{ payment_vault_address: string; plans: any[] }>("/api/plans");
      setVault(data.payment_vault_address || "");
    } catch {
      /* ignore */
    }
  };
  if (!vault && typeof window !== "undefined" && !vault) {
    loadPlans();
  }

  const handleVerify = async () => {
    if (!user) {
      toast.error("Not authenticated", "Please log in first.");
      return;
    }
    if (!txHash.trim()) {
      toast.error("Missing TxHash", "Paste the USDC transfer transaction hash.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ ok: boolean; plan?: string; error?: string }>("/api/verify-payment", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, tx_hash: txHash.trim(), plan: selected }),
      });
      if (res.ok) {
        setActivePlan(selected);
        toast.success("Plan Activated", `${selected.toUpperCase()} active for 30 days.`);
      } else {
        toast.error("Verification Failed", res.error || "Transaction not valid.");
      }
    } catch (e: any) {
      toast.error("Error", e?.message || "Could not verify payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--color-brand-softer)", color: "var(--color-fg-brand-strong)" }}>
          <CreditCard size={16} />
        </div>
        <div>
          <h4 className="font-serif" style={{ color: "var(--color-heading)" }}>Subscription Plan</h4>
          <p className="text-xs" style={{ color: "var(--color-body-subtle)" }}>Crypto-native · pay with USDC on Base</p>
        </div>
      </div>

      {/* Plan selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className="text-left p-3 rounded-xl border transition-colors"
            style={{
              borderColor: selected === p.id ? "var(--color-fg-brand-strong)" : "var(--color-border-default)",
              background: selected === p.id ? "var(--color-brand-softer)" : "transparent",
            }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--color-heading)" }}>{p.name}</p>
            <p className="text-lg font-bold font-mono" style={{ color: "var(--color-fg-brand-strong)" }}>{p.price}</p>
            <p className="text-[11px]" style={{ color: "var(--color-body-subtle)" }}>{p.desc}</p>
          </button>
        ))}
      </div>

      {/* Payment vault + QR placeholder */}
      {selected !== "free" && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg" style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-default)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-body-subtle)" }}>Send {selected === "pro" ? "29" : "199"} USDC (Base) to:</p>
            <p className="text-xs font-mono break-all mt-1" style={{ color: "var(--color-heading)" }}>{vault || "PAYMENT_VAULT_ADDRESS (configure in backend)"}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--color-body-subtle)" }}>USDC contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--color-heading)" }}>Transaction Hash (TxHash)</label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2.5 text-sm rounded-lg font-mono focus:outline-none focus:ring-1"
              style={{ background: "var(--color-neutral-secondary-medium)", border: "1px solid var(--color-border-default)", color: "var(--color-heading)" }}
            />
          </div>

          <button
            onClick={handleVerify}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all btn-glint"
            style={{ background: "var(--color-brand)", color: "#fff", borderRadius: "var(--radius-base)" }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {loading ? "Verifying..." : "Verify & Activate"}
          </button>
        </div>
      )}

      {activePlan && (
        <p className="text-xs font-medium" style={{ color: "var(--color-fg-brand-strong)" }}>
          ✅ {activePlan.toUpperCase()} plan active.
        </p>
      )}

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-body-subtle)" }}>
        Zero-budget crypto-native model: send USDC from your wallet, paste the TxHash, and the system
        verifies on-chain. No Stripe, no KYC. Support: archbusins@gmail.com · archbusins.web.id
      </p>
    </div>
  );
}
