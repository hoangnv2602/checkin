/**
 * apps/api-gateway/src/modules/checkin-admin/admin-auth.module.ts
 *
 * I-107 — Admin auth module: controller + service + admin guard. Wire to global
 * JwtVerifierService + JwtAuthGuard from auth module.
 */
import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthGuard } from "./guards/admin-auth.guard";
import { IpAllowlistGuard } from "./guards/ip-allowlist.guard";

@Global()
@Module({
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    AdminAuthGuard,
    IpAllowlistGuard,
    // APP_GUARD xếp chồng: IpAllowlistGuard trước (deny unknown IP), AdminAuthGuard sau (verify JWT).
    { provide: APP_GUARD, useClass: IpAllowlistGuard },
    { provide: APP_GUARD, useClass: AdminAuthGuard },
  ],
  exports: [AdminAuthService, AdminAuthGuard],
})
export class CheckinAdminAuthModule {}
