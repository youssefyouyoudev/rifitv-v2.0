"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { detectAdDevice } from "@/lib/ads/device";
import { getBestBannerZone } from "@/lib/ads/AdManager";
import { canShowMidrollOverlay, markMidrollShown } from "@/lib/ads/ad-frequency";
import { AD_SETTINGS } from "@/lib/ads/config";
import { enqueueBannerLoad, unregisterBannerContainer } from "@/lib/ads/banner-loader";
import { trackEvent } from "@/lib/analytics";

type Props = {
  isPlaying: boolean;
  children: React.ReactNode;
};

const CONTAINER_ID = "rifitv-midroll-overlay-banner";
const TRIGGER_MS = AD_SETTINGS.midrollIntervalMinutes * 60 * 1000;

// ─── Overlay controller ────────────────────────────────────────────────────
// Pure functions defined outside React to avoid any ref-during-render issues.
// They receive a setter bag so they can update component state.

type OverlaySetters = {
  setVisible: (v: boolean) => void;
  setLoaded: (v: boolean) => void;
};

function buildController(setters: OverlaySetters, autoCloseRef: { current: ReturnType<typeof setTimeout> | null }) {
  function closeOverlay(reason: string) {
    setters.setVisible(false);
    setters.setLoaded(false);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    trackEvent("ad_closed", { ad_placement: "player_midroll", reason });
    unregisterBannerContainer(CONTAINER_ID);
  }

  async function showOverlay(
    loadStartedRef: { current: boolean },
    watchTimeRef: { current: number },
    lastTickRef: { current: number | null },
  ) {
    if (loadStartedRef.current) return;
    if (!canShowMidrollOverlay()) return;

    const device = detectAdDevice();
    const zone = getBestBannerZone(device, [
      device === "mobile" ? "hpf_320x50" : "hpf_300x250",
      "hpf_300x250",
      "hpf_320x50",
    ]);
    if (!zone) return;

    loadStartedRef.current = true;
    markMidrollShown();
    trackEvent("midroll_displayed", { ad_zone: zone.id, ad_format: "banner" });

    const result = await enqueueBannerLoad(zone, CONTAINER_ID).catch(() => ({
      loaded: false as const,
    }));

    if (result.loaded) {
      setters.setLoaded(true);
      setters.setVisible(true);
      trackEvent("ad_visible", {
        ad_zone: zone.id,
        ad_format: "banner",
        ad_placement: "player_midroll",
      });
      autoCloseRef.current = setTimeout(() => {
        closeOverlay("auto_close");
      }, AD_SETTINGS.midrollDisplayMs);
    } else {
      // Reset so it can be retried next interval
      loadStartedRef.current = false;
      watchTimeRef.current = 0;
      lastTickRef.current = null;
    }
  }

  return { closeOverlay, showOverlay };
}

// ─── Component ─────────────────────────────────────────────────────────────

/**
 * PlayerMidrollOverlay — wraps the player and tracks watch time.
 *
 * After TRIGGER_MS of continuous playing state, shows a small ad overlay
 * in the bottom-right corner. The video NEVER pauses.
 * Auto-closes after midrollDisplayMs; has a manual close button.
 */
export function PlayerMidrollOverlay({ isPlaying, children }: Props) {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayLoaded, setOverlayLoaded] = useState(false);

  const watchTimeRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStartedRef = useRef(false);
  // Holds the controller built once on mount — never changes
  const ctrlRef = useRef<ReturnType<typeof buildController> | null>(null);

  // Build controller once on mount, capturing stable state setters
  useEffect(() => {
    const autoClose = autoCloseRef;
    const tickInterval = tickIntervalRef;
    ctrlRef.current = buildController(
      { setVisible: setOverlayVisible, setLoaded: setOverlayLoaded },
      autoClose,
    );
    return () => {
      const timer = autoClose.current;
      const interval = tickInterval.current;
      if (timer) clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, []);

  // Track watch time
  useEffect(() => {
    if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) return;

    if (isPlaying) {
      lastTickRef.current = Date.now();
      tickIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const delta = lastTickRef.current ? now - lastTickRef.current : 0;
        lastTickRef.current = now;
        watchTimeRef.current += delta;

        if (watchTimeRef.current >= TRIGGER_MS && !loadStartedRef.current) {
          void ctrlRef.current?.showOverlay(loadStartedRef, watchTimeRef, lastTickRef);
        }
      }, 10_000);
    } else {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      lastTickRef.current = null;
    }

    return () => {
      const interval = tickIntervalRef.current;
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  return (
    <div className="rifitv-player-midroll-wrapper" style={{ position: "relative" }}>
      {children}
      {overlayLoaded && overlayVisible ? (
        <div className="ad-midroll-overlay" aria-label="إعلان" role="complementary">
          <button
            type="button"
            className="ad-midroll-close"
            onClick={() => ctrlRef.current?.closeOverlay("user_close")}
            aria-label="إغلاق الإعلان"
          >
            <X size={10} aria-hidden="true" />
          </button>
          <div id={CONTAINER_ID} className="ad-midroll-container" />
          <p className="ad-label" aria-hidden="true">إعلان</p>
        </div>
      ) : null}
    </div>
  );
}
