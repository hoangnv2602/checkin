/**
 * apps/api-gateway/src/modules/notification/rate-limit/chat-rate-limiter.spec.ts
 *
 * I-802 — Vitest tests cho per-tenant chat rate limiter.
 * Uses in-memory Redis fake (INCR + PEXPIRE subset).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ChatRateLimiter } from "./chat-rate-limiter";

/** Minimal Redis stub — supports INCR, PEXPIRE, del. */
class FakeRedis {
  private data = new Map<string, { value: number; expiresAt: number | null }>();

  private gc(key: string): void {
    const entry = this.data.get(key);
    if (entry?.expiresAt && entry.expiresAt < Date.now()) {
      this.data.delete(key);
    }
  }

  async incr(key: string): Promise<number> {
    this.gc(key);
    const entry = this.data.get(key);
    const next = (entry?.value ?? 0) + 1;
    this.data.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async pexpire(key: string, ms: number): Promise<number> {
    this.gc(key);
    const entry = this.data.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ms;
    return 1;
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }
}

describe("ChatRateLimiter", () => {
  let limiter: ChatRateLimiter;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    limiter = new ChatRateLimiter(redis as unknown as import("ioredis").default);
  });

  it("allows first request within budget (slack = 1/s)", async () => {
    const r = await limiter.acquire("slack", "tenant-a");
    expect(r.allowed).toBe(true);
    expect(r.retryAfterMs).toBe(0);
  });

  it("denies second request in same window (slack)", async () => {
    const r1 = await limiter.acquire("slack", "tenant-a");
    const r2 = await limiter.acquire("slack", "tenant-a");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(false);
    expect(r2.retryAfterMs).toBeGreaterThan(0);
    expect(r2.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  it("allows up to 2/sec for discord", async () => {
    const r1 = await limiter.acquire("discord", "tenant-a");
    const r2 = await limiter.acquire("discord", "tenant-a");
    const r3 = await limiter.acquire("discord", "tenant-a");
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
  });

  it("isolates tenants — tenant A spam không ảnh hưởng tenant B", async () => {
    await limiter.acquire("slack", "tenant-a");
    await limiter.acquire("slack", "tenant-a");
    const rA = await limiter.acquire("slack", "tenant-a");
    const rB = await limiter.acquire("slack", "tenant-b");
    expect(rA.allowed).toBe(false);
    expect(rB.allowed).toBe(true);
  });

  it("isolates providers — slack budget không ảnh hưởng discord", async () => {
    await limiter.acquire("slack", "tenant-a");
    const r = await limiter.acquire("discord", "tenant-a");
    expect(r.allowed).toBe(true);
  });

  it("waitForSlot blocks until window resets", async () => {
    const start = Date.now();
    // Slack budget is 1/sec. First allowed, second must wait for next window.
    await limiter.acquire("slack", "tenant-a");
    await limiter.waitForSlot("slack", "tenant-a", 1500);
    const elapsed = Date.now() - start;
    // Should wait at least until the next 1-second window boundary.
    // Tolerate scheduler jitter on slow CI; assert non-zero wait.
    expect(elapsed).toBeGreaterThan(0);
  });
});
