"use client";
import { useDashboard, Transaction, ApprovalItem } from "./DashboardContext";
import { useState, useMemo } from "react";
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";

type HistoryEntry = (Transaction | ApprovalItem) & {
  entryType: "transaction" | "approval";
  auditStatus: "success" | "failed" | "approved" | "rejected" | "pending";
};

const STATUS_STYLES = {
  success:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed:   "bg-brand-red/10 text-brand-red border-brand-red/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-brand-red/10 text-brand-red border-brand-red/20",
  pending:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function genFakeHistory(): HistoryEntry[] {
  const PROJECTS = ["ZeroGravity Protocol","NeuralFi","BaseSwap V3","OmniLayer DAO","CryptoNest","DeFi Nexus","ChainLink Base"];
  const statuses: HistoryEntry["auditStatus"][] = ["success","failed","approved","rejected","pending"];
  function genAddress() { return "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join(""); }
  function genHash() { return "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join(""); }
  return Array.from({ length: 25 }, (_, i) => {
    const status = statuses[i % statuses.length];
    const projectName = PROJECTS[i % PROJECTS.length];
    const ts = new Date(Date.now() - i * 7 * 60000);
    const base = {
      id: `hist-${i}`,
      projectName,
      targetAddress: genAddress(),
      amountUsd: +(Math.random() * 4 + 0.5).toFixed(2),
      reason: "Llama 3 score: " + (80 + i % 20) + "/100. High Farcaster engagement + verified TVL.",
      timestamp: ts,
      createdAt: ts,
      signature: genHash().slice(0, 42) + "...",
    };
    if (status === "success" || status === "failed") {
      return { ...base, entryType: "transaction" as const, auditStatus: status,
        txHash: genHash(), status: status as "success" | "failed", gasUsedGwei: 35 + i % 30 };
    }
    return { ...base, entryType: "approval" as const, auditStatus: status, llmScore: 80 + i % 20 };
  });
}

const HISTORY_DATA = genFakeHistory();

export default function AuditTrail() {
  const { transactions, approvalQueue } = useDashboard();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const PER_PAGE = 10;

  const allEntries = useMemo((): HistoryEntry[] => {
    const txEntries: HistoryEntry[] = transactions.map(tx => ({
      ...tx,
      createdAt: tx.timestamp,
      llmScore: 90,
      signature: tx.txHash.slice(0, 42) + "...",
      entryType: "transaction",
      auditStatus: tx.status,
    }));
    const approvalEntries: HistoryEntry[] = approvalQueue.map(ap => ({
      ...ap,
      timestamp: ap.createdAt,
      txHash: "",
      status: "pending" as const,
      gasUsedGwei: 0,
      entryType: "approval",
      auditStatus: "pending",
    }));
    return [...txEntries, ...approvalEntries, ...HISTORY_DATA].sort((a, b) => {
      const aTime = "timestamp" in a ? a.timestamp : a.createdAt;
      const bTime = "timestamp" in b ? b.timestamp : b.createdAt;
      return bTime.getTime() - aTime.getTime();
    });
  }, [transactions, approvalQueue]);

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      const matchQ = e.projectName.toLowerCase().includes(query.toLowerCase());
      const matchS = filterStatus === "all" || e.auditStatus === filterStatus;
      return matchQ && matchS;
    });
  }, [allEntries, query, filterStatus]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: allEntries.length },
          { label: "Successful", value: allEntries.filter(e => e.auditStatus === "success" || e.auditStatus === "approved").length },
          { label: "Failed/Rejected", value: allEntries.filter(e => e.auditStatus === "failed" || e.auditStatus === "rejected").length },
          { label: "Pending", value: allEntries.filter(e => e.auditStatus === "pending").length },
        ].map(({ label, value }) => (
          <div key={label} className="glass-card p-4 text-center">
            <p className="font-heading text-2xl font-bold text-white tabular-nums">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <label htmlFor="audit-search" className="sr-only">Search audit trail</label>
          <input
            id="audit-search"
            type="search"
            placeholder="Search by project name..."
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <label htmlFor="audit-filter" className="sr-only">Filter by status</label>
          <select
            id="audit-filter"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer"
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Entries */}
      <div className="glass-card overflow-hidden divide-y divide-slate-800/50">
        {paginated.map((entry) => {
          const isExpanded = expandedId === entry.id;
          const entryTime = "timestamp" in entry ? entry.timestamp : entry.createdAt;
          const txHash = "txHash" in entry ? entry.txHash : "";
          return (
            <div key={entry.id}>
              <button
                className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-800/20 transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-brand-accent"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                aria-expanded={isExpanded}
              >
                <span className="text-slate-600 flex-shrink-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-200">{entry.projectName}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLES[entry.auditStatus]}`}>
                      {(entry.auditStatus === "success" || entry.auditStatus === "approved") && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                      {(entry.auditStatus === "failed" || entry.auditStatus === "rejected") && <XCircle className="w-3 h-3" aria-hidden="true" />}
                      {entry.auditStatus === "pending" && <Clock className="w-3 h-3" aria-hidden="true" />}
                      {entry.auditStatus}
                    </span>
                    <span className="text-xs text-slate-600 capitalize">{entry.entryType}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-mono font-semibold text-amber-400 tabular-nums">${entry.amountUsd}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{entryTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 bg-slate-900/40">
                  <div className="space-y-2 text-xs rounded-lg border border-slate-800 p-3 bg-slate-900/60">
                    <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Reason:</span><span className="text-slate-300">{entry.reason}</span></div>
                    <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Target Address:</span><span className="text-slate-300 font-mono break-all">{entry.targetAddress}</span></div>
                    {"signature" in entry && entry.signature && (
                      <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Signature:</span><span className="text-slate-300 font-mono break-all">{String(entry.signature)}</span></div>
                    )}
                    {txHash && <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Tx Hash:</span><span className="text-brand-accent font-mono break-all">{txHash}</span></div>}
                    <div className="flex gap-2"><span className="text-slate-500 w-28 flex-shrink-0">Raw JSON:</span>
                      <code className="text-slate-400 break-all">{JSON.stringify({ id: entry.id, project: entry.projectName, amount: entry.amountUsd, status: entry.auditStatus }, null, 2)}</code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {paginated.length === 0 && (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">No audit entries match your filter.</div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Showing {Math.min((page-1)*PER_PAGE+1, filtered.length)}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p-1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="px-3 py-1.5 text-xs text-slate-400">Page {page}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p+1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            aria-label="Next page"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
