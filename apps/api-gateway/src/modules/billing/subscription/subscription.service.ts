/**
 * apps/api-gateway/src/modules/billing/subscription/subscription.service.ts
 *
 * I-501 — BFF bridge to core-api Subscription aggregate qua REST.
 *   - getCurrent(organizationId)
 *   - listPlans()
 *   - upgrade(organizationId, newPlanId)
 *   - cancel(organizationId, actorUserId)
 */
import { Injectable, Logger } from "@nestjs/common";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

export interface SubscriptionDto {
  id: string;
  organizationId: string;
  planId: string;
  state: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  externalSubscriptionId: string | null;
}

export interface PlanDto {
  id: string;
  name: string;
  tier: string;
  priceAmountMinor: number;
  priceCurrency: string;
  period: string;
  maxActiveEvents: number;
  maxAttendeesPerMonth: number;
  maxStaffSeats: number;
  isDefault: boolean;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  async getCurrent(organizationId: string): Promise<SubscriptionDto | null> {
    const res = await fetch(`${CORE_API_BASE}/v1/billing/subscriptions/${organizationId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`core-api get subscription failed: ${res.status}`);
    return res.json();
  }

  async listPlans(): Promise<PlanDto[]> {
    const res = await fetch(`${CORE_API_BASE}/v1/billing/plans`);
    if (!res.ok) throw new Error(`core-api list plans failed: ${res.status}`);
    return res.json();
  }

  async upgrade(organizationId: string, newPlanId: string): Promise<void> {
    const res = await fetch(`${CORE_API_BASE}/v1/billing/subscriptions/upgrade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, newPlanId }),
    });
    if (!res.ok) throw new Error(`core-api upgrade failed: ${res.status}`);
  }

  async cancel(organizationId: string, actorUserId: string): Promise<void> {
    const res = await fetch(`${CORE_API_BASE}/v1/billing/subscriptions/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, actorUserId }),
    });
    if (!res.ok) throw new Error(`core-api cancel failed: ${res.status}`);
  }

  async getUsage(organizationId: string): Promise<unknown> {
    const res = await fetch(`${CORE_API_BASE}/v1/billing/usage?organizationId=${organizationId}`);
    if (!res.ok) throw new Error(`core-api usage failed: ${res.status}`);
    return res.json();
  }

  async listInvoices(organizationId: string, skip: number, take: number): Promise<unknown> {
    const res = await fetch(
      `${CORE_API_BASE}/v1/billing/invoices?organizationId=${organizationId}&skip=${skip}&take=${take}`,
    );
    if (!res.ok) throw new Error(`core-api invoices failed: ${res.status}`);
    return res.json();
  }
}
