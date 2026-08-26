"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  canShowInterstitialOpportunity,
  markInterstitialShown,
  recordAdPageView,
} from "@/lib/ads/ad-frequency";
import { loadEcpmSupplementalScripts, requestAggressiveAd } from "@/lib/ads/AdManager";
import { AD_ROUTE_POLICY, AD_SETTINGS, type AdRoute } from "@/lib/ads/config";
import { detectAdDevice, routeForPath } from "@/lib/ads/device";
import { trackEvent } from "@/lib/analytics";

const WATCH_INTENT_ROUTES: AdRoute[] = ["match", "live"];
const ROUTE_INTERSTITIAL_ROUTES: AdRoute[] = ["match", "live", "competition"];

export function AdExperienceController() {
  const pathname = usePathname();
  const lastInterstitialPath = useRef<string | null>(null);

  useEffect(() => {
    if (!AD_SETTINGS.enabled || !AD_SETTINGS.aggressiveEnabled) return;

    const route = routeForPath(pathname);
    const device = detectAdDevice();
    const policy = AD_ROUTE_POLICY[route] ?? AD_ROUTE_POLICY.other;

    recordAdPageView();

    if (!policy.aggressiveAds || device === "tv") {
      return;
    }

    loadEcpmSupplementalScripts();

    if (
      ROUTE_INTERSTITIAL_ROUTES.includes(route) &&
      lastInterstitialPath.current !== pathname &&
      canShowInterstitialOpportunity().allowed
    ) {
      lastInterstitialPath.current = pathname;
      void requestAggressiveAd(route, "route_interstitial", device, { formats: ["vignette"] }).then((result) => {
        if (result.loaded) {
          markInterstitialShown();
          trackEvent("interstitial_triggered", {
            ad_zone: result.zone?.id,
            ad_format: result.zone?.format,
            ad_placement: "route_interstitial",
          });
        }
      });
    }
  }, [pathname]);

  useEffect(() => {
    if (!AD_SETTINGS.enabled || !AD_SETTINGS.aggressiveEnabled) return;

    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target) return;

      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const targetRoute = routeForPath(url.pathname);
      const policy = AD_ROUTE_POLICY[targetRoute] ?? AD_ROUTE_POLICY.other;
      if (!policy.aggressiveAds || !WATCH_INTENT_ROUTES.includes(targetRoute)) return;

      const device = detectAdDevice();
      if (device === "tv") return;

      void requestAggressiveAd(targetRoute, "watch_intent_click", device, {
        formats: ["onclick", "popunder", "direct-link"],
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
