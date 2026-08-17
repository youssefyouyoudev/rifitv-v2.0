"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { detectAdDevice } from "@/lib/ads/device";
import { getBestBannerZone } from "@/lib/ads/AdManager";
import { canShowMobileSticky, markMobileStickyShown } from "@/lib/ads/ad-frequency";
import { AD_SETTINGS, HPF_BANNER_ZONES } from "@/lib/ads/config";
import { enqueueBannerLoad, unregisterBannerContainer } from "@/lib/ads/banner-loader";
import { trackEvent } from "@/lib/analytics";

// Pages where sticky should NOT appear (player/watch context)
const BLOCKED_PATH_PREFIXES = ["/match/", "/live/"];

const CONTAINER_ID = "rifitv-mobile-sticky-banner";

/**
 * MobileStickyAd — fixed 320x50 banner at the bottom of the screen (mobile only).
 *
 * - Respects safe-area-inset-bottom so it never covers the home indicator on iOS.
 * - Positioned below the site content but above nothing critical.
 * - Auto-hides after 30 seconds (configurable).
 * - Has a visible close (X) button.
 * - Never shows on watch/match player pages.
 * - Never shows twice per session.
 */
export function MobileStickyAd() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStarted = useRef(false);

  const isBlockedPath = BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (
      !AD_SETTINGS.enabled ||
      !AD_SETTINGS.normalEnabled ||
      !AD_SETTINGS.mobileEnabled ||
      isBlockedPath
    ) {
      return;
    }

    const device = detectAdDevice();
    if (device !== "mobile") return;

    if (!canShowMobileSticky()) return;

    const zone = getBestBannerZone("mobile", ["hpf_320x50"]);
    if (!zone) return;

    if (loadStarted.current) return;
    loadStarted.current = true;
    markMobileStickyShown();

    enqueueBannerLoad(zone, CONTAINER_ID).then((result) => {
      if (result.loaded) {
        setLoaded(true);
        setVisible(true);
        trackEvent("ad_visible", { ad_zone: zone.id, ad_format: "banner", ad_placement: "mobile_sticky" });

        autoHideRef.current = setTimeout(() => {
          setVisible(false);
          trackEvent("ad_closed", { ad_zone: zone.id, ad_format: "banner", ad_placement: "mobile_sticky", reason: "auto_hide" });
        }, AD_SETTINGS.mobileStickyAutoHideMs);
      }
    }).catch(() => undefined);

    return () => {
      if (autoHideRef.current) clearTimeout(autoHideRef.current);
      unregisterBannerContainer(CONTAINER_ID);
    };
    // Only run once per mount — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide when navigating to blocked paths — deferred to avoid synchronous setState in effect
  useEffect(() => {
    if (!isBlockedPath) return;
    const id = requestAnimationFrame(() => setVisible(false));
    return () => cancelAnimationFrame(id);
  }, [isBlockedPath]);

  if (!loaded && !visible) return null;

  return (
    <div
      className="ad-mobile-sticky"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 35, // Below mobile nav (z-40) but above normal content
        display: visible ? "flex" : "none",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
      aria-label="إعلان"
    >
      <div
        id={CONTAINER_ID}
        style={{ width: HPF_BANNER_ZONES.hpf_320x50.size.width, height: HPF_BANNER_ZONES.hpf_320x50.size.height, overflow: "hidden" }}
      />
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          trackEvent("ad_closed", { ad_placement: "mobile_sticky", reason: "user_close" });
        }}
        style={{
          position: "absolute",
          top: 0,
          right: "0.25rem",
          display: "grid",
          placeItems: "center",
          width: "2rem",
          height: "2rem",
          minHeight: "unset",
          background: "var(--surface-muted)",
          border: "1px solid var(--border)",
          borderRadius: "50%",
          cursor: "pointer",
          color: "var(--muted)",
        }}
        aria-label="إغلاق الإعلان"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
