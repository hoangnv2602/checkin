/**
 * apps/api-gateway/src/modules/onboarding/onboarding.controller.ts
 *
 * I-703 — REST endpoints cho onboarding wizard state. Authenticated (JwtAuthGuard
 * global). `userId` lấy từ JWT sub claim — không trust body.
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { VerifiedAuth } from "../auth/services/jwt-verifier.service";
import {
  OnboardingService,
  type OnboardingStateDto,
  type OnboardingStepType,
} from "./onboarding.service";

@ApiTags("onboarding")
@Controller("v1/onboarding")
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("state")
  @ApiOperation({ summary: "Get current onboarding state for this user" })
  async state(@CurrentUser() user: VerifiedAuth): Promise<OnboardingStateDto> {
    return this.onboarding.getState(this.userIdOrThrow(user));
  }

  @Post("advance")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark a step complete and advance" })
  async advance(
    @CurrentUser() user: VerifiedAuth,
    @Body() body: { step: OnboardingStepType; data?: OnboardingStateDto["data"] },
  ): Promise<OnboardingStateDto> {
    return this.onboarding.advance(this.userIdOrThrow(user), body.step, body.data);
  }

  @Post("skip")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Skip the wizard (dismissed=true, no more prompts)" })
  async skip(@CurrentUser() user: VerifiedAuth): Promise<OnboardingStateDto> {
    return this.onboarding.skip(this.userIdOrThrow(user));
  }

  @Post("reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset wizard to start (testing / org switch)" })
  async reset(@CurrentUser() user: VerifiedAuth): Promise<OnboardingStateDto> {
    return this.onboarding.reset(this.userIdOrThrow(user));
  }

  private userIdOrThrow(user: VerifiedAuth | undefined): string {
    if (!user?.sub) throw new Error("Missing user sub claim in JWT");
    return user.sub;
  }
}
