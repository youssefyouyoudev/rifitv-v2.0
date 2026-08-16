export default function CompetitionLoading() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-md bg-[var(--surface-muted)]" />
        <div>
          <div className="h-8 w-64 rounded-md bg-[var(--surface-muted)]" />
          <div className="mt-2 h-4 w-36 rounded-md bg-[var(--surface-muted)]" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-48 rounded-lg bg-[var(--surface)]" />)}
      </div>
    </div>
  );
}
