export default function FootballLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="h-9 w-56 rounded-md bg-[var(--surface-muted)]" />
      <div className="h-5 w-96 max-w-full rounded-md bg-[var(--surface-muted)]" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-9 w-28 rounded-md bg-[var(--surface-muted)]" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 rounded-lg bg-[var(--surface)]" />)}
      </div>
    </div>
  );
}
