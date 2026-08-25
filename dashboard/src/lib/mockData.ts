// Mock dataset for Guest / Demo mode.
//
// When a user clicks "Continue as Demo / Guest", we must NOT hit the real
// Railway backend (no auth, no live trades shown to judges as real). All
// dashboard data is served from this file instead. Shapes mirror the real
// backend responses so the UI renders identically.

export const isGuestSession = (): boolean =>
  typeof window !== "undefined" &&
  (localStorage.getItem("a2z-guest-session") === "1" ||
    localStorage.getItem("a2z-wallet-session") === "demo");

export interface MockTransaction {
  id: string;
  projectName: string;
  targetAddress: string;
  amountUsd: number;
  status: "success" | "failed" | "pending";
  txHash: string;
  timestamp: Date;
  reason: string;
  gasUsedGwei: number;
}

export interface MockApprovalItem {
  id: string;
  projectName: string;
  targetAddress: string;
  amountUsd: number;
  reason: string;
  llmScore: number;
  createdAt: Date;
  signature: string;
}

export interface MockAgentMessage {
  id: string;
  sender: "agent_a" | "agent_b" | "system";
  content: string;
  timestamp: Date;
  status: "sending" | "sent" | "processing" | "done" | "error";
  metadata?: { txHash?: string; score?: number; projectName?: string; amountUsd?: number };
}

export interface MockLogEntry {
  id: string;
  timestamp: Date;
  level: "INFO" | "WARN" | "SUCCESS" | "ERROR" | "AGENT_A" | "AGENT_B";
  message: string;
}

function addr(): string {
  return "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
}
function txhash(): string {
  return "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
}

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000);

export const MOCK_TRANSACTIONS: MockTransaction[] = [
  { id: "tx_1", projectName: "Aerodrome Finance", targetAddress: addr(), amountUsd: 1.84, status: "success", txHash: txhash(), timestamp: minsAgo(8), reason: "Autonomous Execution (Agent B)", gasUsedGwei: 0.012 },
  { id: "tx_2", projectName: "DEGEN", targetAddress: addr(), amountUsd: 0.42, status: "success", txHash: txhash(), timestamp: minsAgo(23), reason: "Autonomous Execution (Agent B)", gasUsedGwei: 0.009 },
  { id: "tx_3", projectName: "Brett", targetAddress: addr(), amountUsd: 2.31, status: "success", txHash: txhash(), timestamp: minsAgo(51), reason: "Approved via Queue", gasUsedGwei: 0.015 },
  { id: "tx_4", projectName: "morpho", targetAddress: addr(), amountUsd: 0.97, status: "success", txHash: txhash(), timestamp: minsAgo(94), reason: "Autonomous Execution (Agent B)", gasUsedGwei: 0.011 },
  { id: "tx_5", projectName: "cbETH", targetAddress: addr(), amountUsd: 5.12, status: "success", txHash: txhash(), timestamp: minsAgo(140), reason: "Autonomous Execution (Agent B)", gasUsedGwei: 0.021 },
];

export const MOCK_APPROVAL_QUEUE: MockApprovalItem[] = [
  { id: "ap_1", projectName: "Compound", targetAddress: addr(), amountUsd: 1.20, reason: "Agent B queued — cap within autonomous limit", llmScore: 91, createdAt: minsAgo(3), signature: "0x" + "ab".repeat(32) },
  { id: "ap_2", projectName: "BaseSwap", targetAddress: addr(), amountUsd: 0.66, reason: "Agent B queued — high conviction", llmScore: 88, createdAt: minsAgo(11), signature: "0x" + "cd".repeat(32) },
];

export const MOCK_VECTOR_MEMORY = [
  { id: "vm_1", projectName: "Aerodrome Finance", contractAddress: addr(), similarityScore: 0.94, embeddingStatus: "indexed" as const, source: "Farcaster" as const, tvl: 184_200_000, indexedAt: minsAgo(120) },
  { id: "vm_2", projectName: "DEGEN", contractAddress: addr(), similarityScore: 0.81, embeddingStatus: "indexed" as const, source: "On-Chain" as const, tvl: 92_400_000, indexedAt: minsAgo(240) },
  { id: "vm_3", projectName: "ScamTokenX", contractAddress: addr(), similarityScore: 0.12, embeddingStatus: "blacklisted" as const, source: "On-Chain" as const, tvl: 1_200, indexedAt: minsAgo(400) },
];

