"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-neutral-100">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-normal text-red-300">Error</p>
        <h1 className="mt-2 text-3xl font-black text-white">RiFiTV hit a problem</h1>
        <p className="mt-3 text-neutral-400">We couldn't load the latest RiFiTV content. Retry to request fresh match data.</p>
        <button className="mt-6 min-h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={reset}>
          Try Again
        </button>
      </section>
    </main>
  );
}
