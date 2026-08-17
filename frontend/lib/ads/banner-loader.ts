/**
 * Isolated HighPerformanceFormat banner loader.
 *
 * Problem: ALL HPF banner sizes share the global `window.atOptions` variable.
 * If two banners initialize simultaneously, the second one overwrites the first's
 * config before invoke.js has finished reading it, causing incorrect ads.
 *
 * Solution: A sequential queue. Banner loads are serialized:
 *   1. Set window.atOptions
 *   2. Load the corresponding invoke.js into the target container
 *   3. Wait for script to load (or timeout)
 *   4. Process the next queued banner
 *
 * Also handles React StrictMode (double-invoke of useEffect) by tracking
 * container IDs that are already loading.
 */

import { trackEvent } from "@/lib/analytics";
import { AD_SETTINGS, type BannerZone } from "./config";

declare global {
  interface Window {
    atOptions?: {
      key: string;
      format: string;
      height: number;
      width: number;
      params?: Record<string, unknown>;
    };
    __rifitvBannerQueue?: BannerQueueEntry[];
    __rifitvBannerRunning?: boolean;
    __rifitvBannerContainers?: Set<string>;
  }
}

type BannerQueueEntry = {
  zone: BannerZone;
  containerId: string;
  resolve: (result: BannerLoadResult) => void;
};

export type BannerLoadResult = {
  loaded: boolean;
  reason?: string;
};

function getQueue(): BannerQueueEntry[] {
  window.__rifitvBannerQueue ??= [];
  return window.__rifitvBannerQueue;
}

function getContainerRegistry(): Set<string> {
  window.__rifitvBannerContainers ??= new Set<string>();
  return window.__rifitvBannerContainers;
}

export function unregisterBannerContainer(containerId: string): void {
  getContainerRegistry().delete(containerId);
}

/**
 * Enqueue a banner load. Returns a promise that resolves when the banner
 * has been initialized (or failed/timed out). Serializes all HPF banner loads.
 */
export function enqueueBannerLoad(zone: BannerZone, containerId: string): Promise<BannerLoadResult> {
  if (!zone.enabled || !AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) {
    return Promise.resolve({ loaded: false, reason: "disabled" });
  }

  const registry = getContainerRegistry();

  // React StrictMode / re-render guard: if this container is already loading or loaded, skip
  if (registry.has(containerId)) {
    return Promise.resolve({ loaded: false, reason: "already_loading" });
  }
  registry.add(containerId);

  return new Promise((resolve) => {
    getQueue().push({ zone, containerId, resolve });
    drainQueue();
  });
}

function drainQueue(): void {
  if (window.__rifitvBannerRunning) {
    return; // Another load is in progress, it will call drainQueue when done
  }

  const queue = getQueue();
  const next = queue.shift();
  if (!next) {
    return;
  }

  window.__rifitvBannerRunning = true;
  void processEntry(next).finally(() => {
    window.__rifitvBannerRunning = false;
    drainQueue();
  });
}

function processEntry(entry: BannerQueueEntry): Promise<void> {
  const { zone, containerId, resolve } = entry;
  const container = document.getElementById(containerId);

  if (!container) {
    trackEvent("ad_failed", { ad_zone: zone.id, reason: "container_missing", ad_format: "banner" });
    resolve({ loaded: false, reason: "container_missing" });
    return Promise.resolve();
  }

  // Clear previous content (e.g. skeleton)
  container.innerHTML = "";

  return new Promise<void>((done) => {
    let settled = false;

    const finish = (result: BannerLoadResult) => {
      if (settled) return;
      settled = true;
      if (result.loaded) {
        trackEvent("ad_loaded", { ad_zone: zone.id, ad_format: "banner", ad_placement: containerId });
      } else {
        trackEvent("ad_failed", { ad_zone: zone.id, reason: result.reason ?? "unknown", ad_format: "banner" });
      }
      resolve(result);
      done();
    };

    const timeoutId = window.setTimeout(() => {
      finish({ loaded: false, reason: "timeout" });
    }, AD_SETTINGS.bannerTimeoutMs);

    // Set atOptions immediately before appending script.
    // This is safe because processEntry runs serially — only one at a time.
    window.atOptions = {
      key: zone.atKey,
      format: "iframe",
      height: zone.size.height,
      width: zone.size.width,
      params: {},
    };

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = zone.invokeUrl;
    script.async = true;

    script.onload = () => {
      window.clearTimeout(timeoutId);
      finish({ loaded: true });
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      finish({ loaded: false, reason: "script_error" });
    };

    // Append to the container so the invoke.js renders inside it
    container.appendChild(script);

    trackEvent("ad_requested", { ad_zone: zone.id, ad_format: "banner", ad_placement: containerId });
  });
}
