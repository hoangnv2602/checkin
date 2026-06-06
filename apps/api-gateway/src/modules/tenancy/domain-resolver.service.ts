/**
 * apps/api-gateway/src/modules/tenancy/domain-resolver.service.ts
 *
 * I-804 — White-label custom domain resolution.
 *
 * Resolve host header → tenantId qua Redis cache (5 phút TTL).
 * 3 nguồn domain:
 *   - shared:    saas-checkin.com / web.saas-checkin.com → default org
 *   - custom:    events.acme-corp.com → org_id (set bởi Enterprise plan)
 *   - local dev: localhost → default org
 *
 * Storage: Redis key `tenant:domain:{host}` = tenantId, TTL 300s.
 * Invalidation: admin cập nhật domain → DEL key qua internal API.
 */
import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

const CACHE_TTL_SECONDS = 5 * 60;
const DEFAULT_TENANT_ID = "default"; // platform-owned demo org
const SHARED_DOMAINS = new Set([
  "saas-checkin.com",
  "web.saas-checkin.com",
  "api.saas-checkin.com",
  "admin.saas-checkin.com",
  "localhost",
  "127.0.0.1",
]);

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * Extract hostname (strip port, lowercase, strip leading www.).
   */
  static normalizeHost(rawHost: string): string {
    const host = rawHost.split(":")[0].toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  }

  /**
   * Resolve host → tenantId. Trả về null nếu unknown (request sẽ 404).
   */
  async resolve(rawHost: string): Promise<string | null> {
    const host = DomainResolverService.normalizeHost(rawHost);

    // Shared domain → default tenant
    if (SHARED_DOMAINS.has(host) || host.endsWith(".saas-checkin.com")) {
      return DEFAULT_TENANT_ID;
    }

    // Try cache
    const cached = await this.redis.get(`tenant:domain:${host}`);
    if (cached) return cached;

    // Cache miss → look up via core-api gRPC (Phase 9+ wire)
    // For now, dev fallback: try fetching from env-mapped list
    const mapped = process.env.WHITE_LABEL_DOMAIN_MAP;
    if (mapped) {
      for (const entry of mapped.split(",")) {
        const [h, tid] = entry.split(":");
        if (h === host) {
          await this.cacheDomain(host, tid);
          return tid;
        }
      }
    }

    this.logger.warn(`unknown domain host=${host}`);
    return null;
  }

  /**
   * Cache a domain → tenant mapping. Gọi từ admin API khi tenant cập nhật customDomain.
   */
  async cacheDomain(host: string, tenantId: string): Promise<void> {
    await this.redis.set(`tenant:domain:${host.toLowerCase()}`, tenantId, "EX", CACHE_TTL_SECONDS);
  }

  /**
   * Invalidate cache. Gọi từ admin API khi tenant xóa customDomain.
   */
  async invalidate(host: string): Promise<void> {
    await this.redis.del(`tenant:domain:${host.toLowerCase()}`);
  }
}
