/**
 * apps/api-gateway/src/modules/tenancy/region/region-resolver.service.spec.ts
 *
 * I-902 — Unit tests cho RegionResolverService.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegionResolverService, DEFAULT_REGION, REGION_PLAN_GATE, SUPPORTED_REGIONS } from "./region-resolver.service";

class FakeRedis {
  private store = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, val: string): Promise<"OK"> {
    this.store.set(key, val);
    return "OK";
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
  // helper for test
  _set(key: string, val: string): void {
    this.store.set(key, val);
  }
}

describe("RegionResolverService", () => {
  let redis: FakeRedis;
  let service: RegionResolverService;

  beforeEach(() => {
    redis = new FakeRedis();
    service = new RegionResolverService(redis as unknown as import("ioredis").default);
    delete process.env.TENANT_DEFAULT_REGION_TENANT_X;
  });

  describe("resolve", () => {
    it("returns default region when no signal present", async () => {
      const r = await service.resolve("t1", "free");
      expect(r.region).toBe(DEFAULT_REGION);
      expect(r.source).toBe("default");
    });

    it("header override wins (operator migration)", async () => {
      const r = await service.resolve("t1", "free", undefined, "sg");
      expect(r.region).toBe("sg");
      expect(r.source).toBe("header");
    });

    it("ignores invalid header region", async () => {
      const r = await service.resolve("t1", "free", undefined, "antarctica");
      expect(r.region).toBe(DEFAULT_REGION);
      expect(r.source).toBe("default");
    });

    it("uses JWT claim when plan allows", async () => {
      const r = await service.resolve("t1", "enterprise", "us");
      expect(r.region).toBe("us");
      expect(r.source).toBe("jwt");
    });

    it("downgrades JWT region to default when plan not allowed (free→sg)", async () => {
      const r = await service.resolve("t1", "free", "sg");
      expect(r.region).toBe(DEFAULT_REGION);
      expect(r.source).toBe("default");
    });

    it("uses cached value when present and valid", async () => {
      redis._set("tenant:region:t1", "au");
      const r = await service.resolve("t1", "enterprise");
      expect(r.region).toBe("au");
      expect(r.source).toBe("cache");
    });

    it("ignores invalid cached value", async () => {
      redis._set("tenant:region:t1", "bogus");
      const r = await service.resolve("t1", "enterprise");
      expect(r.region).toBe(DEFAULT_REGION);
      expect(r.source).toBe("default");
    });

    it("env override honored when plan allows", async () => {
      process.env.TENANT_DEFAULT_REGION_TENANT_X = "us";
      const r = await service.resolve("tenant-x", "enterprise");
      expect(r.region).toBe("us");
      expect(r.source).toBe("env");
    });

    it("env override skipped when plan disallows region", async () => {
      process.env.TENANT_DEFAULT_REGION_TENANT_X = "us";
      const r = await service.resolve("tenant-x", "free");
      expect(r.region).toBe(DEFAULT_REGION);
      expect(r.source).toBe("default");
    });
  });

  describe("cacheRegion / invalidate", () => {
    it("cacheRegion writes to redis", async () => {
      await service.cacheRegion("t1", "sg");
      const v = await redis.get("tenant:region:t1");
      expect(v).toBe("sg");
    });

    it("invalidate deletes entry", async () => {
      redis._set("tenant:region:t1", "au");
      await service.invalidate("t1");
      const v = await redis.get("tenant:region:t1");
      expect(v).toBeNull();
    });
  });

  describe("plan gate matrix", () => {
    it("free: chỉ eu", () => {
      expect(REGION_PLAN_GATE.free).toEqual(["eu"]);
    });
    it("pro: chỉ eu", () => {
      expect(REGION_PLAN_GATE.pro).toEqual(["eu"]);
    });
    it("enterprise: tất cả regions", () => {
      expect(REGION_PLAN_GATE.enterprise).toEqual(["eu", "sg", "us", "au"]);
    });
  });

  describe("constants", () => {
    it("default region is eu", () => {
      expect(DEFAULT_REGION).toBe("eu");
    });
    it("4 supported regions", () => {
      expect(SUPPORTED_REGIONS).toHaveLength(4);
    });
  });

  describe("graceful degradation (no redis)", () => {
    it("falls back to default region", async () => {
      const noRedisService = new RegionResolverService();
      const r = await noRedisService.resolve("t1", "enterprise", "us");
      expect(r.region).toBe("us");
      expect(r.source).toBe("jwt");
    });

    it("falls back to default when no signal", async () => {
      const noRedisService = new RegionResolverService();
      const r = await noRedisService.resolve("t1", "free");
      expect(r.region).toBe(DEFAULT_REGION);
    });
  });
});
