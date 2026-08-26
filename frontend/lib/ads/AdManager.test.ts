import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

async function loadManager() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_RIFITV_ADS_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_RIFITV_NORMAL_ADS_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_RIFITV_AGGRESSIVE_ADS_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_RIFITV_TV_ADS_ENABLED", "false");

  return import("./AdManager");
}

async function resolveScriptLoad<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(5);
  document.querySelector("script[data-rifitv-ad-zone]")?.dispatchEvent(new Event("load"));

  return promise;
}

describe("AdManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.unstubAllEnvs();
    document.body.innerHTML = "";
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("never loads zone 11137952 twice", async () => {
    const manager = await loadManager();
    manager.resetAdManagerForTests();
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const firstPromise = manager.loadPlacementAd("homepage_between_sections", "home", "desktop");
    const first = await resolveScriptLoad(firstPromise);
    const second = await manager.loadPlacementAd("homepage_between_sections", "home", "desktop");

    expect(first.zone?.id).toBe("11137952");
    expect(second.reason).toBe("deduped");
    expect(document.querySelectorAll('[data-rifitv-ad-zone="11137952"]')).toHaveLength(1);
  });

  it("blocks advertising on admin routes", async () => {
    const manager = await loadManager();

    expect(manager.eligibleForAds("admin", "desktop", "normal")).toMatchObject({ allowed: false });
    expect(manager.eligibleForAds("admin", "desktop", "aggressive")).toMatchObject({ allowed: false });
  });

  it("keeps ordinary unknown routes out of the ad surface", async () => {
    const manager = await loadManager();

    expect(manager.eligibleForAds("other", "desktop", "normal")).toMatchObject({ allowed: false });
    expect(manager.eligibleForAds("other", "desktop", "aggressive")).toMatchObject({ allowed: false });
  });

  it("does not serve aggressive ads to TV devices", async () => {
    const manager = await loadManager();
    const result = await manager.requestAggressiveAd("match", "prewatch_transition", "tv");

    expect(result.loaded).toBe(false);
    expect(result.reason).toBe("tv_disabled");
  });

  it("frequency caps aggressive requests", async () => {
    const manager = await loadManager();
    manager.resetAdManagerForTests();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const firstPromise = manager.requestAggressiveAd("match", "prewatch_transition", "desktop");
    const first = await resolveScriptLoad(firstPromise);
    const second = await manager.requestAggressiveAd("match", "prewatch_transition", "desktop");

    expect(first.loaded).toBe(true);
    expect(second.loaded).toBe(false);
    expect(second.reason).toBe("aggressive_cooldown");
  });

  it("handles ad script failures without throwing", async () => {
    const manager = await loadManager();
    manager.resetAdManagerForTests();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const promise = manager.loadPlacementAd("homepage_between_sections", "home", "desktop");
    await vi.advanceTimersByTimeAsync(5);
    document.querySelector("script[data-rifitv-ad-zone]")?.dispatchEvent(new Event("error"));
    const result = await promise;

    expect(result.loaded).toBe(false);
    expect(result.reason).toBe("script_error");
  });

  it("getBestBannerZone returns correct zone for device", async () => {
    const manager = await loadManager();

    const mobileZone = manager.getBestBannerZone("mobile", ["hpf_320x50"]);
    expect(mobileZone?.key).toBe("hpf_320x50");
    expect(mobileZone?.size).toEqual({ width: 320, height: 50 });

    const desktopZone = manager.getBestBannerZone("desktop", ["hpf_728x90"]);
    expect(desktopZone?.key).toBe("hpf_728x90");
    expect(desktopZone?.size).toEqual({ width: 728, height: 90 });

    // Mobile device should not get desktop-only zone
    const noZone = manager.getBestBannerZone("mobile", ["hpf_728x90"]);
    expect(noZone).toBeNull();
  });

  it("returns null from getBestBannerZone when ads disabled", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RIFITV_ADS_ENABLED", "false");
    const manager = await import("./AdManager");
    const zone = manager.getBestBannerZone("desktop", ["hpf_728x90"]);
    expect(zone).toBeNull();
  });

  it("does not load banner inventory when banner ads are disabled", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RIFITV_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_RIFITV_NORMAL_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_RIFITV_BANNER_ADS_ENABLED", "false");

    const manager = await import("./AdManager");

    expect(manager.getBestBannerZone("desktop", ["hpf_728x90"])).toBeNull();
    await expect(manager.loadPlacementAd("matches_top", "matches", "desktop")).resolves.toMatchObject({
      loaded: false,
      reason: "banner_disabled",
    });
    expect(document.querySelectorAll("script[data-rifitv-ad-zone]")).toHaveLength(0);
  });

  it("does not select direct-link zones when direct-link ads are disabled", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_RIFITV_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_RIFITV_AGGRESSIVE_ADS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_RIFITV_DIRECT_LINK_ADS_ENABLED", "false");

    const manager = await import("./AdManager");
    const openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const result = await manager.requestAggressiveAd("match", "watch_intent_click", "desktop", {
      formats: ["direct-link"],
    });

    expect(result).toMatchObject({ loaded: false, reason: "no_aggressive_zone" });
    expect(openSpy).not.toHaveBeenCalled();
  });
});
