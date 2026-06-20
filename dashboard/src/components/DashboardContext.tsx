"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAgentWebSocket } from "@/hooks/useAgentWebSocket";
import { apiFetch } from "@/lib/api";
import { mapLogToAgentMessage, mapRawTxToTransaction } from "@/lib/mappers";
import { KpiGridSkeleton, ChartSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── Types ──────────────────────────────────────────────────
export type AgentStatus = "online" | "offline" | "analyzing" | "executing";
export type TxStatus = "success" | "failed" | "pending";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface Transaction {
  id: string;
  projectName: string;
  targetAddress: string;
  amountUsd: number;
  status: TxStatus;
  txHash: string;
  timestamp: Date;
  reason: string;
  gasUsedGwei: number;
}

export interface ApprovalItem {
  id: string;
  projectName: string;
  targetAddress: string;
  amountUsd: number;
  reason: string;
  llmScore: number;
  createdAt: Date;
  signature: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "INFO" | "WARN" | "SUCCESS" | "ERROR" | "AGENT_A" | "AGENT_B";
  message: string;
}

export interface VectorMemoryItem {
  id: string;
  projectName: string;
  contractAddress: string;
  similarityScore: number;
  embeddingStatus: "indexed" | "processing" | "blacklisted";
  source: "Farcaster" | "Twitter" | "On-Chain";
  tvl: number;
  indexedAt: Date;
}

export interface KpiMetrics {
  totalTvlAnalyzed: number;
  successRate: number;
  totalTransactions: number;
  gasSavedUsd: number;
  projectsScanned: number;
  activeAlerts: number;
}

export interface GasDataPoint { time: string; gwei: number }
export interface TvlDataPoint { time: string; tvl: number }
export interface SuccessDataPoint { time: string; success: number; failed: number }

export interface DashboardConfig {
  agentA: {
    cronSchedule: string;
    sentimentWeight: number;
    tvlWeight: number;
    scoreThreshold: number;
    sources: string[];
  };
  agentB: {
    kmsRegion: string;
    primaryRpc: string;
    fallbackRpc: string;
    autonomousCap: number;
    gasBuffer: number;
  };
}

// ─── Agent Communication Types ──────────────────────────────
export type AgentSender = "agent_a" | "agent_b" | "system";
export type MessageStatus = "sending" | "sent" | "processing" | "done" | "error";

export interface AgentMessage {
  id: string;
  sender: AgentSender;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  metadata?: {
    txHash?: string;
    score?: number;
    projectName?: string;
    amountUsd?: number;
  };
}

export type NotificationType = "approval" | "failure" | "agent" | "threshold";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

export interface AgentHealth {
  latencyMs: number;
  inferenceMs: number;
  successCount: number;
  failCount: number;
  queueDepth: number;
  uptimePct: number;
}

export type Density = "compact" | "comfortable" | "spacious";

export interface AppPreferences {
  density: Density;
  onboarded: boolean;
}

interface DashboardContextType {
  agentAStatus: AgentStatus;
  agentBStatus: AgentStatus;
  isPaused: boolean;
  setIsPaused: (v: boolean) => void;
  transactions: Transaction[];
  approvalQueue: ApprovalItem[];
  logs: LogEntry[];
  vectorMemory: VectorMemoryItem[];
  kpiMetrics: KpiMetrics;
  gasHistory: GasDataPoint[];
  tvlHistory: TvlDataPoint[];
  successHistory: SuccessDataPoint[];
  config: DashboardConfig;
  setConfig: (c: DashboardConfig) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleBlacklist: (id: string) => void;
  handleClearCache: (id: string) => void;
  agentMessages: AgentMessage[];
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  lastSync: number;
  wsStatus: "connecting" | "connected" | "disconnected";
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (type: NotificationType, title: string, body: string, link?: string) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  agentHealth: { a: AgentHealth; b: AgentHealth };
  preferences: AppPreferences;
  setPreferences: (p: Partial<AppPreferences>) => void;
  analyzeTarget: (targetAddress: string, description: string, projectName: string) => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

// ─── Generators ─────────────────────────────────────────────
const PROJECTS = [
  "ZeroGravity Protocol", "NeuralFi", "BaseSwap V3", "OmniLayer DAO",
  "CryptoNest", "DeFi Nexus", "ChainLink Base", "Arbitrage Bot X",
  "Yield Optimizer Pro", "FlashLoan Gate",
];

const FARCASTER_MSGS = [
  "Scanning Farcaster channel /defi — 342 casts analyzed",
  "High-alpha signal detected: ZeroGravity Protocol gaining traction",
  "KOL @vitalik.eth mentioned NeuralFi in thread",
  "Llama 3 sentiment analysis: 78% positive on BaseSwap V3",
  "Embedding 128 new posts into ChromaDB vector store",
  "Similarity score 0.91 — project not in cache, proceeding",
  "On-chain check: Contract verified on Basescan",
  "TVL fetched: $2.1M — above $500k threshold",
  "Score Engine: Sentiment 70pts + TVL 28pts = Total 98/100",
  "Payload assembled, signing with Agent A private key...",
  "Cryptographic signature attached (ECDSA secp256k1)",
  "Sending to Agent B Vault API: POST /api/v1/vault/execute",
];

const AGENT_B_MSGS = [
  "Vault received payload from Agent A",
  "Signature verified — public key matches whitelist",
  "Timestamp freshness check passed (< 30s)",
  "Idempotency check: Hash not found in PostgreSQL",
  "Gas oracle pinged: 42 Gwei avg, setting maxFee to 48.3 Gwei",
  "Running Tenderly dry-run simulation...",
  "Simulation passed — no revert detected",
  "Broadcasting tx to Base mainnet via Alchemy RPC...",
  "Tx included in block #21,847,392",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFrom<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}
function genId() {
  return Math.random().toString(36).slice(2, 10);
}
function genAddress() {
  return "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[randInt(0, 15)]).join("");
}
function genTxHash() {
  return "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[randInt(0, 15)]).join("");
}

function genInitialTransactions(): Transaction[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: genId(),
    projectName: PROJECTS[i % PROJECTS.length],
    targetAddress: genAddress(),
    amountUsd: +(Math.random() * 1.8 + 0.2).toFixed(2),
    status: (["success", "success", "success", "failed"] as TxStatus[])[randInt(0, 3)],
    txHash: genTxHash(),
    timestamp: new Date(Date.now() - (8 - i) * 4 * 60000),
    reason: "High positive sentiment on Farcaster + Verified TVL > 500k",
    gasUsedGwei: randInt(35, 65),
  }));
}

