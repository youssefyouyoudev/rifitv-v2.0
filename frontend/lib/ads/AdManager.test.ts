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
});
