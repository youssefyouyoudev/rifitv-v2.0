"use client";

import { trackEvent } from "@/lib/analytics";
import { canRequestAggressive, markAggressiveRequested } from "./ad-frequency";
import {
  AD_PLACEMENT_ZONES,
  AD_ROUTE_POLICY,
  AD_SETTINGS,
  AD_ZONES,
  AGGRESSIVE_ROTATION,
  ECPM_SCRIPTS,
  HPF_BANNER_ZONES,
  NATIVE_AD,
  type AdAggression,
  type AdDevice,
  type AdPlacementName,
  type AdRoute,
  type AdZone,
  type BannerZone,
} from "./config";
import { detectAdDevice } from "./device";

declare global {
  interface Window {
    __rifitvLoadedAdZones?: Set<string>;
  }
}

// Module-level dedup (SSR-safe fallback for SSR context)
const loadedZones = new Set<string>();

export type AdLoadResult = { loaded: boolean; zone?: AdZone; reason?: string };
export type BannerAdResult = { loaded: boolean; zone?: BannerZone; reason?: string };

export function resetAdManagerForTests(): void {
  loadedZones.clear();
  if (typeof window !== "undefined") {
    window.__rifitvLoadedAdZones = new Set<string>();
    document.querySelectorAll("[data-rifitv-ad-zone]").forEach((element) => element.remove());
  }
}

// ---------------------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------------------

export function eligibleForAds(
  route: AdRoute,
  device: AdDevice,
  aggression: AdAggression,
): { allowed: boolean; reason?: string } {
  if (!AD_SETTINGS.enabled) return { allowed: false, reason: "ads_disabled" };
  if (device === "mobile" && !AD_SETTINGS.mobileEnabled) return { allowed: false, reason: "mobile_disabled" };
  if (device === "tablet" && !AD_SETTINGS.tabletEnabled) return { allowed: false, reason: "tablet_disabled" };
  if (device === "desktop" && !AD_SETTINGS.desktopEnabled) return { allowed: false, reason: "desktop_disabled" };
  if (device === "tv" && !AD_SETTINGS.tvEnabled) return { allowed: false, reason: "tv_disabled" };

  const policy = AD_ROUTE_POLICY[route] ?? AD_ROUTE_POLICY.other;
  if (aggression === "normal" && (!AD_SETTINGS.normalEnabled || !policy.normalAds)) {
    return { allowed: false, reason: "normal_policy_blocked" };
  }
  if (aggression === "aggressive" && (!AD_SETTINGS.aggressiveEnabled || !policy.aggressiveAds)) {
    return { allowed: false, reason: "aggressive_policy_blocked" };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Placement ad loading (script-based zones e.g. zone11137945)
// ---------------------------------------------------------------------------

export async function loadPlacementAd(
  placement: AdPlacementName,
  route: AdRoute,
  device = detectAdDevice(),
): Promise<AdLoadResult> {
  const allowed = eligibleForAds(route, device, "normal");
  if (!allowed.allowed) {
    trackEvent("ad_blocked", { ad_placement: placement, reason: allowed.reason ?? "blocked", device_category: device });
    return { loaded: false, reason: allowed.reason };
  }

  const zone = chooseZone(AD_PLACEMENT_ZONES[placement], device, "normal");
  if (!zone) {
    return { loaded: false, reason: "no_zone" };
  }

  trackEvent("ad_requested", {
    ad_zone: zone.id,
    ad_placement: placement,
    ad_format: zone.format,
    device_category: device,
  });
  return loadScriptZone(zone, placement);
}

// ---------------------------------------------------------------------------
// Aggressive ad request
// ---------------------------------------------------------------------------

export async function requestAggressiveAd(
  route: AdRoute,
  reason: string,
  device = detectAdDevice(),
): Promise<AdLoadResult> {
  const allowed = eligibleForAds(route, device, "aggressive");
  if (!allowed.allowed) {
    trackEvent("ad_blocked", { reason: allowed.reason ?? "blocked", ad_placement: reason, device_category: device });
    return { loaded: false, reason: allowed.reason };
  }

  const zone = chooseZone(AGGRESSIVE_ROTATION, device, "aggressive");
  if (!zone) {
    return { loaded: false, reason: "no_aggressive_zone" };
  }

  const frequency = canRequestAggressive(zone.format);
  if (!frequency.allowed) {
    trackEvent("ad_blocked", {
      ad_zone: zone.id,
      reason: frequency.reason ?? "frequency",
      ad_placement: reason,
      device_category: device,
    });
    return { loaded: false, reason: frequency.reason };
  }

  markAggressiveRequested(zone.format);
  trackEvent("aggressive_ad_triggered", {
    ad_zone: zone.id,
    ad_placement: reason,
    ad_format: zone.format,
    device_category: device,
  });

  if (zone.format === "direct-link" && zone.directUrl) {
    const opened = window.open(zone.directUrl, "_blank", "noopener,noreferrer");
    trackEvent(opened ? "ad_loaded" : "ad_failed", {
      ad_zone: zone.id,
      ad_placement: reason,
      ad_format: zone.format,
      device_category: device,
    });
    return { loaded: Boolean(opened), zone, reason: opened ? undefined : "popup_blocked" };
  }

  return loadScriptZone(zone, reason);
}

// ---------------------------------------------------------------------------
// effectivecpmnetwork supplemental scripts (pl30892961, pl30892962)
// These are loaded once globally — not tied to specific placements.
// ---------------------------------------------------------------------------

export function loadEcpmSupplementalScripts(): void {
  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) return;
  if (typeof document === "undefined") return;

  for (const entry of Object.values(ECPM_SCRIPTS)) {
    if (!entry.enabled) continue;
    if (document.getElementById(entry.id)) continue; // already loaded

    const script = document.createElement("script");
    script.id = entry.id;
    script.src = entry.src;
    script.async = true;
    script.setAttribute("data-rifitv-ad-zone", entry.id);
    document.body.appendChild(script);
  }
}

// ---------------------------------------------------------------------------
// Native ad loading
// ---------------------------------------------------------------------------

export function loadNativeAd(targetContainerId: string): Promise<{ loaded: boolean; reason?: string }> {
  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled || !NATIVE_AD.enabled) {
    return Promise.resolve({ loaded: false, reason: "disabled" });
  }
  if (typeof document === "undefined") {
    return Promise.resolve({ loaded: false, reason: "ssr" });
  }

  const container = document.getElementById(targetContainerId);
  if (!container) {
    return Promise.resolve({ loaded: false, reason: "container_missing" });
  }

  const scriptId = `${NATIVE_AD.scriptId}_${targetContainerId}`;
  if (document.getElementById(scriptId)) {
    return Promise.resolve({ loaded: false, reason: "deduped" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      trackEvent("ad_failed", { ad_zone: "native_ecpm", reason: "timeout", ad_format: "native" });
      resolve({ loaded: false, reason: "timeout" });
    }, AD_SETTINGS.bannerTimeoutMs);

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = NATIVE_AD.invokeUrl;
    script.async = true;
    script.setAttribute("data-rifitv-ad-zone", scriptId);

    script.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      trackEvent("ad_loaded", { ad_zone: "native_ecpm", ad_format: "native" });
      resolve({ loaded: true });
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      trackEvent("ad_failed", { ad_zone: "native_ecpm", reason: "script_error", ad_format: "native" });
      resolve({ loaded: false, reason: "script_error" });
    };

    container.appendChild(script);
    trackEvent("ad_requested", { ad_zone: "native_ecpm", ad_format: "native" });
  });
}

