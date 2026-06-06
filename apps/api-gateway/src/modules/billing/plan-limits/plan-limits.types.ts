/**
 * apps/api-gateway/src/modules/billing/plan-limits/plan-limits.types.ts
 *
 * Shared types cho plan-tier / plan-limit surface. Consumed by:
 *   - plan-limit.guard.ts        (I-502)
 *   - commission.config.ts       (I-803)
 *   - marketplace-payment.service.ts (I-803)
 *   - stripe-connect.service.ts  (I-803)
 *
 * Source of truth về plan capabilities: core-api Billing context
 * (apps/core-api/src/SaasCheckin.Domain/Billing/Aggregates/Plan.cs).
 * BFF chỉ mirror metadata + commission bps; gating thật sự vẫn do core-api.
 */

export type PlanTier = "free" | "pro" | "marketplace" | "enterprise";

export interface PlanMetadata {
  tier: PlanTier;
  displayName: string;
  monthlyPriceUsd: number;
  maxActiveEvents: number;
  maxAttendeesPerMonth: number;
  maxStaffSeats: number;
  connectEnabled: boolean;
}

export const PLAN_METADATA: Record<PlanTier, PlanMetadata> = {
  free: {
    tier: "free",
    displayName: "Free",
    monthlyPriceUsd: 0,
    maxActiveEvents: 1,
    maxAttendeesPerMonth: 50,
    maxStaffSeats: 2,
    connectEnabled: false,
  },
  pro: {
    tier: "pro",
    displayName: "Pro",
    monthlyPriceUsd: 49,
    maxActiveEvents: 10,
    maxAttendeesPerMonth: 2_000,
    maxStaffSeats: 10,
    connectEnabled: true,
  },
  marketplace: {
    tier: "marketplace",
    displayName: "Marketplace",
    monthlyPriceUsd: 199,
    maxActiveEvents: 50,
    maxAttendeesPerMonth: 20_000,
    maxStaffSeats: 50,
    connectEnabled: true,
  },
  enterprise: {
    tier: "enterprise",
    displayName: "Enterprise",
    monthlyPriceUsd: 0, // custom contract
    maxActiveEvents: Number.MAX_SAFE_INTEGER,
    maxAttendeesPerMonth: Number.MAX_SAFE_INTEGER,
    maxStaffSeats: Number.MAX_SAFE_INTEGER,
    connectEnabled: true,
  },
};

export function isPlanTier(value: unknown): value is PlanTier {
  return value === "free" || value === "pro" || value === "marketplace" || value === "enterprise";
}
