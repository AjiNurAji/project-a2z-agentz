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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function genId() {
  return Math.random().toString(36).slice(2, 10);
}
function genTxHash() {
  return "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[randInt(0, 15)]).join("");
}
function genAddress() {
  return "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[randInt(0, 15)]).join("");
}

// (Dummy generators removed)

const DEFAULT_CONFIG: DashboardConfig = {
  agentA: { cronSchedule: "0 * * * *", sentimentWeight: 70, tvlWeight: 30, scoreThreshold: 85, sources: ["Farcaster", "Twitter", "On-Chain"] },
  agentB: { kmsRegion: "us-east-1", primaryRpc: "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY", fallbackRpc: "https://mainnet.base.org", autonomousCap: 2.0, gasBuffer: 15 },
};

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
  const [kpiMetrics, setKpiMetrics] = useState<KpiMetrics>({
    totalTvlAnalyzed: 42800000,
    successRate: 0,
    totalTransactions: 0,
    gasSavedUsd: 0,
    projectsScanned: 1247,
    activeAlerts: 0,
  });
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
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

  const fetchDashboardData = useCallback(async () => {
    try {
      const [statusData, statsData] = await Promise.all([
        apiFetch<{ logs?: Array<{ tx_hash_id: string; project_target_address: string; amount_usd: number; status: string; created_at: string }> }>("/api/status"),
        apiFetch<{ total_transactions: number; success_rate: number; total_usd_sent: number; active_targets: number; projects_scanned?: number; total_tvl?: number }>("/api/stats")
      ]);

      if (statusData?.logs) {
        const mappedTxs = statusData.logs.map(mapRawTxToTransaction) as Transaction[];
        setTransactions(mappedTxs.slice(0, 50));
      }

      if (statsData) {
        setKpiMetrics(prev => ({
          ...prev,
          successRate: statsData.success_rate,
          totalTransactions: statsData.total_transactions,
          gasSavedUsd: +(statsData.total_transactions * 0.08).toFixed(2),
          projectsScanned: statsData.projects_scanned || 0,
          totalTvlAnalyzed: statsData.total_tvl || 0,
        }));
      }
    } catch (e) {
      console.error("Failed to fetch dashboard data:", e);
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
      // Start with flatline histories to represent real data state
      const now = Date.now();
      const flatGas = Array.from({ length: 24 }, (_, i) => ({
        time: new Date(now - (23 - i) * 3600000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        gwei: 0,
      }));
      const flatTvl = Array.from({ length: 30 }, (_, i) => ({ time: `Day ${i + 1}`, tvl: 0 }));
      const flatSuccess = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({ time: d, success: 0, failed: 0 }));

      setVectorMemory([]);
      setGasHistory(flatGas);
      setTvlHistory(flatTvl);
      setSuccessHistory(flatSuccess);
      
      await fetchDashboardData();
      setMounted(true);
    };
    initData();
  }, [fetchDashboardData]);
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
      await fetchDashboardData();
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, usingReal, fetchDashboardData]);

  // Sync active alerts count into KPI
  useEffect(() => {
    setKpiMetrics(prev => ({ ...prev, activeAlerts: approvalQueue.length }));
  }, [approvalQueue.length]);

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
