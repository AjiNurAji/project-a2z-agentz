"use client";
import { useDashboard } from "./DashboardContext";
import { ShieldOff, ShieldCheck, AlertTriangle } from "lucide-react";

export default function CircuitBreaker() {
  const { isPaused, setIsPaused } = useDashboard();

  return (
    <div className={`glass-card p-5 border transition-all duration-500 ${isPaused ? "border-brand-red/50 bg-brand-red/5" : "border-white/5"}`}>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isPaused ? "bg-brand-red/15" : "bg-slate-800"}`}>
            {isPaused
              ? <ShieldOff className="w-5 h-5 text-brand-red" aria-hidden="true" />
              : <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden="true" />
            }
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-white flex items-center gap-2">
              Circuit Breaker
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isPaused ? "border-brand-red/40 bg-brand-red/10 text-brand-red" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"}`}>
                {isPaused ? "PAUSED" : "ACTIVE"}
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">Emergency Kill Switch — halts all Agent B on-chain activity instantly.</p>
          </div>
        </div>

        <button
          onClick={() => setIsPaused(!isPaused)}
          aria-pressed={isPaused}
          aria-label={isPaused ? "Resume automated payouts" : "Pause automated payouts"}
          className={`relative inline-flex h-12 w-24 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 shadow-inner ${isPaused ? "bg-brand-red hover:bg-red-500 shadow-lg shadow-brand-red/25" : "bg-slate-700 hover:bg-slate-600"}`}
        >
          <span className={`pointer-events-none inline-flex h-11 w-11 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-in-out items-center justify-center ${isPaused ? "translate-x-12" : "translate-x-0"}`}>
            {isPaused
              ? <ShieldOff className="h-5 w-5 text-brand-red" aria-hidden="true" />
              : <ShieldCheck className="h-5 w-5 text-slate-400" aria-hidden="true" />
            }
          </span>
        </button>
      </div>

      {isPaused && (
        <div role="alert" aria-live="assertive" className="mt-4 p-4 bg-brand-red/10 border border-brand-red/30 rounded-lg text-brand-red text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 animate-pulse" aria-hidden="true" />
          <p><strong>SYSTEM PAUSED:</strong> All automated payouts are blocked. Agent B will not broadcast any transactions until you resume operations.</p>
        </div>
      )}
    </div>
  );
}
