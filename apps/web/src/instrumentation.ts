/**
 * apps/web/src/instrumentation.ts
 *
 * I-603 — Next.js instrumentation hook. Runs once on server startup.
 * Wires Sentry (server + edge runtime). No-op khi SENTRY_DSN không set.
 *
 * The client-side Sentry init lives in instrumentation-client.ts (separate
 * file the Sentry SDK reads automatically).
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
      release: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      sendDefaultPii: false,
      beforeSend(event) {
        // Strip httpOnly auth cookies from breadcrumbs / request
        if (event.request?.cookies) {
          const cookies = event.request.cookies as Record<string, string>;
          if (cookies["sa_access_token"]) cookies["sa_access_token"] = "[redacted]";
          if (cookies["sa_refresh_token"]) cookies["sa_refresh_token"] = "[redacted]";
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
    });
  }
}
