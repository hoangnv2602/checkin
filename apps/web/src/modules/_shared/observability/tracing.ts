/**
 * apps/web/src/modules/_shared/observability/tracing.ts
 *
 * I-603 — OpenTelemetry trace context propagation. Export OTLP qua
 * NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT (Tempo).
 */
export function startTracing(): void {
  if (typeof window === "undefined") return;
  const endpoint = process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;
  // Phase 6 wire: dynamic import('@opentelemetry/sdk-browser') + OTLPTraceExporter
  // Sample 10% traces, 100% errors.
  // For now: console log.
  // eslint-disable-next-line no-console
  console.log("[otel] endpoint configured (Phase 6 stub)", endpoint);
}

export function traceFetch(url: string, init?: RequestInit): Promise<Response> {
  // Inject traceparent header từ active span.
  const headers = new Headers(init?.headers);
  const traceparent = (globalThis as { __traceparent?: string }).__traceparent;
  if (traceparent) headers.set("traceparent", traceparent);
  return fetch(url, { ...init, headers });
}
