"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { getBestBannerZone, loadPlacementAd } from "@/lib/ads/AdManager";
import { AD_SETTINGS, type AdPlacementName } from "@/lib/ads/config";
import { detectAdDevice } from "@/lib/ads/device";
import { routeForPath } from "@/lib/ads/device";
import { BannerAd } from "@/components/ads/BannerAd";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * AdPlacement — renders the appropriate banner for a named placement.
 *
 * Selects banner size based on device:
 * - mobile  → 320x50
 * - tablet  → 300x250
 * - desktop → 728x90 (primary) or 300x250 / 468x60 (fallback by placement)
 *
 * Also triggers the script-based zone load (zone11137945 etc.) for placements
 * that have them configured in AD_PLACEMENT_ZONES.
 */

const PLACEMENT_SIZE_MAP: Record<
  AdPlacementName,
  { desktop: string[]; tablet: string[]; mobile: string[] }
> = {
  home_leaderboard: {
    desktop: ["hpf_728x90"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  home_footer: {
    desktop: ["hpf_468x60", "hpf_300x250"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  homepage_between_sections: {
    desktop: ["hpf_728x90", "hpf_468x60"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  matches_in_feed: {
    desktop: ["hpf_728x90"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  match_below_player: {
    desktop: ["hpf_300x250", "hpf_728x90"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  match_sidebar: {
    desktop: ["hpf_160x300"],
    tablet: ["hpf_300x250"],
    mobile: [],
  },
  match_sidebar_wide: {
    desktop: ["hpf_160x600", "hpf_160x300"],
    tablet: [],
    mobile: [],
  },
  live_between_sections: {
    desktop: ["hpf_728x90", "hpf_468x60"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  prewatch_transition: {
    desktop: ["hpf_728x90", "hpf_300x250"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
  feed_native: { desktop: [], tablet: [], mobile: [] },
  mobile_sticky: { desktop: [], tablet: [], mobile: ["hpf_320x50"] },
  player_midroll: {
    desktop: ["hpf_300x250"],
    tablet: ["hpf_300x250"],
    mobile: ["hpf_320x50"],
  },
};

export function AdPlacement({ name, eager = false }: { name: AdPlacementName; eager?: boolean }) {
  const pathname = usePathname();

  const { device, zone } = useMemo(() => {
    if (typeof window === "undefined") return { device: "desktop" as const, zone: null };
    const d = detectAdDevice();
    const sizes =
      d === "mobile"
        ? PLACEMENT_SIZE_MAP[name].mobile
        : d === "tablet"
          ? PLACEMENT_SIZE_MAP[name].tablet
          : PLACEMENT_SIZE_MAP[name].desktop;
    return { device: d, zone: getBestBannerZone(d, sizes) };
  }, [name]);

  // Also trigger script-based zone load (zone11137945 etc.) for this placement
  useEffect(() => {
    if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) return;
    const route = routeForPath(pathname);
    void loadPlacementAd(name, route, device).then((result) => {
      if (result.loaded) {
        trackEvent("ad_loaded", { ad_placement: name, ad_zone: result.zone?.id, ad_format: result.zone?.format });
      }
    });
  }, [name, pathname, device]);

  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) {
    return null;
  }

  if (!zone) {
    return null;
  }

  return (
    <div className="ad-placement-wrapper" data-ad-placement={name}>
      <BannerAd zone={zone} eager={eager} />
    </div>
  );
}
