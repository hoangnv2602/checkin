/**
 * apps/web/src/instrumentation-client.ts
 *
 * I-603 — Client-side Sentry init. Runs once when the browser bundle loads.
 * No-op khi NEXT_PUBLIC_SENTRY_DSN không set (dev mode).
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
  });
}
