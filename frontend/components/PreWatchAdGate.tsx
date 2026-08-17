"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerUI } from "@/features/player/PlayerUI";
import { canShowPrewatchGate, markPrewatchGateShown } from "@/lib/ads/ad-frequency";
import { requestAggressiveAd } from "@/lib/ads/AdManager";
import { AD_SETTINGS } from "@/lib/ads/config";
import { detectAdDevice } from "@/lib/ads/device";
import { trackEvent } from "@/lib/analytics";
import type { PlaybackPayload } from "@/lib/types";
import { AdPlacement } from "./AdPlacement";
import { RiFiTVLogo } from "./RiFiTVLogo";

/**
 * Session key for persisting countdown state per match.
 * Format: rifitv_prewatch_<matchSlug>
 * Prevents re-showing the gate when React remounts, user navigates back,
 * or refreshes accidentally.
 */
function sessionKey(matchSlug: string) {
  return `rifitv_prewatch_${matchSlug}`;
}

export function PreWatchAdGate({
  playback,
  title,
}: {
  playback: PlaybackPayload;
  title: string;
}) {
  const [gateState, setGateState] = useState<"checking" | "shown" | "complete">("checking");
  const [secondsLeft, setSecondsLeft] = useState(AD_SETTINGS.prewatchSeconds);
  const device = useMemo(
    () => (typeof window === "undefined" ? "desktop" : detectAdDevice()),
    [],
  );
  // Track whether timer has been started (prevents StrictMode double-init)
  const timerStarted = useRef(false);

  useEffect(() => {
    if (timerStarted.current) return;

    // Check if this match's pre-watch gate was already completed this session
    const alreadyCompleted =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(sessionKey(playback.match_slug)) === "done";

    if (
      alreadyCompleted ||
      !AD_SETTINGS.enabled ||
      !AD_SETTINGS.prewatchEnabled ||
      device === "tv" ||
      !canShowPrewatchGate()
    ) {
      queueMicrotask(() => setGateState("complete"));
      return;
    }

    timerStarted.current = true;
    markPrewatchGateShown();
    queueMicrotask(() => setGateState("shown"));
    trackEvent("prewatch_started", { match_slug: playback.match_slug, device_category: device });
  }, [device, playback.match_slug]);

  // Countdown tick — runs independently of ad loading
  useEffect(() => {
    if (gateState !== "shown") return;
    if (secondsLeft <= 0) return;

    const timer = window.setTimeout(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [gateState, secondsLeft]);

  async function continueToPlayer(): Promise<void> {
    // Mark this match gate as done in session storage
    try {
      sessionStorage.setItem(sessionKey(playback.match_slug), "done");
    } catch {
      // Storage may be unavailable — not critical
    }

    // Trigger aggressive ad (fire-and-forget — NEVER await result to block player)
    void requestAggressiveAd("match", "prewatch_transition", device).then(() => {
      trackEvent("prewatch_completed", {
        match_slug: playback.match_slug,
        device_category: device,
      });
    });

    setGateState("complete");
  }

  // Gate is not shown → render player directly
  if (gateState !== "shown") {
    return <PlayerUI playback={playback} title={title} />;
  }

  return (
    <section
      className="grid min-h-72 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-center sm:min-h-[420px] sm:p-6"
      aria-label="تجهيز البث"
      dir="rtl"
    >
      <div className="mx-auto w-full max-w-xl space-y-5">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2">
          <RiFiTVLogo className="h-8 opacity-80" />
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-blue)]">
            RiFiTV Live
          </p>
        </div>

        {/* Arabic primary text */}
        <div>
          <p className="text-sm font-semibold text-[var(--muted)]">
            البث سيكون جاهزاً خلال
          </p>
          <div
            className="mt-2 text-5xl font-black tabular-nums text-[var(--foreground)]"
            role="timer"
            aria-live="polite"
            aria-label={`${secondsLeft} ثانية`}
          >
            {secondsLeft}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]" dir="rtl">
            يرجى الانتظار قليلاً بينما نقوم بتجهيز البث
          </p>
        </div>

        {/* Ad slot — NEVER blocks countdown or playback */}
        <div className="overflow-hidden rounded-lg" aria-label="إعلان">
          <AdPlacement name="prewatch_transition" eager />
        </div>

        {/* Continue button — enabled only when countdown reaches 0 */}
        <button
          type="button"
          className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-[var(--brand-blue)] px-6 text-base font-bold text-white shadow-lg outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={secondsLeft > 0}
          onClick={() => void continueToPlayer()}
        >
          <span>شاهد البث الآن</span>
          {secondsLeft === 0 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M2 10a8 8 0 1116 0A8 8 0 012 10zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z"
                clipRule="evenodd"
              />
            </svg>
          ) : null}
        </button>

        <p className="text-xs text-[var(--muted)]">
          هذه اللحظة الإعلانية تساعد في الإبقاء على RiFiTV مجانياً
        </p>
      </div>
    </section>
  );
}
