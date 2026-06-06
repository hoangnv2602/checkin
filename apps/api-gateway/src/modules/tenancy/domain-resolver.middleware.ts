/**
 * apps/api-gateway/src/modules/tenancy/domain-resolver.middleware.ts
 *
 * I-804 — Express middleware: resolve host → tenantId, set `x-tenant-id`
 * request header (existing code ở core-api/grpc đã đọc header này).
 *
 * Public route (login, public event page) vẫn pass; private route cần
 * tenantId sẽ 404 nếu host không resolve.
 */
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { DomainResolverService } from "./domain-resolver.service";

@Injectable()
export class DomainResolverMiddleware implements NestMiddleware {
  constructor(private readonly resolver: DomainResolverService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const host = req.headers.host ?? "";
    const tenantId = await this.resolver.resolve(host);

    if (tenantId) {
      req.headers["x-tenant-id"] = tenantId;
      // Expose cho downstream logging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).resolvedTenantId = tenantId;
    }

    next();
  }
}
