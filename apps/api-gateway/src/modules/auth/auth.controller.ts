/**
 * apps/api-gateway/src/modules/auth/auth.controller.ts
 *
 * REST endpoints cho authentication flow:
 *  - POST /v1/auth/login    → set httpOnly cookies + return access token
 *  - POST /v1/auth/refresh  → rotate refresh + return new access token
 *  - POST /v1/auth/logout   → revoke refresh, clear cookies
 *  - POST /v1/auth/register → create user + organization (Phase 1 register flow)
 *  - GET  /v1/auth/whoami   → return current user info (requires valid JWT)
 *
 * Cookies: `sa_access_token` (15 min) + `sa_refresh_token` (30 day) — httpOnly,
 * SameSite=Lax, Secure (prod). Body trả accessToken để mobile dev dùng.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { VerifiedAuth } from "./services/jwt-verifier.service";
import { LoginDto, RefreshDto, RegisterDto } from "./dto/auth.dto";
import { AuthService } from "./services/auth.service";

const ACCESS_COOKIE = "sa_access_token";
const REFRESH_COOKIE = "sa_refresh_token";
const ACCESS_TTL_SECONDS = 15 * 60;            // 15 min
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;  // 30 day
const IS_PROD = process.env.NODE_ENV === "production";

@ApiTags("auth")
@Controller("v1/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      userId: result.userId,
      accessToken: result.accessToken,
      accessExpiresAt: result.accessExpiresAt,
    };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
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
  async logout(@Body() dto: RefreshDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      await this.auth.logout(dto.refreshToken);
    } catch {
      // best-effort — always clear cookies
    }
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE);
  }

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      userId: result.userId,
      organizationId: result.organizationId,
      accessToken: result.accessToken,
      accessExpiresAt: result.accessExpiresAt,
    };
  }

  @Get("whoami")
  async whoami(
    @CurrentUser() user: VerifiedAuth | undefined,
    @Req() req: Request,
  ) {
    if (!user) {
      return { authenticated: false };
    }
    // Optional: enrich với fresh user info từ core-api
    try {
      const detail = await this.auth.getUser(user.sub, user.tenantId);
      return {
        authenticated: true,
        user: {
          id: detail.id,
          email: detail.email,
          fullName: detail.fullName,
          emailVerified: detail.emailVerified,
          lastLoginAt: detail.lastLoginAt,
        },
        tenant: { id: user.tenantId ?? null, role: user.role ?? null },
        permissions: user.permissions,
      };
    } catch {
      // Fallback nếu gRPC lỗi — vẫn return JWT claim
      return {
        authenticated: true,
        user: {
          id: user.sub,
          email: user.email,
          fullName: user.fullName,
        },
        tenant: { id: user.tenantId ?? null, role: user.role ?? null },
        permissions: user.permissions,
      };
    }
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: ACCESS_TTL_SECONDS * 1000,
      path: "/",
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PROD,
      maxAge: REFRESH_TTL_SECONDS * 1000,
      path: "/",
    });
  }
}
