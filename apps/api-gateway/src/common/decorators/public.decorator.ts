/**
 * apps/api-gateway/src/common/decorators/public.decorator.ts
 *
 * @Public() — mark route handler để skip JwtAuthGuard global.
 * Dùng cho /v1/auth/login, /v1/auth/refresh, /health/live, /v1/docs, etc.
 */
import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
