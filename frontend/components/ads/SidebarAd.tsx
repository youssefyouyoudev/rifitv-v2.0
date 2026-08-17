"use client";

import { useEffect, useState } from "react";
import { detectAdDevice } from "@/lib/ads/device";
import { getBestBannerZone } from "@/lib/ads/AdManager";
import { AD_SETTINGS } from "@/lib/ads/config";
import { BannerAd } from "./BannerAd";

/**
 * SidebarAd — renders the best available vertical banner in a sidebar context.
 *
 * Breakpoints:
 * - ≥1280px: 160x600 (skyscraper)
 * - 1024–1279px: 160x300 (half-page)
 * - <1024px: hidden entirely (via CSS)
 *
 * Only renders on desktop devices. Mobile and tablet get nothing.
 */
export function SidebarAd() {
  // null = not yet mounted (SSR / first render), number = client viewport width
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  useEffect(() => {
    // Deferred via requestAnimationFrame so the first setState is not synchronous
    // within the effect body — satisfies react-hooks/set-state-in-effect rule
    const frameId = requestAnimationFrame(() => {
      setViewportWidth(window.innerWidth);
    });

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Not yet mounted on client
  if (viewportWidth === null || !AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) {
    return null;
  }

  const device = detectAdDevice();
  if (device === "mobile" || device === "tablet" || device === "tv") {
    return null;
  }

  const preferredKeys =
    viewportWidth >= 1280
      ? ["hpf_160x600", "hpf_160x300"]
      : ["hpf_160x300"];

  const zone = getBestBannerZone(device, preferredKeys);
  if (!zone) return null;

  return (
    <aside className="ad-sidebar-wrapper" aria-label="إعلان">
      <BannerAd zone={zone} />
    </aside>
  );
}
