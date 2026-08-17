import { AD_SETTINGS, type AdFormat } from "./config";
import { readLocalValue, readSessionValue, writeLocalValue, writeSessionValue } from "./ad-storage";

const aggressiveCountKey = "rifitv:ads:session-aggressive-count";
const lastAggressiveKey = "rifitv:ads:last-aggressive-at";
const lastDirectLinkKey = "rifitv:ads:last-direct-link-at";
const lastVignetteKey = "rifitv:ads:last-vignette-at";
const prewatchShownKey = "rifitv:ads:prewatch-shown";

export function canShowPrewatchGate(): boolean {
  return AD_SETTINGS.enabled
    && AD_SETTINGS.prewatchEnabled
    && readSessionValue(prewatchShownKey) !== "true"
    && canRequestAggressive("unknown").allowed;
}

export function markPrewatchGateShown(): void {
  writeSessionValue(prewatchShownKey, "true");
}

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
}

function minutesSince(timestamp: number, now: number): number {
  if (!timestamp) return Number.POSITIVE_INFINITY;
  return (now - timestamp) / 60000;
}
