/**
 * apps/api-gateway/src/modules/checkin-admin/guards/admin-auth.guard.ts
 *
 * I-107 — Verify JWT có `aud: 'checkin-admin'`, `mfa: true`, role ∈ {platform_*}.
 * Registered as APP_GUARD trong checkin-admin module.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { JwtVerifierService, type VerifiedAuth } from "../../auth/services/jwt-verifier.service";

const ACCESS_COOKIE = "sa_pa_session";
const ALLOWED_ROLES = new Set(["platform_owner", "platform_support", "platform_engineer"]);

export interface AdminAuthenticatedRequest extends Request {
  user?: VerifiedAuth;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: JwtVerifierService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    // Chỉ áp dụng cho admin routes — tránh chặn tenant /v1/auth/* (audience 'web').
    if (!req.path.startsWith("/v1/admin")) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException("Missing admin session");

    const verified = await this.jwtVerifier.verify(token, "checkin-admin");
    if (!verified.permissions.includes("mfa")) {
      throw new ForbiddenException("MFA required for platform admin");
    }
    if (!verified.role || !ALLOWED_ROLES.has(verified.role)) {
      throw new ForbiddenException(`Role '${verified.role}' not allowed for platform admin`);
    }
    req.user = verified;
    return true;
  }

  private extractToken(req: AdminAuthenticatedRequest): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
    const cookieHeader = req.headers.cookie ?? "";
    const match = cookieHeader.match(/(?:^|;\s*)sa_pa_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    return null;
  }
}
