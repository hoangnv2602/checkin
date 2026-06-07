/**
 * apps/api-gateway/src/modules/tenancy/region/region-resolver.service.ts
 *
 * I-902 — Resolve tenant → data region. Plan gate: chỉ `enterprise` mới
 * chọn region (free/pro mặc định `eu`). Read replica routing (I-805) sẽ
 * dùng region này để pick pool.
 *
 * Resolution order:
 *   1. Explicit `X-Tenant-Region` request header → use that (operator override)
 *   2. JWT claim `data_region` → tenant's home region
 *   3. Redis cache `tenant:region:{tenantId}` → fast path
 *   4. Cache miss → upstream env map (TENTANT_DEFAULT_REGION_MAP) or "eu"
 *
 * Region code: ISO 3166-1 alpha-2 + optional zone, e.g. "eu", "sg", "us-west".
 * Không dùng country code để tránh nhầm với GDPR scope.
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

const CACHE_TTL_SECONDS = 10 * 60; // 10 phút — region hiếm khi đổi

export type RegionCode = "eu" | "sg" | "us" | "au";

export const SUPPORTED_REGIONS: readonly RegionCode[] = ["eu", "sg", "us", "au"] as const;
export const DEFAULT_REGION: RegionCode = "eu";

/** Plans allowed to choose non-default region. */
export const REGION_PLAN_GATE: Record<string, RegionCode[]> = {
  free: ["eu"],
  pro: ["eu"],
  enterprise: ["eu", "sg", "us", "au"],
  internal: ["eu", "sg", "us", "au"],
};

export interface RegionResolution {
  region: RegionCode;
  source: "header" | "jwt" | "cache" | "default" | "env";
}

@Injectable()
export class RegionResolverService {
  private readonly logger = new Logger(RegionResolverService.name);

  constructor(@Optional() @Inject(REDIS) private readonly redis?: Redis) {}

  isValidRegion(code: string): code is RegionCode {
    return (SUPPORTED_REGIONS as readonly string[]).includes(code);
  }

  /**
   * Resolve region cho 1 tenant. Nếu tenant không có plan hợp lệ, ép về default.
   */
  async resolve(tenantId: string, plan: string | undefined, jwtRegion?: string, headerRegion?: string): Promise<RegionResolution> {
    // 1) Header override (operator edge case — chỉ dùng cho migration)
    if (headerRegion && this.isValidRegion(headerRegion)) {
      return { region: headerRegion, source: "header" };
    }

    // 2) JWT claim — tenant's home region
    if (jwtRegion && this.isValidRegion(jwtRegion)) {
      const allowed = REGION_PLAN_GATE[plan ?? "free"] ?? REGION_PLAN_GATE.free;
      if (allowed.includes(jwtRegion)) {
        return { region: jwtRegion, source: "jwt" };
      }
      this.logger.warn(`tenant ${tenantId} plan ${plan} không được phép region ${jwtRegion}, fallback ${DEFAULT_REGION}`);
    }

    // 3) Cache
    if (this.redis) {
      const cached = await this.redis.get(`tenant:region:${tenantId}`);
      if (cached && this.isValidRegion(cached)) {
        return { region: cached, source: "cache" };
      }
    }

    // 4) Default by plan
    const planAllowed = REGION_PLAN_GATE[plan ?? "free"] ?? REGION_PLAN_GATE.free;
    const envOverride = process.env[`TENANT_DEFAULT_REGION_${tenantId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
    if (envOverride && this.isValidRegion(envOverride) && planAllowed.includes(envOverride)) {
      if (this.redis) {
        await this.redis.set(`tenant:region:${tenantId}`, envOverride, "EX", CACHE_TTL_SECONDS);
      }
      return { region: envOverride, source: "env" };
    }

    return { region: DEFAULT_REGION, source: "default" };
  }

  /** Cache kết quả mới (sau khi tenant update region qua admin). */
  async cacheRegion(tenantId: string, region: RegionCode): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(`tenant:region:${tenantId}`, region, "EX", CACHE_TTL_SECONDS);
  }

  /** Invalidate cache (sau khi tenant downgrade plan, etc). */
  async invalidate(tenantId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`tenant:region:${tenantId}`);
  }
}