function genInitialApprovals(): ApprovalItem[] {
  return Array.from({ length: 3 }, () => ({
    id: genId(),
    projectName: randFrom(PROJECTS),
    targetAddress: genAddress(),
    amountUsd: +(Math.random() * 8 + 2.1).toFixed(2),
    reason: "TVL > $5M & KOL engagement detected. Exceeds $2 cap — requires manual approval.",
    llmScore: randInt(86, 99),
    createdAt: new Date(Date.now() - randInt(1, 15) * 60000),
    signature: "0x" + Array.from({ length: 20 }, () => "0123456789abcdef"[randInt(0, 15)]).join("") + "...",
  }));
}

function genInitialVectorMemory(): VectorMemoryItem[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: genId(),
    projectName: PROJECTS[i % PROJECTS.length],
    contractAddress: genAddress(),
    similarityScore: +(Math.random() * 0.5 + 0.5).toFixed(3),
    embeddingStatus: (["indexed", "indexed", "indexed", "processing", "blacklisted"] as VectorMemoryItem["embeddingStatus"][])[randInt(0, 4)],
    source: (["Farcaster", "Twitter", "On-Chain"] as VectorMemoryItem["source"][])[randInt(0, 2)],
    tvl: randInt(100000, 8000000),
    indexedAt: new Date(Date.now() - randInt(5, 120) * 60000),
  }));
}

function genGasHistory(): GasDataPoint[] {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now - (23 - i) * 3600000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    gwei: randInt(28, 85),
  }));
}

