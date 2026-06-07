/**
 * apps/api-gateway/src/modules/tenancy/tenancy.module.ts
 *
 * I-804 + I-902 — Tenancy module. Global middleware resolve host → tenantId,
 * tenant → region. Wires DomainResolverService + DomainResolverMiddleware +
 * RegionResolverService + RegionResolverMiddleware + DomainAdminController.
 */
import { Global, MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { DomainResolverService } from "./domain/domain-resolver.service";
import { DomainResolverMiddleware } from "./domain/domain-resolver.middleware";
import { RegionResolverService } from "./region/region-resolver.service";
import { RegionResolverMiddleware } from "./region/region-resolver.middleware";
import { DomainAdminController } from "./domain-admin.controller";

@Global()
@Module({
  providers: [
    DomainResolverService,
    DomainResolverMiddleware,
    RegionResolverService,
    RegionResolverMiddleware,
  ],
  controllers: [DomainAdminController],
  exports: [
    DomainResolverService,
    DomainResolverMiddleware,
    RegionResolverService,
    RegionResolverMiddleware,
  ],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order: domain first (resolve host → tenant), then region (resolve tenant → region).
    consumer.apply(DomainResolverMiddleware, RegionResolverMiddleware).forRoutes("*");
  }
}
