import type { NextConfig } from "next";

const apiBase =
  process.env.NEXT_PUBLIC_RIFITV_API_BASE ??
  "http://127.0.0.1:8000/api/v1";

const apiOrigin = new URL(apiBase).origin;
const distDir = process.env.NEXT_DIST_DIR || ".next";

// ---------------------------------------------------------------------------
// Ad provider domains — only the exact domains used by our ad codes
// ---------------------------------------------------------------------------

// script-src: domains that serve JavaScript we execute
const adScriptSrc = [
  "https://www.highperformanceformat.com", // HPF banner invoke.js (all sizes)
  "https://pl30892961.effectivecpmnetwork.com", // ecpm supplemental script 1
  "https://pl30892962.effectivecpmnetwork.com", // ecpm supplemental script 2
  "https://pl30892964.effectivecpmnetwork.com", // ecpm native invoke.js
  "https://www.effectivecpmnetwork.com",         // ecpm direct link redirect JS
  "https://quge5.com",                           // zone248721, zone250801
  "https://5gvci.com",                           // zone11137945
  "https://nap5k.com",                           // zone11137952
  "https://n6wxm.com",                           // zone11137954 (vignette)
  "https://omg10.com",                           // zone11137969
].join(" ");

// frame-src: domains that load in iframes (HPF renders banners as iframes)
const adFrameSrc = [
  "https://www.highperformanceformat.com",
  "https://pl30892964.effectivecpmnetwork.com",
  "https://www.effectivecpmnetwork.com",
].join(" ");

// connect-src: fetch/XHR/beacon to ad domains
const adConnectSrc = [
  "https://www.highperformanceformat.com",
  "https://pl30892961.effectivecpmnetwork.com",
  "https://pl30892962.effectivecpmnetwork.com",
  "https://pl30892964.effectivecpmnetwork.com",
  "https://www.effectivecpmnetwork.com",
  "https://quge5.com",
  "https://5gvci.com",
  "https://nap5k.com",
  "https://n6wxm.com",
  "https://omg10.com",
].join(" ");

// img-src: ad networks may serve tracking pixels / ad images
// The existing 'https:' wildcard already covers these, preserved as-is.

const cspHeader = `
  default-src 'self';
  connect-src 'self' ${apiOrigin} https://rifitv.com https://www.rifitv.com https://cloudflareinsights.com ${adConnectSrc};
  img-src 'self' data: https: blob:;
  media-src 'self' blob: https: http:;
  script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com ${adScriptSrc};
  style-src 'self' 'unsafe-inline';
  font-src 'self' data: https:;
  worker-src 'self' blob:;
  frame-src 'self' https: ${adFrameSrc};
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  distDir,

  allowedDevOrigins: ["127.0.0.1"],

  turbopack: {
    root: __dirname,
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.rifitv.com" }],
        destination: "https://rifitv.com/:path*",
        permanent: true,
      },
    ];
  },

  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
