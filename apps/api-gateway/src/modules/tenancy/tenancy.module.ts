/**
 * apps/api-gateway/src/modules/tenancy/tenancy.module.ts
 *
 * I-804 — Tenancy module. Global middleware resolve host → tenantId.
 * Wires DomainResolverService + DomainResolverMiddleware + DomainAdminController.
 */
import { Global, MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { DomainResolverService } from "./domain/domain-resolver.service";
import { DomainResolverMiddleware } from "./domain/domain-resolver.middleware";
import { DomainAdminController } from "./domain-admin.controller";

@Global()
@Module({
  providers: [DomainResolverService, DomainResolverMiddleware],
  controllers: [DomainAdminController],
  exports: [DomainResolverService, DomainResolverMiddleware],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DomainResolverMiddleware).forRoutes("*");
  }
}