export const MOCK_AGENT_MESSAGES: MockAgentMessage[] = [
  { id: "am_1", sender: "agent_a", content: "Scanned Farcaster + Base explorers. Aerodrome Finance scored 92/100 (conviction high). Forwarding to Agent B.", timestamp: minsAgo(9), status: "done", metadata: { score: 92, projectName: "Aerodrome Finance" } },
  { id: "am_2", sender: "agent_b", content: "Validated Aerodrome payload. Guardrail passed. Broadcasting secure transfer on Base L2 — $1.84.", timestamp: minsAgo(8), status: "done", metadata: { txHash: MOCK_TRANSACTIONS[0].txHash, projectName: "Aerodrome Finance", amountUsd: 1.84 } },
  { id: "am_3", sender: "agent_a", content: "DEGEN scored 88/100. Social sentiment trending up.", timestamp: minsAgo(24), status: "done", metadata: { score: 88, projectName: "DEGEN" } },
  { id: "am_4", sender: "system", content: "Compound queued for human approval ($1.20). Within autonomous cap.", timestamp: minsAgo(3), status: "done" },
];

export const MOCK_LOGS: MockLogEntry[] = [
  { id: "lg_1", timestamp: minsAgo(8), level: "AGENT_B", message: "Executed Aerodrome Finance — tx 0x… success, gas 0.012 gwei" },
  { id: "lg_2", timestamp: minsAgo(9), level: "AGENT_A", message: "Aerodrome Finance conviction 92/100 — forwarding to Vault" },
  { id: "lg_3", timestamp: minsAgo(23), level: "SUCCESS", message: "DEGEN executed $0.42" },
  { id: "lg_4", timestamp: minsAgo(51), level: "SUCCESS", message: "Brett approved via queue $2.31" },
  { id: "lg_5", timestamp: minsAgo(140), level: "INFO", message: "cbETH executed $5.12" },
];

export const MOCK_KPI = {
  totalTvlAnalyzed: 412_500_000,
  successRate: 98.6,
  totalTransactions: 1342,
  gasSavedUsd: 107.36,
  projectsScanned: 5871,
  activeAlerts: MOCK_APPROVAL_QUEUE.length,
};

function hist24(start: number, step: number): { time: string; gwei: number }[] {
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now - (23 - i) * 3_600_000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    gwei: +(start + Math.sin(i / 3) * step + (i % 5) * 0.002).toFixed(3),
  }));
}
function tvl30(): { time: string; tvl: number }[] {
  return Array.from({ length: 30 }, (_, i) => ({ time: `Day ${i + 1}`, tvl: Math.round(300_000_000 + i * 4_200_000 + (i % 7) * 1_500_000) }));
}
function success7(): { time: string; success: number; failed: number }[] {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({ time: d, success: 180 + i * 11, failed: i % 3 }));
}

export const MOCK_GAS_HISTORY = hist24(0.012, 0.006);
export const MOCK_TVL_HISTORY = tvl30();
export const MOCK_SUCCESS_HISTORY = success7();

