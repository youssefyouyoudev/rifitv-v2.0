export type AdDevice = "mobile" | "tablet" | "desktop" | "tv";
export type AdRoute = "home" | "matches" | "match" | "live" | "admin" | "playerFullscreen" | "other";
export type AdFormat = "display" | "banner" | "native" | "onclick" | "vignette" | "direct-link" | "unknown";
export type AdAggression = "normal" | "aggressive";

export type AdPlacementName =
  | "homepage_between_sections"
  | "matches_in_feed"
  | "match_below_player"
  | "match_sidebar"
  | "match_sidebar_wide"
  | "live_between_sections"
  | "prewatch_transition"
  | "home_leaderboard"
  | "home_footer"
  | "feed_native"
  | "mobile_sticky"
  | "player_midroll";

export type AdBannerSize = {
  width: number;
  height: number;
};

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

/** HighPerformanceFormat banner zone — uses window.atOptions + invoke.js */
export type BannerZone = {
  key: string;
  id: string;
  provider: string;
  atKey: string;
  invokeUrl: string;
  size: AdBannerSize;
  enabled: boolean;
  devices: AdDevice[];
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
  // Cooldowns (minutes)
  aggressiveCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_AGGRESSIVE_COOLDOWN", 30),
  maxAggressivePerSession: numEnv("NEXT_PUBLIC_RIFITV_MAX_AGGRESSIVE_PER_SESSION", 2),
  directLinkCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_DIRECT_LINK_COOLDOWN", 45),
  vignetteCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_VIGNETTE_COOLDOWN", 45),
  popCooldownMinutes: numEnv("NEXT_PUBLIC_RIFITV_POP_COOLDOWN", 30),
  midrollIntervalMinutes: numEnv("NEXT_PUBLIC_RIFITV_MIDROLL_INTERVAL", 30),
  // Timeouts
  scriptTimeoutMs: numEnv("NEXT_PUBLIC_RIFITV_AD_SCRIPT_TIMEOUT_MS", 5000),
  bannerTimeoutMs: numEnv("NEXT_PUBLIC_RIFITV_BANNER_TIMEOUT_MS", 5000),
  // UX
  prewatchSeconds: numEnv("NEXT_PUBLIC_RIFITV_PREWATCH_SECONDS", 10),
  mobileStickyAutoHideMs: numEnv("NEXT_PUBLIC_RIFITV_STICKY_AUTO_HIDE_MS", 30000),
  midrollDisplayMs: numEnv("NEXT_PUBLIC_RIFITV_MIDROLL_DISPLAY_MS", 18000),
};

// ---------------------------------------------------------------------------
// HighPerformanceFormat Banner Zones (real production keys)
// Each has a unique invoke.js URL — they are NOT deduplicated by zone ID
// because each banner size is a distinct zone with a different script.
// ---------------------------------------------------------------------------
export const HPF_BANNER_ZONES: Record<string, BannerZone> = {
  hpf_728x90: {
    key: "hpf_728x90",
    id: "hpf_728x90",
    provider: "highperformanceformat.com",
    atKey: "c0dca785521bcdfb75a5663d08d8a8dd",
    invokeUrl: "https://www.highperformanceformat.com/c0dca785521bcdfb75a5663d08d8a8dd/invoke.js",
    size: { width: 728, height: 90 },
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_HPF_728X90_ENABLED", true),
    devices: ["desktop", "tablet"],
  },
  hpf_468x60: {
    key: "hpf_468x60",
    id: "hpf_468x60",
    provider: "highperformanceformat.com",
    atKey: "0dc49ea90c4ad13a1dddd0b73f4080c7",
    invokeUrl: "https://www.highperformanceformat.com/0dc49ea90c4ad13a1dddd0b73f4080c7/invoke.js",
    size: { width: 468, height: 60 },
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_HPF_468X60_ENABLED", true),
    devices: ["desktop"],
  },
  hpf_320x50: {
    key: "hpf_320x50",
    id: "hpf_320x50",
    provider: "highperformanceformat.com",
    atKey: "9a8526c3cb4a0a03914c21cea56b07cf",
    invokeUrl: "https://www.highperformanceformat.com/9a8526c3cb4a0a03914c21cea56b07cf/invoke.js",
    size: { width: 320, height: 50 },
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_HPF_320X50_ENABLED", true),
    devices: ["mobile"],
  },
  hpf_160x600: {
    key: "hpf_160x600",
    id: "hpf_160x600",
    provider: "highperformanceformat.com",
    atKey: "c210467ef5ca309036579bea0826f0ca",
    invokeUrl: "https://www.highperformanceformat.com/c210467ef5ca309036579bea0826f0ca/invoke.js",
    size: { width: 160, height: 600 },
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_HPF_160X600_ENABLED", true),
    devices: ["desktop"],
  },
  hpf_160x300: {
    key: "hpf_160x300",
    id: "hpf_160x300",
    provider: "highperformanceformat.com",
    atKey: "6e9343e0d9632ecbdda253b8082e1a96",
    invokeUrl: "https://www.highperformanceformat.com/6e9343e0d9632ecbdda253b8082e1a96/invoke.js",
    size: { width: 160, height: 300 },
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_HPF_160X300_ENABLED", true),
    devices: ["desktop"],
  },
  hpf_300x250: {
    key: "hpf_300x250",
    id: "hpf_300x250",
    provider: "highperformanceformat.com",
    atKey: "3acf1ce5a78b00b6fc2762fae2587e93",
    invokeUrl: "https://www.highperformanceformat.com/3acf1ce5a78b00b6fc2762fae2587e93/invoke.js",
    size: { width: 300, height: 250 },
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_HPF_300X250_ENABLED", true),
    devices: ["desktop", "tablet", "mobile"],
  },
};

