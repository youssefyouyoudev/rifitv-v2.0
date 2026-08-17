import { AD_SETTINGS, type AdFormat } from "./config";
import { readLocalValue, readSessionValue, writeLocalValue, writeSessionValue } from "./ad-storage";

const aggressiveCountKey = "rifitv:ads:session-aggressive-count";
const lastAggressiveKey = "rifitv:ads:last-aggressive-at";
const lastDirectLinkKey = "rifitv:ads:last-direct-link-at";
const lastVignetteKey = "rifitv:ads:last-vignette-at";
const lastPopKey = "rifitv:ads:last-pop-at";
const prewatchShownKey = "rifitv:ads:prewatch-shown";
const midrollLastShownKey = "rifitv:ads:last-midroll-at";
const mobileStickyShownKey = "rifitv:ads:sticky-shown-this-view";

// ---------------------------------------------------------------------------
// Pre-watch gate
// ---------------------------------------------------------------------------

export function canShowPrewatchGate(): boolean {
  return (
    AD_SETTINGS.enabled &&
    AD_SETTINGS.prewatchEnabled &&
    readSessionValue(prewatchShownKey) !== "true" &&
    canRequestAggressive("unknown").allowed
  );
}

export function markPrewatchGateShown(): void {
  writeSessionValue(prewatchShownKey, "true");
}

// ---------------------------------------------------------------------------
// Aggressive ad frequency
// ---------------------------------------------------------------------------

export function canRequestAggressive(format: AdFormat, now = Date.now()): { allowed: boolean; reason?: string } {
  if (!AD_SETTINGS.enabled) return { allowed: false, reason: "ads_disabled" };
  if (!AD_SETTINGS.aggressiveEnabled) return { allowed: false, reason: "aggressive_disabled" };

  const sessionCount = Number(readSessionValue(aggressiveCountKey) ?? 0);
  if (sessionCount >= AD_SETTINGS.maxAggressivePerSession) {
    return { allowed: false, reason: "session_cap" };
  }

  const lastAggressiveAt = Number(readLocalValue(lastAggressiveKey) ?? 0);
  if (minutesSince(lastAggressiveAt, now) < AD_SETTINGS.aggressiveCooldownMinutes) {
    return { allowed: false, reason: "aggressive_cooldown" };
  }

  if (format === "direct-link") {
    const lastDirectLinkAt = Number(readLocalValue(lastDirectLinkKey) ?? 0);
    if (minutesSince(lastDirectLinkAt, now) < AD_SETTINGS.directLinkCooldownMinutes) {
      return { allowed: false, reason: "direct_link_cooldown" };
    }
  }

  if (format === "vignette") {
    const lastVignetteAt = Number(readLocalValue(lastVignetteKey) ?? 0);
    if (minutesSince(lastVignetteAt, now) < AD_SETTINGS.vignetteCooldownMinutes) {
      return { allowed: false, reason: "vignette_cooldown" };
    }
  }

  if (format === "onclick") {
    const lastPopAt = Number(readLocalValue(lastPopKey) ?? 0);
    if (minutesSince(lastPopAt, now) < AD_SETTINGS.popCooldownMinutes) {
      return { allowed: false, reason: "pop_cooldown" };
    }
  }

  return { allowed: true };
}

export function markAggressiveRequested(format: AdFormat, now = Date.now()): void {
  const sessionCount = Number(readSessionValue(aggressiveCountKey) ?? 0);
  writeSessionValue(aggressiveCountKey, String(sessionCount + 1));
  writeLocalValue(lastAggressiveKey, String(now));

  if (format === "direct-link") {
    writeLocalValue(lastDirectLinkKey, String(now));
  }

  if (format === "vignette") {
    writeLocalValue(lastVignetteKey, String(now));
  }

  if (format === "onclick") {
    writeLocalValue(lastPopKey, String(now));
  }
}

// ---------------------------------------------------------------------------
// Mid-roll overlay (30-min viewing intervals)
// ---------------------------------------------------------------------------

export function canShowMidrollOverlay(now = Date.now()): boolean {
  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) return false;
  const lastAt = Number(readLocalValue(midrollLastShownKey) ?? 0);
  return minutesSince(lastAt, now) >= AD_SETTINGS.midrollIntervalMinutes;
}

export function markMidrollShown(now = Date.now()): void {
  writeLocalValue(midrollLastShownKey, String(now));
}

// ---------------------------------------------------------------------------
// Mobile sticky (once per page view/session, resets on navigation)
// ---------------------------------------------------------------------------

export function canShowMobileSticky(): boolean {
  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) return false;
  return readSessionValue(mobileStickyShownKey) !== "true";
}

export function markMobileStickyShown(): void {
  writeSessionValue(mobileStickyShownKey, "true");
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function minutesSince(timestamp: number, now: number): number {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  return (now - timestamp) / 60000;
}
