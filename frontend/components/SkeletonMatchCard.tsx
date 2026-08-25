export function SkeletonMatchCard() {
  return (
    <article className="h-full">
      <div className="match-card-link rounded-lg border bg-[var(--surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-normal text-[var(--muted)]">
            <div className="h-4 w-4 rounded bg-[var(--border)] animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--border)] animate-pulse" />
          </div>
          <div className="h-4 w-10 rounded bg-[var(--border)] animate-pulse" />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="h-4 w-16 rounded bg-[var(--border)] animate-pulse" />
          <div className="h-2 w-4 rounded bg-[var(--border)] animate-pulse" />
          <div className="h-4 w-16 rounded bg-[var(--border)] animate-pulse" />
        </div>

        <div className="mt-4 flex min-h-12 items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-20 rounded bg-[var(--border)] animate-pulse" />
            <div className="h-4 w-24 rounded bg-[var(--border)] animate-pulse" />
            <div className="h-4 w-12 rounded bg-[var(--border)] animate-pulse" />
            <div className="h-4 w-20 rounded bg-[var(--border)] animate-pulse" />
          </div>
          <div className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-semibold bg-[var(--surface-muted)] text-white animate-pulse">
            Watch
          </div>
        </div>
      </div>
    </article>
  );
}