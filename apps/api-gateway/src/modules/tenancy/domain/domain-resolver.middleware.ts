/**
 * apps/api-gateway/src/modules/tenancy/domain/domain-resolver.middleware.ts
 *
 * I-804 — Express middleware: resolve custom domain → tenantId và stash
 * vào `req.tenant` cho downstream guards (rate-limit, plan-limit).
 *
 * Apply globally trước JwtAuthGuard — shared domain thì skip, custom
 * domain thì lookup Redis (5min TTL) → set req.tenant = { tenantId, plan }.
 *
 * Usage trong main.ts:
 *   app.use(new DomainResolverMiddleware(resolver).use);
 */
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express-serve-static-core";
import { DomainResolverService } from "./domain-resolver.service";

// Augment express-serve-static-core's Request interface so we can stash
// the resolved custom-domain tenant for downstream guards (rate-limit,
// plan-limit). Importing `Request` from "express-serve-static-core"
// directly (not from "express") ensures the augmentation merges into
// the exact same type tree that the middleware uses.
//
// @types/express-serve-static-core is a direct devDep (not just transitive)
// so tsc can resolve the module path under pnpm strict hoisting.
declare module "express-serve-static-core" {
  interface Request {
    /** Populated by DomainResolverMiddleware for custom domain requests. */
    domainTenant?: { tenantId: string; plan: string; cached: boolean };
  }
}

@Injectable()
export class DomainResolverMiddleware implements NestMiddleware {
  constructor(private readonly resolver: DomainResolverService) {}

  use = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const host = req.headers.host ?? req.hostname ?? "";
      if (this.resolver.isSharedDomain(host)) {
        return next();
      }
      const resolution = await this.resolver.resolve(host);
      if (resolution) {
        req.domainTenant = {
          tenantId: resolution.tenantId,
          plan: resolution.plan,
          cached: resolution.cached,
        };
        // Stash on x-tenant-id header để PlanRateLimitGuard pick up
        req.headers["x-tenant-id"] = resolution.tenantId;
      }
      next();
    } catch (err) {
      // Don't fail the request — fall through to JWT-based tenant resolution
      next();
    }
  };
}
