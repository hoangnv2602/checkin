/**
 * apps/api-gateway/src/common/decorators/current-user.decorator.ts
 *
 * @CurrentUser() — param decorator lấy VerifiedAuth đã set bởi JwtAuthGuard.
 * Trả undefined nếu route @Public() và không có JWT.
 */
import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { VerifiedAuth } from "../../modules/auth/services/jwt-verifier.service";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): VerifiedAuth | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: VerifiedAuth }>();
    return req.user;
  },
);
