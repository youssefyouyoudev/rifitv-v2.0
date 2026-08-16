"use client";

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(name: string, payload: AnalyticsPayload = {}): void {
  const event = { event: name, ...payload };
  window.dispatchEvent(new CustomEvent("rifitv:analytics", { detail: event }));
  window.dataLayer?.push(event);

  if (process.env.NODE_ENV === "development") {
    console.debug("[RiFiTV Analytics]", event);
  }
}
