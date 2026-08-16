export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)] lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-[var(--surface)] p-4 lg:block">
        <div className="h-10 w-32 rounded-md bg-[var(--surface-muted)]" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-10 rounded-md bg-[var(--surface-muted)]" />)}
        </div>
      </aside>
      <main className="space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="h-8 w-48 rounded-md bg-[var(--surface-muted)]" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 rounded-lg bg-[var(--surface)]" />)}
        </div>
        <div className="h-72 rounded-lg bg-[var(--surface)]" />
      </main>
    </div>
  );
}