// ---------------------------------------------------------------------------
// Smart banner zone selection by device + size preference
// ---------------------------------------------------------------------------

export function getBestBannerZone(device: AdDevice, preferredSizes: string[]): BannerZone | null {
  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) return null;

  for (const key of preferredSizes) {
    const zone = HPF_BANNER_ZONES[key];
    if (!zone?.enabled) continue;
    if (!zone.devices.includes(device)) continue;
    return zone;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function chooseZone(keys: string[], device: AdDevice, aggression: AdAggression): AdZone | null {
  const candidates = keys
    .map((key) => AD_ZONES[key])
    .filter((zone): zone is AdZone => Boolean(zone))
    .filter((zone) => zone.enabled && zone.aggression === aggression)
    .filter((zone) => !(device === "tv" && zone.disableOnTv));

  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((total, zone) => total + Math.max(1, zone.weight), 0);
  let cursor = Math.random() * totalWeight;

  for (const zone of candidates) {
    cursor -= Math.max(1, zone.weight);
    if (cursor <= 0) {
      return zone;
    }
  }

  return candidates[0] ?? null;
}

function zoneRegistry(): Set<string> {
  if (typeof window === "undefined") {
    return loadedZones;
  }

  window.__rifitvLoadedAdZones ??= new Set<string>();
  return window.__rifitvLoadedAdZones;
}

function loadScriptZone(zone: AdZone, placement: string): Promise<AdLoadResult> {
  if (!zone.src) {
    return Promise.resolve({ loaded: false, reason: "missing_src" });
  }
  const src = zone.src;

  const registry = zoneRegistry();
  if (
    registry.has(zone.id) ||
    loadedZones.has(zone.id) ||
    document.querySelector(`[data-rifitv-ad-zone="${zone.id}"]`)
  ) {
    trackEvent("ad_blocked", { ad_zone: zone.id, ad_placement: placement, reason: "deduped", ad_format: zone.format });
    return Promise.resolve({ loaded: false, zone, reason: "deduped" });
  }

  registry.add(zone.id);
  loadedZones.add(zone.id);

  return new Promise((resolve) => {
    let settled = false;
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.dataset.rifitvAdZone = zone.id;
    script.dataset.zone = zone.id;
    if (zone.cfAsync === false) {
      script.setAttribute("data-cfasync", "false");
    }

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      registry.delete(zone.id);
      loadedZones.delete(zone.id);
      trackEvent("ad_failed", { ad_zone: zone.id, ad_placement: placement, reason: "timeout", ad_format: zone.format });
      resolve({ loaded: false, zone, reason: "timeout" });
    }, AD_SETTINGS.scriptTimeoutMs);

    script.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      trackEvent("ad_loaded", { ad_zone: zone.id, ad_placement: placement, ad_format: zone.format });
      resolve({ loaded: true, zone });
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      registry.delete(zone.id);
      loadedZones.delete(zone.id);
      trackEvent("ad_failed", {
        ad_zone: zone.id,
        ad_placement: placement,
        reason: "script_error",
        ad_format: zone.format,
      });
      resolve({ loaded: false, zone, reason: "script_error" });
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => document.body.appendChild(script), { timeout: 2000 });
    } else {
      window.setTimeout(() => document.body.appendChild(script), 1);
    }
  });
}
