/**
 * apps/api-gateway/src/modules/auth/guards/jwt-auth.guard.ts
 *
 * JwtAuthGuard — verify access JWT từ Authorization header (Bearer) hoặc
 * cookie `sa_access_token` (cho web/mobile browser). Set req.user = VerifiedAuth
 * nếu pass; ném UnauthorizedException nếu fail. Routes @Public() skip check.
 *
 * Phase 1: chỉ verify, KHÔNG refresh. Refresh tự handle ở /v1/auth/refresh
 * endpoint (cookie `sa_refresh_token`).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../../../common/decorators/public.decorator";
import { JwtVerifierService, type VerifiedAuth } from "../services/jwt-verifier.service";

const ACCESS_COOKIE = "sa_access_token";
const ACCESS_HEADER_PREFIX = "Bearer ";

export interface AuthenticatedRequest extends Request {
  user?: VerifiedAuth;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException("Missing Authorization header or cookie");
    }
    const verified = await this.jwtVerifier.verify(token);
    req.user = verified;
    return true;
  }

  private extractToken(req: AuthenticatedRequest): string | null {
    // 1. Authorization: Bearer <token>
    const auth = req.headers.authorization;
    if (auth && auth.startsWith(ACCESS_HEADER_PREFIX)) {
      return auth.slice(ACCESS_HEADER_PREFIX.length).trim();
    }
    // 2. Cookie: sa_access_token=<token>
    const cookieHeader = req.headers.cookie ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)sa_access_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  }
}
