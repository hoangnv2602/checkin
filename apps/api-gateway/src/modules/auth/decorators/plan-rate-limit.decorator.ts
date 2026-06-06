/**
 * apps/api-gateway/src/modules/auth/decorators/plan-rate-limit.decorator.ts
 *
 * I-807 — Decorator đánh dấu controller/route cần rate limit theo plan tier.
 * Default: áp dụng global. Per-route có thể override limit/burst.
 *
 * Usage:
 *   @PlanRateLimit()                         // default tier-based
 *   @PlanRateLimit({ tier: 'enterprise' })   // force enterprise tier
 *   @PlanRateLimit({ skipIf: req => req.user?.role === 'owner' })
 */
import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export interface PlanRateLimitOptions {
  tier?: "free" | "pro" | "enterprise";
  skipIf?: (req: unknown) => boolean;
}

export const PLAN_RATE_LIMIT_META = "plan-rate-limit";
export const PlanRateLimit = (opts: PlanRateLimitOptions = {}): CustomDecorator =>
  SetMetadata(PLAN_RATE_LIMIT_META, opts);
