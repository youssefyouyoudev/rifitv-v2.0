import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RiFiTV",
    short_name: "RiFiTV",
    description: "Live football events on RiFiTV.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050910",
    theme_color: "#06d7c6",
    categories: ["sports", "entertainment"],
    shortcuts: [
      { name: "Live", short_name: "Live", url: "/live", icons: [{ src: "/brand/rifitv-icon-192.png", sizes: "192x192" }] },
      { name: "Today's matches", short_name: "Today", url: "/matches/today", icons: [{ src: "/brand/rifitv-icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/brand/rifitv-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/rifitv-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
