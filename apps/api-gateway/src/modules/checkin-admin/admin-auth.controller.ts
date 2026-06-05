/**
 * apps/api-gateway/src/modules/checkin-admin/admin-auth.controller.ts
 *
 * I-107 Phase 1 — REST endpoints cho checkin-admin auth flow.
 *  - POST /v1/admin/auth/login
 *  - POST /v1/admin/auth/refresh
 *  - POST /v1/admin/auth/logout
 *  - POST /v1/admin/auth/mfa/setup
 *  - POST /v1/admin/auth/mfa/verify
 *  - GET  /v1/admin/auth/me
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { VerifiedAuth } from "../auth/services/jwt-verifier.service";
import { AdminAuthService } from "./admin-auth.service";
import { AdminLoginDto, AdminRefreshDto, AdminMfaVerifyDto } from "./dto/admin-auth.dto";

const ACCESS_COOKIE = "sa_pa_session";
const REFRESH_COOKIE = "sa_pa_refresh";
const IS_PROD = process.env.NODE_ENV === "production";
const REFRESH_TTL_HOURS = parseInt(process.env.PLATFORM_ADMIN_REFRESH_TTL_HOURS ?? "8", 10);

@ApiTags("admin-auth")
@Controller("v1/admin/auth")
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, dto.totpCode);
    if (!result.mfaRequired) {
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    return {
      userId: result.userId,
      mfaRequired: result.mfaRequired,
      setupToken: result.mfaRequired ? result.accessToken : undefined, // short-lived setup token
      accessToken: result.mfaRequired ? undefined : result.accessToken,
      accessExpiresAt: result.accessExpiresAt,
    };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: AdminRefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.refresh(dto.refreshToken);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      accessToken: result.accessToken,
      accessExpiresAt: result.accessExpiresAt,
    };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: AdminRefreshDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      await this.auth.logout(dto.refreshToken);
    } catch {
      // best-effort
    }
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE);
  }

  @Public()
  @Post("mfa/setup")
  @HttpCode(HttpStatus.OK)
  async setupMfa(@Body("setupToken") setupToken: string) {
    return this.auth.setupMfa(setupToken);
  }

  @Public()
  @Post("mfa/verify")
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() dto: AdminMfaVerifyDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verifyMfa(dto.setupToken, dto.totpCode);
    // After MFA verified, cookies can be set (use setupToken to claim real session)
    return result;
  }

  @Get("me")
  async me(@CurrentUser() user: VerifiedAuth | undefined) {
    if (!user) return { authenticated: false };
    return {
      authenticated: true,
      user: { id: user.sub, email: user.email, role: user.role, permissions: user.permissions },
    };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "strict",  // stricter than tenant (Lax) — privileged
      secure: IS_PROD,
      maxAge: 15 * 60 * 1000,  // 15 min
      path: "/",
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: IS_PROD,
      maxAge: REFRESH_TTL_HOURS * 60 * 60 * 1000,
      path: "/",
    });
  }
}
