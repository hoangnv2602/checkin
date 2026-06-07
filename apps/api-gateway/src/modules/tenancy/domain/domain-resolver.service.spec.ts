/**
 * apps/api-gateway/src/modules/tenancy/domain/domain-resolver.service.spec.ts
 *
 * I-804 — DomainResolverService tests.
 * Covers: shared domain skip, custom domain cache + plan gate, invalidate.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { DomainResolverService } from "./domain-resolver.service";
import type Redis from "ioredis";

/** Minimal Redis stub — get/set/del/exists. */
class FakeRedis {
  private data = new Map<string, { value: string; expiresAt: number | null }>();

  private gc(key: string): void {
    const entry = this.data.get(key);
    if (entry?.expiresAt && entry.expiresAt < Date.now()) {
      this.data.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.gc(key);
    return this.data.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: "EX", ttl?: number): Promise<"OK"> {
    const expiresAt = mode === "EX" && ttl ? Date.now() + ttl * 1000 : null;
    this.data.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }
}

describe("DomainResolverService", () => {
  let redis: FakeRedis;
  let resolver: DomainResolverService;

  beforeEach(() => {
    redis = new FakeRedis();
    resolver = new DomainResolverService(redis as unknown as Redis);
    delete process.env.CUSTOM_DOMAIN_MAP;
  });

  describe("isSharedDomain", () => {
    it("returns true for saas-checkin.com", () => {
      expect(resolver.isSharedDomain("saas-checkin.com")).toBe(true);
    });
    it("returns true for tenant.saas-checkin.com", () => {
      expect(resolver.isSharedDomain("tenant.saas-checkin.com")).toBe(true);
    });
    it("returns true for localhost / 127.0.0.1", () => {
      expect(resolver.isSharedDomain("localhost")).toBe(true);
      expect(resolver.isSharedDomain("localhost:3000")).toBe(true);
      expect(resolver.isSharedDomain("127.0.0.1")).toBe(true);
    });
    it("returns false for events.acme-corp.com", () => {
      expect(resolver.isSharedDomain("events.acme-corp.com")).toBe(false);
    });
    it("lowercases host before checking", () => {
      expect(resolver.isSharedDomain("TENANT.Saas-Checkin.com")).toBe(true);
    });
  });

  describe("resolve", () => {
    it("returns null for shared domain", async () => {
      const r = await resolver.resolve("tenant.saas-checkin.com");
      expect(r).toBeNull();
    });

    it("returns null for unknown custom domain", async () => {
      const r = await resolver.resolve("events.unknown-corp.com");
      expect(r).toBeNull();
    });

    it("returns resolution from cache if present", async () => {
      await resolver.cacheDomain("events.acme-corp.com", "tenant-acme", "enterprise");
      const r = await resolver.resolve("events.acme-corp.com");
      expect(r).not.toBeNull();
      expect(r?.tenantId).toBe("tenant-acme");
      expect(r?.plan).toBe("enterprise");
      expect(r?.cached).toBe(true);
    });

    it("denies custom domain for non-Enterprise plan (cached)", async () => {
      await resolver.cacheDomain("events.cheap-corp.com", "tenant-cheap", "pro");
      const r = await resolver.resolve("events.cheap-corp.com");
      expect(r).toBeNull();
    });

    it("denies custom domain for non-Enterprise plan (upstream)", async () => {
      process.env.CUSTOM_DOMAIN_MAP = "events.cheap-corp.com:tenant-cheap:pro";
      const r = await resolver.resolve("events.cheap-corp.com");
      expect(r).toBeNull();
    });

    it("resolves from upstream env map when cache miss", async () => {
      process.env.CUSTOM_DOMAIN_MAP = "events.acme-corp.com:tenant-acme:enterprise";
      const r = await resolver.resolve("events.acme-corp.com");
      expect(r).not.toBeNull();
      expect(r?.tenantId).toBe("tenant-acme");
      expect(r?.cached).toBe(false);
    });

    it("caches upstream result with 5-min TTL", async () => {
      process.env.CUSTOM_DOMAIN_MAP = "events.acme-corp.com:tenant-acme:enterprise";
      await resolver.resolve("events.acme-corp.com");
      // Second call should be cached
      const r = await resolver.resolve("events.acme-corp.com");
      expect(r?.cached).toBe(true);
    });

    it("uppercase host is normalized to lowercase", async () => {
      await resolver.cacheDomain("Events.Acme-Corp.com", "tenant-acme", "enterprise");
      const r = await resolver.resolve("events.acme-corp.com");
      expect(r?.tenantId).toBe("tenant-acme");
    });
  });

  describe("invalidate", () => {
    it("removes the cache entry for a domain", async () => {
      await resolver.cacheDomain("events.acme-corp.com", "tenant-acme", "enterprise");
      await resolver.invalidate("events.acme-corp.com");
      const r = await resolver.resolve("events.acme-corp.com");
      // After invalidate, cache miss → upstream lookup (env map empty) → null
      expect(r).toBeNull();
    });
  });
});
