"use client";

import { API_BASE } from "./api";

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(name: string, payload: AnalyticsPayload = {}): void {
  if (typeof window === "undefined") {
    return;
  }

  const event = {
    event: name,
    ...payload,
    path: payload.path ?? window.location.pathname,
    source: payload.source ?? trafficSource(),
    device_category: payload.device_category ?? deviceCategory(),
  };
  window.dispatchEvent(new CustomEvent("rifitv:analytics", { detail: event }));
  window.dataLayer?.push(event);
  sendToApi(event);

  if (process.env.NODE_ENV === "development") {
    console.debug("[RiFiTV Analytics]", event);
  }
}

function sendToApi(event: Record<string, string | number | boolean | null | undefined>): void {
  const body = JSON.stringify({
    event: event.event,
    visitor_id: visitorId(),
    path: event.path,
    payload: Object.fromEntries(Object.entries(event).filter(([key]) => key !== "event" && key !== "path")),
  });
  const blob = new Blob([body], { type: "application/json" });

  if (navigator.sendBeacon?.(`${API_BASE}/analytics/events`, blob)) {
    return;
  }

  void fetch(`${API_BASE}/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function visitorId(): string {
  const key = "rifitv:visitor-id";

  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      return existing;
    }

    const created = window.crypto.randomUUID();
    window.localStorage.setItem(key, created);

    return created;
  } catch {
    return "session-unknown";
  }
}

function trafficSource(): string {
  const referrer = document.referrer;

  if (!referrer) {
    return "direct";
  }

  try {
    const referrerUrl = new URL(referrer);
    if (referrerUrl.origin === window.location.origin) {
      return "internal";
    }

    return /google\.|bing\.|yahoo\.|duckduckgo\./i.test(referrerUrl.hostname) ? "organic" : "referral";
  } catch {
    return "referral";
  }
}

function deviceCategory(): string {
  const userAgent = navigator.userAgent;

  if (/tablet|ipad/i.test(userAgent)) {
    return "tablet";
  }

  return /mobile|android|iphone/i.test(userAgent) ? "mobile" : "desktop";
}
