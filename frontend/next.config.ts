import type { NextConfig } from "next";

const apiBase = process.env.NEXT_PUBLIC_RIFITV_API_BASE ?? "http://127.0.0.1:8000/api/v1";
const apiOrigin = new URL(apiBase).origin;
const csp = [
  "default-src 'self'",
  `connect-src 'self' ${apiOrigin}`,
  "img-src 'self' data: https:",
  "media-src 'self' blob: https: http:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: __dirname,
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
