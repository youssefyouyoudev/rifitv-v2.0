import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--background)] p-6 text-[var(--foreground)]">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-normal text-[var(--brand-blue)]">404</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--foreground)]">Page not found</h1>
        <p className="mt-3 text-[var(--muted)]">The page may have moved, or the content is not available on RiFiTV.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand-blue)] px-4 font-semibold text-white" href="/">Home</Link>
          <Link className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-4 font-semibold text-[var(--foreground)]" href="/matches/today">Today&apos;s matches</Link>
          <Link className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-4 font-semibold text-[var(--foreground)]" href="/live">Live</Link>
          <Link className="inline-flex min-h-11 items-center rounded-md border border-[var(--border)] px-4 font-semibold text-[var(--foreground)]" href="/search">Search</Link>
        </div>
      </section>
    </main>
  );
}
