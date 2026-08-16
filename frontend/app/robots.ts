import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/media/", "/dev/", "/_next/webpack-hmr"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
