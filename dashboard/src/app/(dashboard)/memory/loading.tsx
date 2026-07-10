export default function Loading() {
  return (
    <div className="space-y-6">
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.4 }
          50% { opacity: 1 }
        }
        .skel {
          background: var(--color-border-default);
          border-radius: 0.5rem;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
        .skel-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border-default);
          border-radius: 0.75rem;
          animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* PageHeader skeleton */}
      <div className="flex items-center gap-4">
        <div className="skel w-10 h-10 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="skel h-6 w-52" />
          <div className="skel h-3.5 w-96 max-w-full" />
        </div>
      </div>

      {/* Stats bar: 4 stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-card p-4 flex items-center gap-3">
            <div className="skel w-8 h-8 rounded-full shrink-0" style={{ background: "var(--color-neutral-primary-medium)" }} />
            <div className="flex-1 space-y-2">
              <div className="skel h-3 w-16" />
              <div className="skel h-5 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* Search / filter bar skeleton */}
      <div className="skel-card p-4 flex items-center gap-3">
        <div className="skel h-10 flex-1 rounded-lg" />
        <div className="skel h-10 w-32 rounded-lg" />
        <div className="skel h-10 w-28 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="skel-card p-0 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 p-4" style={{ borderBottom: "1px solid var(--color-border-default)" }}>
          {["w-24", "w-32", "w-20", "w-20", "w-20", "w-16"].map((w, i) => (
            <div key={i} className={`skel h-3.5 ${w}`} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-6 gap-4 p-4"
            style={{ borderBottom: row < 4 ? "1px solid var(--color-border-default)" : "none" }}
          >
            {["w-28", "w-40", "w-16", "w-14", "w-16", "w-10"].map((w, i) => (
              <div key={i} className={`skel h-3.5 ${w}`} style={{ animationDelay: `${row * 0.1}s` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
