export default function Loading() {
  return (
    <main className="site-container min-h-dvh py-6" aria-busy="true" aria-label="Loading RiFiTV">
      <div className="h-12 w-40 animate-pulse rounded-md bg-[var(--surface-muted)]" />
      <div className="mt-8 h-8 w-56 animate-pulse rounded-md bg-[var(--surface-muted)]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-52 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface)]" />
        ))}
      </div>
    </main>
  );
}
