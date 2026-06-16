"use client";
import { useDashboard, VectorMemoryItem } from "./DashboardContext";
import { useState, useMemo } from "react";
import { Search, Trash2, Ban, CheckCircle2, Cpu, RefreshCw, Database } from "lucide-react";

const STATUS_STYLES: Record<VectorMemoryItem["embeddingStatus"], string> = {
  indexed:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  processing:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  blacklisted: "bg-brand-red/10 text-brand-red border-brand-red/20",
};

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? "bg-brand-red" : pct >= 70 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400 w-10 text-right tabular-nums">{score.toFixed(3)}</span>
    </div>
  );
}

function formatTvl(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000).toFixed(0)}K`;
}

export default function VectorMemoryExplorer() {
  const { vectorMemory, handleBlacklist, handleClearCache } = useDashboard();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    return vectorMemory.filter(item => {
      const matchQuery = item.projectName.toLowerCase().includes(query.toLowerCase()) ||
        item.contractAddress.toLowerCase().includes(query.toLowerCase());
      const matchStatus = filterStatus === "all" || item.embeddingStatus === filterStatus;
      return matchQuery && matchStatus;
    });
  }, [vectorMemory, query, filterStatus]);

  const stats = useMemo(() => ({
    total: vectorMemory.length,
    indexed: vectorMemory.filter(i => i.embeddingStatus === "indexed").length,
    blacklisted: vectorMemory.filter(i => i.embeddingStatus === "blacklisted").length,
    avgScore: vectorMemory.length > 0
      ? (vectorMemory.reduce((a, b) => a + b.similarityScore, 0) / vectorMemory.length).toFixed(3)
      : "0.000",
  }), [vectorMemory]);

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Indexed", value: stats.total, icon: Database },
          { label: "Active", value: stats.indexed, icon: CheckCircle2 },
          { label: "Blacklisted", value: stats.blacklisted, icon: Ban },
          { label: "Avg Similarity", value: stats.avgScore, icon: Cpu },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-brand-accent" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="font-heading text-lg font-bold text-white tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" aria-hidden="true" />
            <label htmlFor="vector-search" className="sr-only">Search projects in vector memory</label>
            <input
              id="vector-search"
              type="search"
              placeholder="Search project name or contract address..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label htmlFor="filter-status" className="sr-only">Filter by embedding status</label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-full w-full sm:w-auto px-3 py-2.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="indexed">Indexed</option>
              <option value="processing">Processing</option>
              <option value="blacklisted">Blacklisted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" role="table" aria-label="ChromaDB vector memory entries">
            <thead className="bg-slate-900/80">
              <tr className="border-b border-slate-800">
                <th scope="col" className="text-left px-4 py-3 font-medium text-slate-500">Project</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell">Source</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                <th scope="col" className="text-left px-4 py-3 font-medium text-slate-500 hidden lg:table-cell">Similarity Score</th>
                <th scope="col" className="text-right px-4 py-3 font-medium text-slate-500 hidden sm:table-cell">TVL</th>
                <th scope="col" className="text-center px-4 py-3 font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map((item: VectorMemoryItem) => (
                <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-200">{item.projectName}</p>
                      <p className="text-slate-600 font-mono mt-0.5">{item.contractAddress.slice(0, 18)}...</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-slate-400">{item.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[item.embeddingStatus]}`}>
                      {item.embeddingStatus === "indexed" && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                      {item.embeddingStatus === "processing" && <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />}
                      {item.embeddingStatus === "blacklisted" && <Ban className="w-3 h-3" aria-hidden="true" />}
                      {item.embeddingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell w-48">
                    <SimilarityBar score={item.similarityScore} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300 hidden sm:table-cell">
                    {formatTvl(item.tvl)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleClearCache(item.id)}
                        aria-label={`Clear cache for ${item.projectName}`}
                        title="Clear cache"
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleBlacklist(item.id)}
                        aria-label={`Blacklist ${item.projectName}`}
                        title="Blacklist project"
                        className="p-2 rounded-lg text-slate-500 hover:text-brand-red hover:bg-brand-red/10 active:scale-95 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
                      >
                        <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No entries match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-600">
          Showing {filtered.length} of {vectorMemory.length} entries
        </div>
      </div>
    </div>
  );
}
