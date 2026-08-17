"use client";

import { useEffect, useRef, useState, useId } from "react";
import { enqueueBannerLoad, unregisterBannerContainer } from "@/lib/ads/banner-loader";
import { trackEvent } from "@/lib/analytics";
import type { BannerZone } from "@/lib/ads/config";

type Props = {
  zone: BannerZone;
  /** Optional additional CSS classes on the wrapper */
  className?: string;
  /** If true, loads immediately (above the fold). Otherwise uses IntersectionObserver. */
  eager?: boolean;
};

type SlotState = "idle" | "loading" | "loaded" | "failed";

/**
 * BannerAd — renders a HighPerformanceFormat atOptions-based banner.
 *
 * - Reserved dimensions prevent CLS before the ad loads.
 * - Uses IntersectionObserver for below-the-fold lazy loading.
 * - Isolated loading via the serialized banner queue (banner-loader.ts).
 * - Collapses wrapper on failure after timeout.
 * - Never throws into React rendering.
 */
export function BannerAd({ zone, className = "", eager = false }: Props) {
  const uid = useId();
  const containerId = `rifitv-banner-${zone.key}-${uid.replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [slotState, setSlotState] = useState<SlotState>("idle");
  const loadStarted = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;

    const startLoad = () => {
      if (loadStarted.current || cancelled) return;
      loadStarted.current = true;
      setSlotState("loading");

      enqueueBannerLoad(zone, containerId)
        .then((result) => {
          if (cancelled) return;
          setSlotState(result.loaded ? "loaded" : "failed");
          if (result.loaded) {
            trackEvent("ad_visible", { ad_zone: zone.id, ad_format: "banner" });
          }
        })
        .catch(() => {
          if (!cancelled) setSlotState("failed");
        });
    };

    if (eager) {
      startLoad();
      return () => {
        cancelled = true;
        unregisterBannerContainer(containerId);
      };
    }

    // Lazy: use IntersectionObserver, load when ~400px from viewport
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          startLoad();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      unregisterBannerContainer(containerId);
    };
  }, [containerId, zone, eager]);

  // Collapse completely on failure
  if (slotState === "failed") {
    return null;
  }

  return (
    <aside
      aria-label="إعلان"
      className={`ad-banner-wrapper ${className}`.trim()}
      style={{
        width: "100%",
        maxWidth: zone.size.width,
        minHeight: zone.size.height,
      }}
    >
      {slotState === "idle" || slotState === "loading" ? (
        <div
          className="ad-banner-skeleton"
          style={{ width: zone.size.width, height: zone.size.height }}
          aria-hidden="true"
        />
      ) : null}
      <div
        id={containerId}
        ref={containerRef}
        className="ad-banner-container"
        style={{
          width: zone.size.width,
          height: slotState === "loaded" ? zone.size.height : 0,
          overflow: "hidden",
        }}
      />
      {slotState === "loaded" ? (
        <p className="ad-label" aria-hidden="true">إعلان</p>
      ) : null}
    </aside>
  );
}
