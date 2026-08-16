export default function MatchLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-7xl p-4 sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="aspect-video rounded-lg bg-[var(--surface)]" />
        <aside className="space-y-4">
          <div className="h-64 rounded-lg bg-[var(--surface)]" />
          <div className="h-48 rounded-lg bg-[var(--surface)]" />
        </aside>
      </div>
    </div>
  );
}
