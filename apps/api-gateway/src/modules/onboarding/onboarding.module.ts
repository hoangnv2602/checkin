/**
 * apps/api-gateway/src/modules/onboarding/onboarding.module.ts
 *
 * I-703 — Wires OnboardingService + OnboardingController. Exports service for
 * future use (e.g. include state in whoami response).
 */
import { Module } from "@nestjs/common";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
