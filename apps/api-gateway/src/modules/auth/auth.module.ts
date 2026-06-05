/**
 * apps/api-gateway/src/modules/auth/auth.module.ts
 *
 * AuthModule — I-102 NestJS auth wiring.
 *  - AuthController (REST endpoints)
 *  - AuthService (gRPC bridge)
 *  - JwtVerifierService (RS256 verify)
 *  - JwtAuthGuard (re-exported for global use in app.module.ts)
 */
import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtVerifierService } from "./services/jwt-verifier.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtVerifierService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtVerifierService, AuthService],
})
export class AuthModule {}
