"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">
        <main className="grid min-h-dvh place-items-center p-6">
          <section className="max-w-md text-center">
            <p className="text-sm font-semibold uppercase text-red-300">Server error</p>
            <h1 className="mt-2 text-3xl font-black text-white">RiFiTV could not load</h1>
            <p className="mt-3 text-neutral-400">The service hit an unexpected problem. Retry to request a fresh response.</p>
            <button type="button" className="mt-6 min-h-11 rounded-md bg-red-600 px-4 font-semibold text-white" onClick={reset}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
