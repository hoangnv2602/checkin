import type { NextConfig } from "next";

/**
 * Security headers (I-701 — OWASP ASVS V9 Communications).
 * Production-only CSP via header — dev allows `unsafe-eval` cho HMR.
 * See docs/security/owasp-asvs-checklist.md.
 */
const isProd = process.env.NODE_ENV === "production";

const csp = isProd
  ? [
      "default-src 'self'",
      // Next.js needs inline styles for streaming RSC payloads + nonce-stripped.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Sentry.io + BFF (api-gateway) — same-origin in prod, allow explicitly.
      "connect-src 'self' https://*.sentry.io https://api.saas-checkin.com wss://api.saas-checkin.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
    ].join("; ")
  : // dev — allow Vite/Next HMR over ws:// + unsafe-eval
    [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss: https:",
    ].join("; ");

const config: NextConfig = {
  // transpile shared workspace packages
  transpilePackages: ["@saas-checkin/contracts", "@saas-checkin/ui"],
  // standalone output cho Docker
  output: "standalone",
  typedRoutes: true,
  // Aurora design system: chỉ dùng semantic tokens, không hardcode colors
  // (enforce ở ESLint rule: no-restricted-syntax)

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
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
