/**
 * apps/api-gateway/src/modules/tenancy/tenancy.module.ts
 *
 * I-804 — Tenancy module. Global middleware resolve host → tenantId.
 */
import { Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { DomainResolverService } from "./domain-resolver.service";
import { DomainResolverMiddleware } from "./domain-resolver.middleware";
import { DomainAdminController } from "./domain-admin.controller";

@Global()
@Module({
  providers: [DomainResolverService],
  controllers: [DomainAdminController],
  exports: [DomainResolverService],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DomainResolverMiddleware).forRoutes("*");
  }
}
