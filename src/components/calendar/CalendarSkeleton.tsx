/**
 * First-load-only placeholder, shown in place of the calendar grid while the very
 * first fetch of the session is still in flight (before useEventsStore.hasLoadedOnce
 * is ever true) — see specs/008-events-perf-caching/research.md Decision J. Every
 * subsequent load (including background refreshes) keeps showing the real grid;
 * this component is never shown again once real data has landed once.
 */
export function CalendarSkeleton() {
  const weeks = Array.from({ length: 5 });
  const days = Array.from({ length: 7 });

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden animate-pulse"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="grid grid-cols-7 border-b border-border shrink-0 bg-card">
        {days.map((_, i) => (
          <div key={i} className="py-1.5 flex items-center justify-center">
            <div className="h-2 w-6 rounded bg-muted" />
          </div>
        ))}
      </div>

      {weeks.map((_, wi) => (
        <div key={wi} className="flex-1 grid grid-cols-7 min-h-0">
          {days.map((_, di) => (
            <div
              key={di}
              className="border-b border-r border-border p-1.5 flex flex-col gap-1"
            >
              <div className="size-4 rounded-full bg-muted" />
              {(wi + di) % 3 === 0 && <div className="h-3 w-full rounded bg-muted/70" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
