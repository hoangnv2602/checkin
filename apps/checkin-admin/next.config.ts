import type { NextConfig } from "next";

/**
 * Security headers (I-701 — OWASP ASVS V9 Communications).
 * Tighter CSP cho platform-owner app: chỉ connect tới admin subdomain.
 */
const isProd = process.env.NODE_ENV === "production";

const csp = isProd
  ? [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.sentry.io https://admin.saas-checkin.com wss://admin.saas-checkin.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
    ].join("; ")
  : "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss: https:";

const config: NextConfig = {
  output: "standalone",
  // Aurora tokens copy từ apps/web/src/app/globals.css (KHÔNG share file — D12, ADR-0014)
  experimental: { typedRoutes: true },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
