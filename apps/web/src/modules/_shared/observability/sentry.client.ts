/**
 * apps/web/src/modules/_shared/observability/sentry.client.ts
 *
 * I-603 — Sentry client init cho Next.js web app. Lazy-load env to avoid
 * SSR crashes khi DSN missing.
 */
export function initSentryClient(): void {
  if (typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  // Phase 6: thay bằng @sentry/nextjs init
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.init({ dsn, tracesSampleRate: 0.1, replaysSessionSampleRate: 0.0 });
  // Stub logger
  // eslint-disable-next-line no-console
  console.log("[sentry:client] DSN configured (Phase 6 stub)");
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  // Phase 6 wire:
  // Sentry.captureException(err, { extra: context });
  // eslint-disable-next-line no-console
  console.error("[sentry:client]", err, context);
}
