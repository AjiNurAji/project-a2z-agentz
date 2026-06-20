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
          <div className="skel h-6 w-32" />
          <div className="skel h-3.5 w-96 max-w-full" />
        </div>
      </div>

      {/* Summary stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skel-card flex items-center gap-3 p-4">
            <div className="skel w-10 h-10 rounded-full shrink-0" style={{ background: "var(--color-neutral-primary-medium)" }} />
            <div className="flex-1 space-y-2">
              <div className="skel h-3 w-20" />
              <div className="skel h-5 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* 2 large chart area skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="skel-card p-5">
          <div className="skel h-4 w-36 mb-4" />
          <div className="skel h-64 w-full" />
        </div>
        <div className="skel-card p-5">
          <div className="skel h-4 w-36 mb-4" />
          <div className="skel h-64 w-full" />
        </div>
      </div>

      {/* Bottom full-width chart */}
      <div className="skel-card p-5">
        <div className="skel h-4 w-44 mb-4" />
        <div className="skel h-52 w-full" />
      </div>
    </div>
  );
}
