import type { AdDevice, AdRoute } from "./config";

export function detectAdDevice(): AdDevice {
  const width = window.innerWidth;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;
  const tvLike = width >= 1600 && coarse && !hover;

  if (tvLike || /\b(SmartTV|Tizen|Web0S|WebOS|NetCast|Android TV|TV)\b/i.test(navigator.userAgent)) {
    return "tv";
  }

  if (width >= 600 && width < 1200 && coarse) {
    return "tablet";
  }

  if (width < 768 || (coarse && width < 900)) {
    return "mobile";
  }

  return "desktop";
}

export function routeForPath(pathname: string): AdRoute {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname === "/") return "home";
  if (pathname.startsWith("/matches")) return "matches";
  if (pathname.startsWith("/match/")) return "match";
  if (pathname.startsWith("/live")) return "live";
  return "other";
}
