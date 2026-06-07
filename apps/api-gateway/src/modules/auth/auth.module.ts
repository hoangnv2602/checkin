/**
 * apps/api-gateway/src/modules/auth/auth.module.ts
 *
 * AuthModule — I-102 NestJS auth wiring.
 *  - AuthController (REST endpoints)
 *  - AuthService (gRPC bridge)
 *  - JwtVerifierService (RS256 verify)
 *  - JwtAuthGuard (re-exported for global use in app.module.ts)
 *  - PlanRateLimitGuard (I-807 — apply per controller via @UseGuards)
 */
import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtVerifierService } from "./services/jwt-verifier.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PlanRateLimitGuard } from "./guards/plan-rate-limit.guard";
import { RateLimitOverrideStore } from "./rate-limit-override/override.store";
import { TrialModule } from "../billing/trial/trial.module";

@Global()
@Module({
  imports: [TrialModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtVerifierService,
    JwtAuthGuard,
    PlanRateLimitGuard,
    RateLimitOverrideStore,
  ],
  exports: [
    JwtAuthGuard,
    JwtVerifierService,
    AuthService,
    PlanRateLimitGuard,
    RateLimitOverrideStore,
  ],
})
export class AuthModule {}
