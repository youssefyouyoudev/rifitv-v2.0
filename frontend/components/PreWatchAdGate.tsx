"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerUI } from "@/features/player/PlayerUI";
import { canShowPrewatchGate, markPrewatchGateShown } from "@/lib/ads/ad-frequency";
import { requestAggressiveAd } from "@/lib/ads/AdManager";
import { AD_SETTINGS } from "@/lib/ads/config";
import { detectAdDevice } from "@/lib/ads/device";
import { trackEvent } from "@/lib/analytics";
import type { PlaybackPayload } from "@/lib/types";
import { AdPlacement } from "./AdPlacement";

export function PreWatchAdGate({ playback, title }: { playback: PlaybackPayload; title: string }) {
  const [gateState, setGateState] = useState<"checking" | "shown" | "complete">("checking");
  const [secondsLeft, setSecondsLeft] = useState(AD_SETTINGS.prewatchSeconds);
  const device = useMemo(() => (typeof window === "undefined" ? "desktop" : detectAdDevice()), []);

  useEffect(() => {
    if (!AD_SETTINGS.enabled || !AD_SETTINGS.prewatchEnabled || device === "tv" || !canShowPrewatchGate()) {
      queueMicrotask(() => setGateState("complete"));
      return;
    }

    markPrewatchGateShown();
    queueMicrotask(() => setGateState("shown"));
    trackEvent("ad_transition_shown", { match_slug: playback.match_slug, device_category: device });
  }, [device, playback.match_slug]);

  useEffect(() => {
    if (gateState !== "shown" || secondsLeft <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [gateState, secondsLeft]);

  async function continueToPlayer(): Promise<void> {
    await requestAggressiveAd("match", "prewatch_transition", device);
    trackEvent("ad_transition_completed", { match_slug: playback.match_slug, device_category: device });
    setGateState("complete");
  }

  if (gateState !== "shown") {
    return <PlayerUI playback={playback} title={title} />;
  }

  return (
    <section className="grid min-h-72 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-center sm:min-h-[420px] sm:p-6" aria-label="Match preparation">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <p className="text-sm font-semibold uppercase text-[var(--brand-blue)]">Your match is preparing</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Continue in {secondsLeft}s</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">This short sponsor moment helps keep RiFiTV running without interrupting active playback.</p>
        </div>
        <AdPlacement name="prewatch_transition" />
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand-blue)] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={secondsLeft > 0}
          onClick={() => void continueToPlayer()}
        >
          Continue to player
        </button>
      </div>
    </section>
  );
}