// ── agents/page.tsx shapes ──
export const MOCK_HOLDINGS = {
  holding: [
    { symbol: "AERO", name: "Aerodrome Finance", amount: 1240.5, value_usd: 842.1, pnl_pct: 12.4, address: addr() },
    { symbol: "DEGEN", name: "DEGEN", amount: 58210, value_usd: 410.3, pnl_pct: -4.1, address: addr() },
    { symbol: "BRETT", name: "Brett", amount: 3100, value_usd: 233.7, pnl_pct: 28.9, address: addr() },
    { symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", amount: 0.31, value_usd: 1082.4, pnl_pct: 6.2, address: addr() },
  ],
  sold: [
    { symbol: "TOSHI", name: "Toshi", amount: 9900, value_usd: 61.2, pnl_pct: -18.3, address: addr() },
  ],
};

export const MOCK_LIMIT_ORDERS = [
  { order_id: 9001, symbol: "AERO", side: "sell", price: 0.72, amount: 500, status: "open", created_at: minsAgo(35).toISOString() },
  { order_id: 9002, symbol: "DEGEN", side: "buy", price: 0.0061, amount: 20000, status: "open", created_at: minsAgo(72).toISOString() },
];

export const MOCK_SMART_BUYS = [
  { id: "sb_1", symbol: "MORPHO", name: "morpho", score: 90, reason: "Rising TVL + positive sentiment", address: addr(), price_usd: 2.14 },
  { id: "sb_2", symbol: "BASESWAP", name: "BaseSwap", score: 84, reason: "Oversold bounce setup", address: addr(), price_usd: 0.19 },
];

// ─── Live simulation for Guest / Demo mode ───────────────────
// Keeps the dashboard feeling alive without ever touching the real backend:
// gas ticks, new autonomous executions stream in, agent chat writes itself,
// KPI counters climb. Pure client-side intervals, no network calls.

function clock(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const GUEST_PROJECTS = [
  "Aerodrome Finance", "DEGEN", "Brett", "morpho", "cbETH", "Compound",
  "BaseSwap", "Moonwell", "TOSHI", "AERO", "Reserve", "ExtraFi", "Sushi",
];

export interface GuestSimHandlers {
  setTransactions: (u: (prev: any[]) => any[]) => void;
  setAgentMessages: (u: (prev: any[]) => any[]) => void;
  setLogs: (u: (prev: any[]) => any[]) => void;
  setKpiMetrics: (u: (prev: any) => any) => void;
  setGasHistory: (u: (prev: any[]) => any[]) => void;
  setTvlHistory: (u: (prev: any[]) => any[]) => void;
  setSuccessHistory: (u: (prev: any[]) => any[]) => void;
}

export function startGuestSimulation(h: GuestSimHandlers): () => void {
  const id = setInterval(() => {
    h.setGasHistory((prev: any[]) =>
      [...prev.slice(1), { time: clock(), gwei: +(0.006 + Math.random() * 0.022).toFixed(3) }]
    );
    h.setTvlHistory((prev: any[]) => {
      const c = [...prev];
      if (c.length) {
        const last = { ...c[c.length - 1] };
        last.tvl = Math.round(last.tvl + Math.random() * 3_000_000);
        c[c.length - 1] = last;
      }
      return c;
    });

    if (Math.random() < 0.55) {
      const p = GUEST_PROJECTS[Math.floor(Math.random() * GUEST_PROJECTS.length)];
      const amt = +(Math.random() * 4 + 0.1).toFixed(2);
      const hash = txhash();
      h.setTransactions((prev: any[]) =>
        [
          {
            id: "tx_" + Date.now(),
            projectName: p,
            targetAddress: addr(),
            amountUsd: amt,
            status: "success",
            txHash: hash,
            timestamp: new Date(),
            reason: "Autonomous Execution (Agent B)",
            gasUsedGwei: +(Math.random() * 0.03).toFixed(3),
          },
          ...prev,
        ].slice(0, 50)
      );
      h.setAgentMessages((prev: any[]) =>
        [
          {
            id: "am_" + Date.now(),
            sender: "agent_b",
            content: `Validated ${p} payload. Guardrail passed. Broadcasting secure transfer on Base L2 — $${amt}.`,
            timestamp: new Date(),
            status: "done",
            metadata: { txHash: hash, projectName: p, amountUsd: amt },
          },
          ...prev,
        ].slice(-50)
      );
      h.setLogs((prev: any[]) =>
        [
          {
            id: "lg_" + Date.now(),
            timestamp: new Date(),
            level: "AGENT_B",
            message: `Executed ${p} — tx 0x…${hash.slice(2, 8)} success, gas ${(Math.random() * 0.03).toFixed(3)} gwei`,
          },
          ...prev,
        ].slice(0, 100)
      );
      h.setKpiMetrics((prev: any) => ({
        ...prev,
        totalTransactions: prev.totalTransactions + 1,
        totalTvlAnalyzed: prev.totalTvlAnalyzed + Math.round(amt * 1_000_000),
        gasSavedUsd: +(prev.gasSavedUsd + 0.08).toFixed(2),
      }));
      h.setSuccessHistory((prev: any[]) => {
        const c = [...prev];
        if (c.length) {
          const last = { ...c[c.length - 1] };
          last.success = last.success + 1;
          c[c.length - 1] = last;
        }
        return c;
      });
    }
  }, 3500);
  return () => clearInterval(id);
}

export interface GuestAgentsHandlers {
  setHoldings: (u: (prev: any) => any) => void;
  setLimitOrders: (u: (prev: any[]) => any[]) => void;
  setSmartBuys: (u: (prev: any[]) => any[]) => void;
}

export function startGuestAgentsSimulation(h: GuestAgentsHandlers): () => void {
  const id = setInterval(() => {
    h.setHoldings((prev: any) => {
      if (!prev || !Array.isArray(prev.holding)) return prev;
      return {
        ...prev,
        holding: prev.holding.map((x: any) => {
          const drift = (Math.random() - 0.5) * 0.04;
          return {
            ...x,
            pnl_pct: +(x.pnl_pct + drift * 10).toFixed(2),
            value_usd: +(x.value_usd * (1 + drift)).toFixed(2),
          };
        }),
      };
    });
    if (Math.random() < 0.3) {
      const p = GUEST_PROJECTS[Math.floor(Math.random() * GUEST_PROJECTS.length)];
      h.setSmartBuys((prev: any[]) =>
        [
          {
            id: "sb_" + Date.now(),
            symbol: p.slice(0, 5).toUpperCase(),
            name: p,
            score: 80 + Math.floor(Math.random() * 18),
            reason: "Conviction rising — sentiment + TVL up",
            address: addr(),
            price_usd: +(Math.random() * 3 + 0.05).toFixed(3),
          },
          ...prev,
        ].slice(0, 8)
      );
    }
  }, 4000);
  return () => clearInterval(id);
}
