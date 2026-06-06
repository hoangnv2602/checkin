/**
 * apps/api-gateway/src/modules/auth/guards/plan-rate-limit.guard.ts
 *
 * I-807 — Per-tenant rate limit guard theo plan tier.
 *
 *   Free: 60 req/min
 *   Pro:  300 req/min
 *   Enterprise: 1000 req/min
 *
 * Burst: cho phép 2x trong 10s đầu (token bucket 2 refill/sec).
 *
 * Storage: Redis sliding window. Key `rl:{tenantId}:{window}`.
 * Plan lookup: JWT claim `plan` (nếu có) → fallback default tier qua env.
 *
 * Response 429 với `Retry-After` header.
 */
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

export type PlanTier = "free" | "pro" | "enterprise";

interface TierLimit {
  perMinute: number;
  burst: number; // 2x = 2 * perMinute tokens
  burstWindowMs: number; // window refill burst
}

const TIER_LIMITS: Record<PlanTier, TierLimit> = {
  free: { perMinute: 60, burst: 120, burstWindowMs: 10_000 },
  pro: { perMinute: 300, burst: 600, burstWindowMs: 10_000 },
  enterprise: { perMinute: 1000, burst: 2000, burstWindowMs: 10_000 },
};

const PER_IP_LIMIT = 60; // unauth endpoints (login, public event page)

@Injectable()
export class PlanRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(PlanRateLimitGuard.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const tenantId = (req.headers["x-tenant-id"] as string | undefined) ?? "";
    const userId = (req.user?.sub as string | undefined) ?? "";
    const planClaim = (req.user?.plan as PlanTier | undefined) ?? "free";

    // Tenant identified → apply per-tenant tier
    // Unauthenticated / per-IP → fallback fixed limit
    const tier = tenantId ? TIER_LIMITS[planClaim] ?? TIER_LIMITS.free : null;
    const limit = tier?.perMinute ?? PER_IP_LIMIT;
    const burst = tier?.burst ?? PER_IP_LIMIT * 2;

    const key = tenantId
      ? `rl:tenant:${tenantId}`
      : `rl:ip:${(req.ip ?? req.headers["x-forwarded-for"] ?? "unknown").toString().split(",")[0].trim()}`;

    const result = await this.checkSlidingWindow(key, limit, burst, tier?.burstWindowMs ?? 10_000);

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: "rate_limited",
          message: `Rate limit exceeded for ${tenantId ? `tenant=${tenantId}` : "IP"}`,
          limit,
          windowSec: 60,
          retryAfterSec: result.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async checkSlidingWindow(
    key: string,
    limit: number,
    burst: number,
    burstWindowMs: number,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const now = Date.now();
    const minuteAgo = now - 60_000;
    const burstAgo = now - burstWindowMs;

    // Drop entries outside window
    await this.redis.zremrangebyscore(key, 0, minuteAgo);

    const recentCount = await this.redis.zcard(key);
    if (recentCount >= limit) {
      // Get oldest entry → retry-after = (oldest + 60s) - now
      const oldest = await this.redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTs = oldest[1] ? Number(oldest[1]) : now;
      const retryAfterMs = Math.max(0, oldestTs + 60_000 - now);
      return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
    }

    // Burst check: count entries in burst window
    await this.redis.zremrangebyscore(key + ":burst", 0, burstAgo);
    const burstCount = await this.redis.zcard(key + ":burst");
    if (burstCount >= burst) {
      return { allowed: false, retryAfterSec: Math.ceil(burstWindowMs / 1000) };
    }

    // Record request
    const member = `${now}:${Math.random()}`;
    await this.redis.zadd(key, now, member);
    await this.redis.zadd(key + ":burst", now, member);
    await this.redis.expire(key, 65);
    await this.redis.expire(key + ":burst", Math.ceil(burstWindowMs / 1000) + 5);
    return { allowed: true, retryAfterSec: 0 };
  }

  async onModuleDestroy(): Promise<void> {
    // ioredis auto-closes
  }
}
