export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-950 p-6 text-neutral-100">
      <section className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-normal text-red-300">Offline</p>
        <h1 className="mt-2 text-3xl font-black text-white">You are offline</h1>
        <p className="mt-3 text-neutral-400">Reconnect to view live matches and playback updates.</p>
      </section>
    </main>
  );
}
