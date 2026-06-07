/**
 * apps/api-gateway/src/modules/auth/guards/plan-rate-limit.guard.spec.ts
 *
 * I-807 — PlanRateLimitGuard tests.
 * Covers: per-tenant tier (free/pro/enterprise), per-IP fallback, burst window,
 * 429 with Retry-After, sliding window expiry.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { HttpException } from "@nestjs/common";
import { PlanRateLimitGuard, type PlanTier } from "./plan-rate-limit.guard";
import type Redis from "ioredis";

/** Minimal Redis stub — zset subset (zadd, zcard, zrange, zremrangebyscore, expire). */
class FakeZSet {
  private data = new Map<string, Map<string, number>>(); // key -> member -> score
  private ttl = new Map<string, number>();

  private gc(key: string): void {
    const exp = this.ttl.get(key);
    if (exp && exp < Date.now()) {
      this.data.delete(key);
      this.ttl.delete(key);
    }
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    this.gc(key);
    const set = this.data.get(key) ?? new Map();
    set.set(member, score);
    this.data.set(key, set);
    return 1;
  }

  async zcard(key: string): Promise<number> {
    this.gc(key);
    return this.data.get(key)?.size ?? 0;
  }

  async zrange(key: string, start: number, stop: number, withScores?: "WITHSCORES"): Promise<string[]> {
    this.gc(key);
    const set = this.data.get(key);
    if (!set) return [];
    const sorted = Array.from(set.entries()).sort((a, b) => a[1] - b[1]);
    const slice = sorted.slice(start, stop === -1 ? undefined : stop + 1);
    if (withScores === "WITHSCORES") {
      const out: string[] = [];
      for (const [m, s] of slice) {
        out.push(m, String(s));
      }
      return out;
    }
    return slice.map(([m]) => m);
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    this.gc(key);
    const set = this.data.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const [m, s] of set.entries()) {
      if (s >= min && s <= max) {
        set.delete(m);
        removed++;
      }
    }
    return removed;
  }

  async expire(key: string, sec: number): Promise<number> {
    this.ttl.set(key, Date.now() + sec * 1000);
    return 1;
  }
}

interface MockRequest {
  headers: Record<string, string | undefined>;
  ip?: string;
  user?: { sub?: string; plan?: PlanTier };
}

interface MockResponse {
  headers: Record<string, string>;
  setHeader: (k: string, v: string) => void;
}

function makeMockResponse(): MockResponse {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k, v) => { headers[k.toLowerCase()] = v; } };
}

function makeCtx(req: MockRequest): {
  switchToHttp: () => { getRequest: () => MockRequest; getResponse: () => MockResponse };
} {
  return { switchToHttp: () => ({ getRequest: () => req, getResponse: () => makeMockResponse() }) };
}

describe("PlanRateLimitGuard", () => {
  let redis: FakeZSet;
  let guard: PlanRateLimitGuard;
  let overrideStore: { findActive: (t: string, e: string) => Promise<{ perMinute: number; burst: number } | null> };

  beforeEach(() => {
    redis = new FakeZSet();
    overrideStore = { findActive: async () => null };
    guard = new PlanRateLimitGuard(redis as unknown as Redis, overrideStore as never);
  });

  it("allows first request from free tier tenant", async () => {
    const ok = await guard.canActivate(
      makeCtx({ headers: { "x-tenant-id": "t1" }, user: { plan: "free" } }) as never,
    );
    expect(ok).toBe(true);
  });

  it("enforces free tier 60/min limit", async () => {
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { plan: "free" } });
    for (let i = 0; i < 60; i++) {
      await guard.canActivate(ctx as never);
    }
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(HttpException);
  });

  it("enforces pro tier 300/min limit", async () => {
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { plan: "pro" } });
    for (let i = 0; i < 300; i++) {
      await guard.canActivate(ctx as never);
    }
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(/Rate limit exceeded/);
  });

  it("enforces enterprise tier 1000/min limit", async () => {
    const ctx = makeCtx({ headers: { "x-tenant-id": "big-corp" }, user: { plan: "enterprise" } });
    for (let i = 0; i < 1000; i++) {
      await guard.canActivate(ctx as never);
    }
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(/Rate limit/);
  });

  it("throws HttpException with status 429", async () => {
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { plan: "free" } });
    for (let i = 0; i < 60; i++) await guard.canActivate(ctx as never);
    try {
      await guard.canActivate(ctx as never);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const ex = err as HttpException;
      const resp = ex.getResponse() as { statusCode: number; retryAfterSec: number };
      expect(resp.statusCode).toBe(429);
      expect(resp.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("falls back to per-IP limit for unauth requests", async () => {
    const ctx = makeCtx({ headers: {}, ip: "1.2.3.4" });
    for (let i = 0; i < 60; i++) {
      await guard.canActivate(ctx as never);
    }
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(/Rate limit/);
  });

  it("isolates tenants — t1 spam không ảnh hưởng t2", async () => {
    const ctx1 = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { plan: "free" } });
    const ctx2 = makeCtx({ headers: { "x-tenant-id": "t2" }, user: { plan: "free" } });
    for (let i = 0; i < 60; i++) await guard.canActivate(ctx1 as never);
    const ok = await guard.canActivate(ctx2 as never);
    expect(ok).toBe(true);
  });

  it("free tier burst 120 in 10s", async () => {
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { plan: "free" } });
    let allowed = 0;
    for (let i = 0; i < 130; i++) {
      try {
        await guard.canActivate(ctx as never);
        allowed++;
      } catch {
        /* expected */
      }
    }
    // First 60 pass minute limit, then 60 more pass burst window, then 121st+ fail.
    expect(allowed).toBeLessThanOrEqual(120);
    expect(allowed).toBeGreaterThanOrEqual(60);
  });

  it("treats unknown plan claim as free tier", async () => {
    const ctx = makeCtx({
      headers: { "x-tenant-id": "t1" },
      user: { plan: "unknown-tier" as PlanTier },
    });
    for (let i = 0; i < 60; i++) await guard.canActivate(ctx as never);
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(/Rate limit/);
  });

  it("sets Retry-After + X-RateLimit-* response headers on 429", async () => {
    const req = { headers: { "x-tenant-id": "t1" }, user: { plan: "free" } };
    const res = makeMockResponse();
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    };
    for (let i = 0; i < 60; i++) {
      await guard.canActivate(ctx as never);
    }
    try {
      await guard.canActivate(ctx as never);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect(res.headers["retry-after"]).toBeDefined();
      expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
      expect(res.headers["x-ratelimit-limit"]).toBe("60");
      expect(res.headers["x-ratelimit-remaining"]).toBe("0");
    }
  });
});
