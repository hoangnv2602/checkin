/**
 * apps/api-gateway/src/modules/tenancy/region/region-resolver.middleware.ts
 *
 * I-902 — Express middleware. Gắn `req.region` (RegionResolution) cho
 * downstream handlers (replica pool picker, gRPC client, cache).
 *
 * Chạy SAU `DomainResolverMiddleware` (I-804) — vì cần `req.tenantId` resolve
 * từ Host header custom domain trước.
 */
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { RegionResolverService, type RegionResolution } from "./region-resolver.service";

export interface RequestWithRegion extends Request {
  region?: RegionResolution;
}

@Injectable()
export class RegionResolverMiddleware implements NestMiddleware {
  constructor(private readonly resolver: RegionResolverService) {}

  async use(req: RequestWithRegion, _res: Response, next: NextFunction): Promise<void> {
    // Domain resolver middleware (I-804) đã gắn x-tenant-id; JWT guard sẽ
    // gắn req.user. Đọc tenantId từ header — middleware order guarantees
    // header đã có khi chạy.
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const headerVal = (name: string): string | undefined => {
      const v = headers[name];
      return Array.isArray(v) ? v[0] : v;
    };
    const tenantId = headerVal("x-tenant-id");
    const plan = headerVal("x-tenant-plan");
    const jwtRegion = headerVal("x-jwt-region");
    const headerRegion = headerVal("x-tenant-region");

    if (!tenantId) {
      // Public endpoints (login, public event page) — dùng default region.
      req.region = { region: "eu", source: "default" };
      next();
      return;
    }

    try {
      req.region = await this.resolver.resolve(tenantId, plan, jwtRegion, headerRegion);
    } catch (err) {
      // Best-effort: don't block request on region lookup failure
      req.region = { region: "eu", source: "default" };
    }
    next();
  }
}
