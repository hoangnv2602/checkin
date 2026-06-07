/**
 * apps/api-gateway/src/modules/auth/rate-limit-override/override.store.spec.ts
 */
import { beforeEach, describe, expect, it } from "vitest";
import { RateLimitOverrideStore, type RateLimitOverride } from "./override.store";
import type Redis from "ioredis";

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  async set(key: string, value: string, mode?: "EX", ttl?: number): Promise<"OK"> {
    const expiresAt = mode === "EX" && ttl ? Date.now() + ttl * 1000 : 0;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
  // helpers for test setup
  _setRaw(key: string, value: string): void {
    this.store.set(key, { value, expiresAt: 0 });
  }
  _has(key: string): boolean {
    return this.store.has(key);
  }
}

describe("RateLimitOverrideStore", () => {
  let store: RateLimitOverrideStore;
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
    store = new RateLimitOverrideStore(redis as unknown as Redis);
  });

  const sample = (over: Partial<RateLimitOverride> = {}): RateLimitOverride => ({
    tenantId: "tenant_1",
    endpointPattern: "POST /v1/webhooks",
    perMinute: 5000,
    reason: "Enterprise customer spike during product launch",
    setBy: "plat_admin",
    setAt: new Date().toISOString(),
    ...over,
  });

  it("returns null when no override", async () => {
    const r = await store.findActive("t1", "POST /v1/webhooks");
    expect(r).toBeNull();
  });

  it("set + findActive returns override", async () => {
    await store.set(sample());
    const r = await store.findActive("tenant_1", "POST /v1/webhooks");
    expect(r?.perMinute).toBe(5000);
    expect(r?.burst).toBe(10000); // 2x
  });

  it("uses custom burst if set", async () => {
    await store.set(sample({ burst: 8000 }));
    const r = await store.findActive("tenant_1", "POST /v1/webhooks");
    expect(r?.burst).toBe(8000);
  });

  it("ignores expired override (lazy evict)", async () => {
    await store.set(sample({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const r = await store.findActive("tenant_1", "POST /v1/webhooks");
    expect(r).toBeNull();
  });

  it("clear removes entry", async () => {
    await store.set(sample());
    await store.clear("tenant_1", "POST /v1/webhooks");
    const r = await store.findActive("tenant_1", "POST /v1/webhooks");
    expect(r).toBeNull();
  });

  it("returns null when no redis", async () => {
    const noRedisStore = new RateLimitOverrideStore();
    const r = await noRedisStore.findActive("t1", "POST /v1/webhooks");
    expect(r).toBeNull();
    // set/clear are no-ops
    await noRedisStore.set(sample());
    await noRedisStore.clear("t1", "POST /v1/webhooks");
  });
});
