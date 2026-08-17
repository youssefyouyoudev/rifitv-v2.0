import type { NextConfig } from "next";

const apiBase =
  process.env.NEXT_PUBLIC_RIFITV_API_BASE ??
  "http://127.0.0.1:8000/api/v1";

const apiOrigin = new URL(apiBase).origin;
const adScriptDomains = "https://quge5.com https://5gvci.com https://nap5k.com https://n6wxm.com";
const adConnectDomains = `${adScriptDomains} https://omg10.com`;

const cspHeader = `
  default-src 'self';
  connect-src 'self' ${apiOrigin} https://rifitv.com https://www.rifitv.com https://cloudflareinsights.com ${adConnectDomains};
  img-src 'self' data: https: blob:;
  media-src 'self' blob: https: http:;
  script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com ${adScriptDomains};
  style-src 'self' 'unsafe-inline';
  font-src 'self' data: https:;
  worker-src 'self' blob:;
  frame-src 'self' https:;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
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
