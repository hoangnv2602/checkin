/**
 * apps/api-gateway/src/modules/realtime/gateways/stats-throttler.ts
 *
 * Throttle per-event `StatsUpdated` emit ≤ 1 / 250ms. Tránh flood khi
 * nhiều scan xảy ra đồng thời (k6 1000/s).
 */
export class StatsThrottler {
  private readonly lastEmit = new Map<string, number>();

  constructor(private readonly intervalMs: number) {}

  shouldEmit(key: string): boolean {
    const now = Date.now();
    const last = this.lastEmit.get(key) ?? 0;
    if (now - last < this.intervalMs) return false;
    this.lastEmit.set(key, now);
    return true;
  }
}