// ---------------------------------------------------------------------------
// effectivecpmnetwork.com — supplemental script zones (non-banner)
// Script 1 & 2 are general monetization scripts (pop/onclick type)
// ---------------------------------------------------------------------------
export const ECPM_SCRIPTS = {
  script1: {
    id: "ecpm_script1",
    src: "https://pl30892961.effectivecpmnetwork.com/60/d3/a0/60d3a079f692b53e528c20220f06b574.js",
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ECPM_SCRIPT1_ENABLED", true),
  },
  script2: {
    id: "ecpm_script2",
    src: "https://pl30892962.effectivecpmnetwork.com/8b/49/19/8b4919781a4055e7db651d5f612da476.js",
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ECPM_SCRIPT2_ENABLED", true),
  },
} as const;

// ---------------------------------------------------------------------------
// Native Ad — effectivecpmnetwork.com
// ---------------------------------------------------------------------------
export const NATIVE_AD = {
  containerId: "container-378e2f922f779d8fc9be67c2a26a1c4d",
  invokeUrl: "https://pl30892964.effectivecpmnetwork.com/378e2f922f779d8fc9be67c2a26a1c4d/invoke.js",
  scriptId: "ecpm_native_378e2f922f779d8fc9be67c2a26a1c4d",
  enabled: boolEnv("NEXT_PUBLIC_RIFITV_NATIVE_AD_ENABLED", true),
} as const;

// ---------------------------------------------------------------------------
// Existing aggressive/script-based zones (unchanged structure)
// zone11137952 MUST load only once — dedup guard in AdManager enforces this
// ---------------------------------------------------------------------------
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
  // IMPORTANT: zone11137952 is loaded AT MOST ONCE globally.
  // The dedup registry in AdManager.ts enforces this.
  // Do not add this zone to multiple placement configs expecting multiple loads.
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
    weight: 2,
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
  zoneEcpmDirect: {
    key: "zoneEcpmDirect",
    id: "ecpm_direct",
    provider: "effectivecpmnetwork.com",
    directUrl: "https://www.effectivecpmnetwork.com/e6aniuysz?key=755038187367b5bdcd038301e13c10ce",
    format: "direct-link",
    aggression: "aggressive",
    weight: 1,
    enabled: boolEnv("NEXT_PUBLIC_RIFITV_ECPM_DIRECT_ENABLED", true),
    disableOnTv: true,
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
  // Note: zone11137952 appears here but AdManager dedup ensures it loads only once ever
  homepage_between_sections: ["zone11137945", "zone11137952"],
  matches_in_feed: ["zone11137945"],
  match_below_player: ["zone11137945", "zone11137952"],
  match_sidebar: ["zone11137945"],
  match_sidebar_wide: ["zone11137945"],
  live_between_sections: ["zone11137945"],
  prewatch_transition: ["zone11137945"],
  home_leaderboard: [],
  home_footer: [],
  feed_native: [],
  mobile_sticky: [],
  player_midroll: [],
};

// Priority order for aggressive rotation: vignette → onclick → direct-link
export const AGGRESSIVE_ROTATION = [
  "zone11137954",  // vignette — 45min cooldown, highest priority
  "zone248721",    // onclick
  "zone250801",    // onclick
  "zone11137945",  // supplemental
  "zone11137969",  // direct-link — 45min cooldown
  "zoneEcpmDirect", // direct-link fallback
];