function genTvlHistory(): TvlDataPoint[] {
  let tvl = 1200000;
  return Array.from({ length: 30 }, (_, i) => {
    tvl += randInt(-50000, 180000);
    return { time: `Day ${i + 1}`, tvl: Math.max(tvl, 800000) };
  });
}

function genSuccessHistory(): SuccessDataPoint[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((d) => ({ time: d, success: randInt(8, 24), failed: randInt(0, 5) }));
}

const DEFAULT_CONFIG: DashboardConfig = {
  agentA: { cronSchedule: "0 * * * *", sentimentWeight: 70, tvlWeight: 30, scoreThreshold: 85, sources: ["Farcaster", "Twitter", "On-Chain"] },
  agentB: { kmsRegion: "us-east-1", primaryRpc: "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY", fallbackRpc: "https://mainnet.base.org", autonomousCap: 2.0, gasBuffer: 15 },
};

// ─── A2A Message Generator ──────────────────────────────────
function genAgentConversation(): AgentMessage[] {
  const now = Date.now();
  return [
    { id: genId(), sender: "system", content: "A2A session initialized. Agents connected via secure channel.", timestamp: new Date(now - 120000), status: "done" },
    { id: genId(), sender: "agent_a", content: "Starting DeFi scan cycle. Analyzing Farcaster + Twitter signals...", timestamp: new Date(now - 100000), status: "done" },
    { id: genId(), sender: "agent_a", content: "Found candidate: ZeroGravity Protocol. TVL $2.1M, sentiment 92% positive.", timestamp: new Date(now - 80000), status: "done", metadata: { projectName: "ZeroGravity Protocol", score: 92 } },
    { id: genId(), sender: "agent_b", content: "Received payload. Verifying signature and running dry-run simulation...", timestamp: new Date(now - 60000), status: "done" },
    { id: genId(), sender: "agent_b", content: "Simulation passed. Broadcasting tx to Base mainnet.", timestamp: new Date(now - 40000), status: "done", metadata: { txHash: genTxHash().slice(0, 18) + "..." } },
    { id: genId(), sender: "agent_a", content: "Tx confirmed. Moving to next candidate: NeuralFi (KOL signal detected).", timestamp: new Date(now - 20000), status: "done" },
  ];
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [agentAStatus, setAgentAStatus] = useState<AgentStatus>("online");
  const [agentBStatus, setAgentBStatus] = useState<AgentStatus>("online");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: genId(), timestamp: new Date(), level: "INFO", message: "A2Z Dashboard initialized. Connecting to agents..." },
    { id: genId(), timestamp: new Date(), level: "SUCCESS", message: "Agent A (Scout) connected. vLLM/ROCm server online." },
    { id: genId(), timestamp: new Date(), level: "SUCCESS", message: "Agent B (Vault) connected. KMS handshake successful." },
  ]);
  const [vectorMemory, setVectorMemory] = useState<VectorMemoryItem[]>([]);
  const [gasHistory, setGasHistory] = useState<GasDataPoint[]>([]);
  const [tvlHistory, setTvlHistory] = useState<TvlDataPoint[]>([]);
  const [successHistory, setSuccessHistory] = useState<SuccessDataPoint[]>([]);
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>(genAgentConversation());
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferencesState] = useState<AppPreferences>({ density: "comfortable", onboarded: false });
  const [agentHealth, setAgentHealth] = useState<{ a: AgentHealth; b: AgentHealth }>({
    a: { latencyMs: 180, inferenceMs: 1400, successCount: 0, failCount: 0, queueDepth: 0, uptimePct: 99.8 },
    b: { latencyMs: 0, inferenceMs: 0, successCount: 0, failCount: 0, queueDepth: 0, uptimePct: 99.9 },
  });

  // ─── Agent WebSocket (real data) ──────────────────────────────
  const ws = useAgentWebSocket();
  const usingReal = ws.status === "connected";

  const logCountRef = useRef(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("a2z-prefs");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppPreferences>;
        setPreferencesState((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setAgentHealth((h) => ({
      ...h,
      b: { ...h.b, queueDepth: approvalQueue.length },
    }));
  }, [approvalQueue.length]);

  const addNotification = useCallback((type: NotificationType, title: string, body: string, link?: string) => {
    setNotifications((prev) => [
      { id: genId(), type, title, body, timestamp: new Date(), read: false, link },
      ...prev,
    ].slice(0, 50));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => setNotifications([]), []);

  const setPreferences = useCallback((p: Partial<AppPreferences>) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem("a2z-prefs", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setTransactions(genInitialTransactions());
      setApprovalQueue(genInitialApprovals());
      setVectorMemory(genInitialVectorMemory());
      setGasHistory(genGasHistory());
      setTvlHistory(genTvlHistory());
      setSuccessHistory(genSuccessHistory());
      setMounted(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const addLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [{ id: genId(), timestamp: new Date(), level, message }, ...prev].slice(0, 100));
    logCountRef.current++;
  }, []);

  const analyzeTarget = useCallback(async (targetAddress: string, description: string, projectName: string) => {
    setAgentAStatus("analyzing");
    addLog("INFO", `Initiating analysis for ${projectName} (${targetAddress})...`);
    
    try {
      const data = await apiFetch<{
        status: string;
        score?: number;
        reason?: string;
      }>("/api/analyze", {
        method: "POST",
        body: JSON.stringify({ target_address: targetAddress, description, project_name: projectName, use_mock: false }),
      });
      setAgentAStatus("online");
      
      addLog("SUCCESS", `Analysis complete for ${projectName}: Score ${data.score}/100. Status: ${data.status}`);
      
      if (data.status === "executed" || data.status === "pending_approval") {
        setAgentMessages((prev) => [
          ...prev,
          { id: genId(), sender: "system" as const, content: `Analysis passed with score ${data.score}. Execution status: ${data.status}`, timestamp: new Date(), status: "done" as const },
        ].slice(-50));
      } else {
        addNotification("failure", "Analysis Rejected", `${projectName} was rejected. Reason: ${data.reason}`);
      }
      
    } catch (err) {
      addLog("WARN", `Backend unavailable. Using mock simulation for ${projectName}.`);
      // Mock Fallback
      setTimeout(() => {
        setAgentAStatus("online");
        addLog("SUCCESS", `Mock Analysis complete for ${projectName}: Score 92/100.`);
      }, 1500);
    }
  }, [addLog, addNotification]);

  // ─── Real WS data overrides mock when connected ────────────────────────────
  useEffect(() => {
    if (!usingReal) return;
    setAgentMessages(ws.agentLogs.map(mapLogToAgentMessage).slice(-50) as AgentMessage[]);
  }, [ws.agentLogs, usingReal]);

  useEffect(() => {
    if (!usingReal) return;
    setTransactions(ws.transactions.map(mapRawTxToTransaction) as Transaction[]);
  }, [ws.transactions, usingReal]);

  // ─── Real Backend Polling & Live Simulation ──────────────────────────────────────
  useEffect(() => {
    if (isPaused || usingReal) return;
    const interval = setInterval(async () => {
      setLastSync(Date.now());
      
      try {
        const data = await apiFetch<{ logs?: Array<{ tx_hash_id: string; project_target_address: string; amount_usd: number; status: string; created_at: string }> }>("/api/status");
        if (data && data.logs && data.logs.length > 0) {
          const mappedTxs = data.logs.map(mapRawTxToTransaction) as Transaction[];
          
          // Only update if there are new transactions (simplified check by length)
          setTransactions((prev) => mappedTxs.length > prev.length ? mappedTxs.slice(0, 50) : prev);
        }
      } catch (e) {
        // Fallback to simulation if backend is down
        const roll = Math.random();

        if (roll < 0.35) {
          addLog("AGENT_A", randFrom(FARCASTER_MSGS));
        } else if (roll < 0.6) {
          addLog("AGENT_B", randFrom(AGENT_B_MSGS));
        } else {
          const proj = randFrom(PROJECTS);
          const success = Math.random() > 0.15;
          const newTx: Transaction = {
            id: genId(),
            projectName: proj,
            targetAddress: genAddress(),
            amountUsd: +(Math.random() * 1.8 + 0.2).toFixed(2),
            status: success ? "success" : "failed",
            txHash: genTxHash(),
            timestamp: new Date(),
            reason: "Llama 3 score: " + randInt(86, 99) + "/100",
            gasUsedGwei: randInt(35, 65),
          };
          setTransactions((prev) => [newTx, ...prev].slice(0, 50));
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, usingReal, addLog, addNotification]);

  const kpiMetrics: KpiMetrics = {
    totalTvlAnalyzed: 42_800_000 + transactions.length * 180000,
    successRate: Math.round((transactions.filter((t) => t.status === "success").length / Math.max(transactions.length, 1)) * 100),
    totalTransactions: transactions.length,
    gasSavedUsd: +(transactions.filter((t) => t.status === "success").length * 0.08).toFixed(2),
    projectsScanned: 1247 + transactions.length * 3,
    activeAlerts: approvalQueue.length,
  };

  const handleApprove = useCallback(
    (id: string) => {
      const item = approvalQueue.find((a) => a.id === id);
      if (!item) return;
      setApprovalQueue((prev) => prev.filter((a) => a.id !== id));
      const newTx: Transaction = {
        id: genId(), projectName: item.projectName, targetAddress: item.targetAddress,
        amountUsd: item.amountUsd, status: "success", txHash: genTxHash(),
        timestamp: new Date(), reason: item.reason, gasUsedGwei: randInt(35, 65),
      };
      setTransactions((prev) => [newTx, ...prev]);
      addLog("SUCCESS", `Manual approval: ${item.projectName} $${item.amountUsd} executed`);
      setAgentMessages((prev) => [
        ...prev,
        { id: genId(), sender: "system" as const, content: `Human approved: ${item.projectName} ($${item.amountUsd}). Executing via Agent B.`, timestamp: new Date(), status: "done" as const },
      ].slice(-50));
    },
    [approvalQueue, addLog]
  );

  const handleReject = useCallback(
    (id: string) => {
      const item = approvalQueue.find((a) => a.id === id);
      setApprovalQueue((prev) => prev.filter((a) => a.id !== id));
      if (item) {
        addLog("WARN", `Rejected: ${item.projectName} — human override`);
        setAgentMessages((prev) => [
          ...prev,
          { id: genId(), sender: "system" as const, content: `Human rejected: ${item.projectName}. Skipping execution.`, timestamp: new Date(), status: "error" as const },
        ].slice(-50));
      }
    },
    [approvalQueue, addLog]
  );

  const handleBlacklist = useCallback(
    (id: string) => {
      setVectorMemory(prev => prev.map(v => v.id === id ? {...v, embeddingStatus: 'blacklisted' as const} : v));
      addLog("WARN", "Project blacklisted in ChromaDB vector store");
    },
    [addLog]
  );

  const handleClearCache = useCallback(
    (id: string) => {
      addLog("INFO", `Cache cleared for project ID: ${id}`);
    },
    [addLog]
  );

  if (!mounted) {
    return (
      <div className="flex h-screen">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex flex-col w-[72px] border-r border-[var(--color-border-default)] bg-[var(--color-surface)] p-3 gap-3">
          <Skeleton variant="circular" className="w-9 h-9" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" className="w-full h-10 rounded-xl" />
          ))}
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 p-6 space-y-6 overflow-hidden">
          <KpiGridSkeleton />
          {/* Circuit breaker bar skeleton */}
          <Skeleton variant="rectangular" className="h-14 rounded-xl" />
          {/* 2-column grid with card skeletons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton />
            <TableSkeleton rows={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider
      value={{
        agentAStatus, agentBStatus, isPaused, setIsPaused,
        transactions, approvalQueue, logs, vectorMemory,
        kpiMetrics, gasHistory, tvlHistory, successHistory,
        config, setConfig,
        handleApprove, handleReject, handleBlacklist, handleClearCache,
        agentMessages, sidebarOpen, setSidebarOpen,
        lastSync, wsStatus: ws.status, notifications, unreadCount: notifications.filter((n) => !n.read).length,
        addNotification, markNotificationsRead, clearNotifications,
        agentHealth, preferences, setPreferences, analyzeTarget,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
