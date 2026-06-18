export default function Loading() {
  return (
    <div className="space-y-6">
      <style>{`@keyframes skeleton-pulse{0%,100%{opacity:.4}50%{opacity:1}}
        .skel{background:var(--color-border-default);border-radius:.5rem;animation:skeleton-pulse 1.8s ease-in-out infinite}
        .skel-card{background:var(--color-surface);border:1px solid var(--color-border-default);border-radius:.75rem;animation:skeleton-pulse 1.8s ease-in-out infinite}`}</style>

      {/* PageHeader skeleton */}
      <div className="flex items-center gap-4">
        <div className="skel w-10 h-10 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="skel h-6 w-56" />
          <div className="skel h-3.5 w-80 max-w-full" />
        </div>
      </div>

      {/* 2 panel skeletons side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {["Agent A", "Agent B"].map((label) => (
          <div key={label} className="skel-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="skel w-9 h-9 rounded-full shrink-0" style={{ background: "var(--color-neutral-primary-medium)" }} />
              <div className="space-y-2">
                <div className="skel h-4 w-36" />
                <div className="skel h-3 w-48" />
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skel h-3.5 w-28" />
                <div className="skel h-10 w-full rounded-lg" />
              </div>
            ))}
            <div className="space-y-2">
              <div className="skel h-3.5 w-32" />
              <div className="skel h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="flex justify-end gap-3">
        <div className="skel h-10 w-24 rounded-lg" />
        <div className="skel h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}
