export type AdDevice = "mobile" | "tablet" | "desktop" | "tv";
export type AdRoute = "home" | "matches" | "match" | "live" | "admin" | "playerFullscreen" | "other";
export type AdFormat = "display" | "onclick" | "vignette" | "direct-link" | "unknown";
export type AdAggression = "normal" | "aggressive";
export type AdPlacementName =
  | "homepage_between_sections"
  | "matches_in_feed"
  | "match_below_player"
  | "match_sidebar"
  | "live_between_sections"
  | "prewatch_transition";

export type AdZone = {
  key: string;
  id: string;
  provider: string;
  src?: string;
  directUrl?: string;
  format: AdFormat;
  aggression: AdAggression;
  weight: number;
  enabled: boolean;
  disableOnTv: boolean;
  cfAsync?: false;
};

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true";
}

function numEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const AD_SETTINGS = {
  enabled: boolEnv("NEXT_PUBLIC_RIFITV_ADS_ENABLED", false),
  normalEnabled: boolEnv("NEXT_PUBLIC_RIFITV_NORMAL_ADS_ENABLED", true),
  aggressiveEnabled: boolEnv("NEXT_PUBLIC_RIFITV_AGGRESSIVE_ADS_ENABLED", false),
  mobileEnabled: boolEnv("NEXT_PUBLIC_RIFITV_MOBILE_ADS_ENABLED", true),
  tabletEnabled: boolEnv("NEXT_PUBLIC_RIFITV_TABLET_ADS_ENABLED", true),
  desktopEnabled: boolEnv("NEXT_PUBLIC_RIFITV_DESKTOP_ADS_ENABLED", true),
  tvEnabled: boolEnv("NEXT_PUBLIC_RIFITV_TV_ADS_ENABLED", false),
  prewatchEnabled: boolEnv("NEXT_PUBLIC_RIFITV_PREWATCH_AD_ENABLED", true),
  aggressiveCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_AGGRESSIVE_COOLDOWN", 20),
  maxAggressivePerSession: numEnv("NEXT_PUBLIC_RIFITV_MAX_AGGRESSIVE_PER_SESSION", 2),
  directLinkCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_DIRECT_LINK_COOLDOWN", 30),
  vignetteCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_VIGNETTE_COOLDOWN", 20),
  scriptTimeoutMs: numEnv("NEXT_PUBLIC_RIFITV_AD_SCRIPT_TIMEOUT_MS", 5000),
  prewatchSeconds: numEnv("NEXT_PUBLIC_RIFITV_PREWATCH_SECONDS", 10),
};

export const AD_ZONES: Record<string, AdZone> = {
  zone248721: {
    key: "zone248721",
    id: "248721",
    provider: "quge5.com",
    src: "https://quge5.com/88/tag.min.js",
    format: "onclick",
    aggression: "aggressive",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ZONE_248721_ENABLED", true),
    disableOnTv: true,
    cfAsync: false,
  },
  zone11137945: {
    key: "zone11137945",
    id: "11137945",
    provider: "5gvci.com",
    src: "https://5gvci.com/act/files/tag.min.js?z=11137945",
    format: "unknown",
    aggression: "normal",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ZONE_11137945_ENABLED", true),
    disableOnTv: false,
    cfAsync: false,
  },
  zone11137952: {
    key: "zone11137952",
    id: "11137952",
    provider: "nap5k.com",
    src: "https://nap5k.com/tag.min.js",
    format: "unknown",
    aggression: "normal",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ZONE_11137952_ENABLED", true),
    disableOnTv: true,
  },
  zone11137954: {
    key: "zone11137954",
    id: "11137954",
    provider: "n6wxm.com",
    src: "https://n6wxm.com/vignette.min.js",
    format: "vignette",
    aggression: "aggressive",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ZONE_11137954_ENABLED", true),
    disableOnTv: true,
  },
  zone11137969: {
    key: "zone11137969",
    id: "11137969",
    provider: "omg10.com",
    directUrl: "https://omg10.com/4/11137969",
    format: "direct-link",
    aggression: "aggressive",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ZONE_11137969_ENABLED", true),
    disableOnTv: true,
  },
  zone250801: {
    key: "zone250801",
    id: "250801",
    provider: "quge5.com",
    src: "https://quge5.com/88/tag.min.js",
    format: "onclick",
    aggression: "aggressive",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ZONE_250801_ENABLED", true),
    disableOnTv: true,
    cfAsync: false,
  },
};

export const AD_ROUTE_POLICY: Record<AdRoute, { normalAds: boolean; aggressiveAds: boolean }> = {
  home: { normalAds: true, aggressiveAds: true },
  matches: { normalAds: true, aggressiveAds: true },
  match: { normalAds: true, aggressiveAds: true },
  live: { normalAds: true, aggressiveAds: true },
  admin: { normalAds: false, aggressiveAds: false },
  playerFullscreen: { normalAds: false, aggressiveAds: false },
  other: { normalAds: false, aggressiveAds: false },
};

export const AD_PLACEMENT_ZONES: Record<AdPlacementName, string[]> = {
  homepage_between_sections: ["zone11137945", "zone11137952"],
  matches_in_feed: ["zone11137945", "zone11137952"],
  match_below_player: ["zone11137945", "zone11137952"],
  match_sidebar: ["zone11137945"],
  live_between_sections: ["zone11137945", "zone11137952"],
  prewatch_transition: ["zone11137945"],
};

export const AGGRESSIVE_ROTATION = ["zone11137954", "zone11137969", "zone248721", "zone250801"];
