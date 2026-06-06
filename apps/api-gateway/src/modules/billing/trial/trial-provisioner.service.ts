/**
 * apps/api-gateway/src/modules/billing/trial/trial-provisioner.service.ts
 *
 * I-504 — TrialProvisioner. Auto-start 14-day Pro trial khi org mới đăng ký.
 * Identity context publish OrganizationCreated event → TrialProvisioner
 * consume → call .NET /v1/billing/subscriptions với startTrial=true.
 *
 * Free tier default: 1 active event, 50 attendees/month, 3 staff seats.
 * Plan seed sống ở db/migrations (idempotent insert).
 */
import { Injectable, Logger } from "@nestjs/common";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";
const TRIAL_DURATION_DAYS = 14;
const FREE_PLAN_LIMITS = {
  maxActiveEvents: 1,
  maxAttendeesPerMonth: 50,
  maxStaffSeats: 3,
};

@Injectable()
export class TrialProvisioner {
  private readonly logger = new Logger(TrialProvisioner.name);

  async provisionTrial(input: { organizationId: string; proPlanId: string }): Promise<{
    subscriptionId: string;
    trialEndsAt: string;
  }> {
    const res = await fetch(`${CORE_API_BASE}/v1/billing/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Id": input.organizationId },
      body: JSON.stringify({
        organizationId: input.organizationId,
        planId: input.proPlanId,
        startTrial: true,
        externalSubscriptionId: `trial-${input.organizationId}`,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`trial provision failed: ${res.status} ${err}`);
    }
    const data = (await res.json()) as { subscription_id: string };
    const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 3600 * 1000).toISOString();
    this.logger.log(`trial provisioned for org=${input.organizationId} sub=${data.subscription_id}`);
    return { subscriptionId: data.subscription_id, trialEndsAt };
  }

  freeTierLimits() {
    return FREE_PLAN_LIMITS;
  }
}
