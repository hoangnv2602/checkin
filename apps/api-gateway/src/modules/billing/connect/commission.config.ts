/**
 * apps/api-gateway/src/modules/billing/connect/commission.config.ts
 *
 * I-803 — Per-plan commission rate cho Stripe Connect marketplace.
 *
 * Plans (D-tier thêm ở Phase 8):
 *   - Free        : 0% — không dùng Connect
 *   - Pro         : 5% — giảm commission cho Pro
 *   - Marketplace : 10% — default
 *   - Enterprise  : custom (override qua tenant_settings.commission_bps)
 *
 * Rate tính theo basis points (bps): 5% = 500 bps.
 */
import type { PlanTier } from "../plan-limits/plan-limits.types";

export interface CommissionConfig {
  plan: PlanTier;
  bps: number; // basis points
  description: string;
}

export const DEFAULT_COMMISSION_BPS = 1000; // 10% Marketplace default

const COMMISSION_TABLE: Record<PlanTier, CommissionConfig> = {
  free: { plan: "free", bps: 0, description: "Free plan — Connect not enabled" },
  pro: { plan: "pro", bps: 500, description: "Pro plan — 5% platform commission" },
  marketplace: { plan: "marketplace", bps: 1000, description: "Marketplace — 10% platform commission" },
  enterprise: { plan: "enterprise", bps: 200, description: "Enterprise — 2% (negotiated)" },
};

/**
 * Resolve commission rate cho 1 tenant. Cho phép override qua env
 *   TENANT_COMMISSION_OVERRIDE = "tenant_abc:300,tenant_xyz:700"
 * hoặc qua tenant settings từ DB (sẽ wire ở Phase 9).
 */
export function resolveCommissionBps(plan: PlanTier, tenantId?: string): number {
  if (tenantId) {
    const override = process.env.TENANT_COMMISSION_OVERRIDE;
    if (override) {
      for (const entry of override.split(",")) {
        const [tid, bps] = entry.split(":");
        if (tid === tenantId) return Number(bps);
      }
    }
  }
  return COMMISSION_TABLE[plan].bps;
}

/**
 * Tính application fee (giữ lại bởi platform) từ gross amount.
 * Trả về minor units (cents).
 */
export function computeApplicationFee(grossMinor: number, bps: number): number {
  if (bps <= 0) return 0;
  if (bps >= 10000) return grossMinor;
  return Math.floor((grossMinor * bps) / 10000);
}
