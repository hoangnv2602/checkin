/**
 * apps/api-gateway/src/modules/tenancy/domain/domain-resolver.service.ts
 *
 * I-804 — Resolve custom domain → tenantId. Middleware trước JWT auth
 * để xác định tenant từ Host header.
 *
 * Cache: Redis hash `domain:{hostname}` → JSON { tenantId, plan, createdAt }
 * với TTL 5 phút. Wildcard cert `*.saas-checkin.com` cho shared domain
 * không cần lookup.
 *
 * Resolution order:
 *   1. Shared domain (*.saas-checkin.com, saas-checkin.com, localhost) → null
 *      (caller sẽ resolve tenant từ JWT hoặc path param)
 *   2. Custom domain → Redis lookup → tenantId
 *   3. Cache miss → query core-api gRPC TenantService.GetByDomain
 *   4. Unknown domain → null (caller returns 404)
 *
 * Plan gate: chỉ `Enterprise` plan mới bật customDomain. Nếu tenant có
 * customDomain nhưng plan != Enterprise → return null + log warning.
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

const SHARED_DOMAIN_SUFFIXES = [
  ".saas-checkin.com",
  ".saas-checkin.local",
  "saas-checkin.com",
  "saas-checkin.local",
  "localhost",
  "127.0.0.1",
];

const CACHE_TTL_SECONDS = 5 * 60;

export interface DomainResolution {
  tenantId: string;
  plan: string;
  createdAt: string;
  /** True if resolved from cache; false if from upstream gRPC. */
  cached: boolean;
}

interface TenantDomainRecord {
  tenantId: string;
  plan: string;
  createdAt: string;
}

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);

  constructor(@Optional() @Inject(REDIS) private readonly redis?: Redis) {}

  /**
   * Returns true if the hostname is a shared platform domain. Middleware
   * short-circuits the lookup for these — JWT/path param handles tenant.
   */
  isSharedDomain(hostname: string): boolean {
    const h = hostname.toLowerCase().split(":")[0];
    return SHARED_DOMAIN_SUFFIXES.some((s) => h === s || h.endsWith(s));
  }

  /**
   * Resolve a custom domain to its tenant. Returns null if domain is shared,
   * unknown, or tenant is not on Enterprise plan.
   */
  async resolve(hostname: string): Promise<DomainResolution | null> {
    const h = hostname.toLowerCase().split(":")[0];
    if (this.isSharedDomain(h)) return null;
    if (!this.redis) return null;

    const cached = await this.redis.get(this.cacheKey(h));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TenantDomainRecord;
        if (parsed.plan !== "enterprise") {
          this.logger.warn(
            `custom domain ${h} belongs to non-Enterprise plan=${parsed.plan} — denying`,
          );
          return null;
        }
        return { ...parsed, cached: true };
      } catch (err) {
        this.logger.warn(`domain cache parse failed host=${h}: ${(err as Error).message}`);
      }
    }

    // Cache miss → upstream lookup (gRPC TenantService.GetByDomain)
    const record = await this.fetchFromUpstream(h);
    if (!record) return null;

    if (record.plan !== "enterprise") {
      this.logger.warn(
        `custom domain ${h} belongs to non-Enterprise plan=${record.plan} — denying`,
      );
      return null;
    }

    await this.redis.set(
      this.cacheKey(h),
      JSON.stringify(record),
      "EX",
      CACHE_TTL_SECONDS,
    );
    return { ...record, cached: false };
  }

  /**
   * Invalidate the cache entry for a domain (called when admin updates
   * tenant's customDomain field or plan changes).
   */
  async invalidate(hostname: string): Promise<void> {
    if (!this.redis) return;
    const h = hostname.toLowerCase().split(":")[0];
    await this.redis.del(this.cacheKey(h));
  }

  /**
   * Cache a custom domain → tenant mapping. Called from admin (web settings)
   * after the tenant updates their customDomain field.
   */
  async cacheDomain(
    hostname: string,
    tenantId: string,
    plan: string = "enterprise",
  ): Promise<void> {
    if (!this.redis) return;
    const h = hostname.toLowerCase().split(":")[0];
    const record: TenantDomainRecord = {
      tenantId,
      plan,
      createdAt: new Date().toISOString(),
    };
    await this.redis.set(
      this.cacheKey(h),
      JSON.stringify(record),
      "EX",
      CACHE_TTL_SECONDS,
    );
  }

  private cacheKey(hostname: string): string {
    return `domain:${hostname}`;
  }

  /**
   * Upstream gRPC lookup. Stub for now; wired to core-api TenantService in
   * Phase 9 when tenant domain table is available.
   */
  private async fetchFromUpstream(hostname: string): Promise<TenantDomainRecord | null> {
    // TODO(I-804): gRPC call to core-api TenantService.GetByDomain
    // For now: read from env (dev) — supports local testing.
    const envMap = process.env.CUSTOM_DOMAIN_MAP;
    if (envMap) {
      for (const entry of envMap.split(",")) {
        const [domain, tenantId, plan] = entry.split(":");
        if (domain === hostname && tenantId && plan) {
          return {
            tenantId,
            plan,
            createdAt: new Date().toISOString(),
          };
        }
      }
    }
    this.logger.debug(`custom domain ${hostname} not found in upstream`);
    return null;
  }
}
