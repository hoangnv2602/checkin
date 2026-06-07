/**
 * apps/api-gateway/src/modules/auth/rate-limit-override/override.store.ts
 *
 * I-912 — Per-tenant rate limit override store.
 *
 * Override entries: tenant tăng limit cho 1 endpoint cụ thể.
 * Use case: Enterprise customer yêu cầu tăng limit cho webhook endpoint
 * (vd từ 1000 → 5000 req/min).
 *
 * Storage: Redis hash `rl:override:{tenantId}` → JSON per endpoint.
 * Cache TTL 60s — không cần real-time.
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

const CACHE_TTL_SECONDS = 60;

export interface RateLimitOverride {
  tenantId: string;
  /** Endpoint pattern, e.g. "POST /v1/webhooks" hoặc "/v1/events" (mọi method). */
  endpointPattern: string;
  /** Override per-minute limit. Phải > plan default. */
  perMinute: number;
  /** Optional override burst (default: 2x perMinute). */
  burst?: number;
  /** ISO 8601 expiry. Sau thời điểm này, override không còn hiệu lực. */
  expiresAt?: string;
  /** Reason bắt buộc (audit). */
  reason: string;
  /** Platform admin user id đã set override. */
  setBy: string;
  /** Set timestamp ISO. */
  setAt: string;
}

export interface ActiveOverride {
  perMinute: number;
  burst: number;
  expiresAt?: string;
}

@Injectable()
export class RateLimitOverrideStore {
  private readonly logger = new Logger(RateLimitOverrideStore.name);

  constructor(@Optional() @Inject(REDIS) private readonly redis?: Redis) {}

  /** Lookup active override cho (tenantId, endpoint). Returns null nếu không có. */
  async findActive(tenantId: string, endpoint: string): Promise<ActiveOverride | null> {
    if (!this.redis) return null;
    const raw = await this.redis.get(this.cacheKey(tenantId, endpoint));
    if (!raw) return null;
    try {
      const o = JSON.parse(raw) as RateLimitOverride;
      if (o.expiresAt && new Date(o.expiresAt) < new Date()) {
        // Expired — lazy evict
        await this.redis.del(this.cacheKey(tenantId, endpoint));
        return null;
      }
      return {
        perMinute: o.perMinute,
        burst: o.burst ?? o.perMinute * 2,
        expiresAt: o.expiresAt,
      };
    } catch {
      return null;
    }
  }

  /** Set override (called from admin controller). */
  async set(override: RateLimitOverride): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(
      this.cacheKey(override.tenantId, override.endpointPattern),
      JSON.stringify(override),
      "EX",
      CACHE_TTL_SECONDS,
    );
    this.logger.log(
      `override set tenant=${override.tenantId} endpoint=${override.endpointPattern} perMinute=${override.perMinute} by=${override.setBy}`,
    );
  }

  /** Invalidate cache (e.g. on delete). */
  async clear(tenantId: string, endpointPattern: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(this.cacheKey(tenantId, endpointPattern));
  }

  private cacheKey(tenantId: string, endpoint: string): string {
    return `rl:override:${tenantId}:${endpoint}`;
  }
}
