/**
 * apps/api-gateway/src/modules/_shared/observability/sentry.ts
 *
 * I-603 — Sentry init cho NestJS api-gateway. No-op khi SENTRY_DSN không set
 * (dev mode). Sample rate: 100% error, 10% transaction. Cookie JWTs stripped
 * trước khi gửi.
 */
import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.npm_package_version ?? "0.0.0",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.cookies) {
        const cookies = event.request.cookies as Record<string, string>;
        if (cookies["sa_access_token"]) cookies["sa_access_token"] = "[redacted]";
        if (cookies["sa_refresh_token"]) cookies["sa_refresh_token"] = "[redacted]";
      }
      return event;
    },
  });
  initialized = true;
}
