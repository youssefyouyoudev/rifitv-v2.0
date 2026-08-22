"use client";

import { useEffect, useRef, useState } from "react";
import { loadNativeAd } from "@/lib/ads/AdManager";
import { AD_SETTINGS, NATIVE_AD } from "@/lib/ads/config";
import { trackEvent } from "@/lib/analytics";

type Props = {
  /** Optional additional CSS classes */
  className?: string;
  /** Skip IntersectionObserver and load immediately */
  eager?: boolean;
};

type SlotState = "idle" | "loading" | "loaded" | "failed";

/**
 * NativeAd — renders the effectivecpmnetwork.com native ad unit.
 *
 * Creates the provider-required container div, then loads the native invoke.js into it.
 */
export function NativeAd({ className = "", eager = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [slotState, setSlotState] = useState<SlotState>("idle");
  const loadStarted = useRef(false);
  const containerId = NATIVE_AD.containerId;
  // Capture disabled state synchronously so we don't setState inside effect
  const isDisabled = !AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled || !NATIVE_AD.enabled;

  useEffect(() => {
    // If ads are disabled, defer the state update out of the synchronous effect body
    if (isDisabled) {
      const id = requestAnimationFrame(() => setSlotState("failed"));
      return () => cancelAnimationFrame(id);
    }

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let cancelled = false;

    const startLoad = () => {
      if (loadStarted.current || cancelled) return;
      loadStarted.current = true;
      setSlotState("loading");

      loadNativeAd(containerId)
        .then((result) => {
          if (cancelled) return;
          setSlotState(result.loaded ? "loaded" : "failed");
          if (result.loaded) {
            trackEvent("ad_visible", { ad_zone: "native_ecpm", ad_format: "native" });
          }
        })
        .catch(() => {
          if (!cancelled) setSlotState("failed");
        });
    };

    if (eager) {
      startLoad();
      return () => { cancelled = true; };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          startLoad();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(wrapper);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [containerId, eager, isDisabled]);

  if (slotState === "failed") return null;

  return (
    <aside
      aria-label="إعلان ممول"
      ref={wrapperRef}
      className={`ad-native-wrapper ${className}`.trim()}
    >
      <p className="ad-label" aria-hidden="true">إعلان ممول</p>
      <div
        id={containerId}
        className="ad-native-container"
        style={{ minHeight: slotState === "loaded" ? undefined : "250px" }}
      />
    </aside>
  );
}
