/**
 * apps/api-gateway/src/modules/_shared/observability/sentry.ts
 *
 * I-603 — Sentry init cho NestJS api-gateway.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // Phase 6 wire: @sentry/node
  // Sentry.init({ dsn, tracesSampleRate: 0.1, environment: process.env.NODE_ENV });
}
