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
          <div className="skel h-6 w-48" />
          <div className="skel h-3.5 w-80 max-w-full" />
        </div>
      </div>

      {/* 6 KPI Card skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skel w-9 h-9 rounded-full shrink-0" style={{ background: "var(--color-neutral-primary-medium)" }} />
              <div className="flex-1 space-y-2">
                <div className="skel h-3 w-20" />
                <div className="skel h-6 w-28" />
              </div>
            </div>
            <div className="skel h-2.5 w-16 rounded-full" />
          </div>
        ))}
      </div>

      {/* Circuit Breaker skeleton */}
      <div className="skel-card p-5 h-16" />

      {/* 2-column grid: AgentComm + LiveLog */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="skel-card p-5 h-56" />
        <div className="skel-card p-5 h-56" />
      </div>

      {/* 3-column grid: ApprovalQueue + TransactionList */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="skel-card p-5 h-72 xl:col-span-1" />
        <div className="skel-card p-5 h-72 xl:col-span-2" />
      </div>
    </div>
  );
}
