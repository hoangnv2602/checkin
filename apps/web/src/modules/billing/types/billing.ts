/**
 * apps/web/src/modules/billing/types/billing.ts
 */
export type PlanTier = "Free" | "Pro" | "Enterprise";
export type BillingPeriod = "Monthly" | "Yearly";
export type SubscriptionState = "Trial" | "Active" | "PastDue" | "Cancelled";

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  priceAmountMinor: number;
  priceCurrency: string;
  period: BillingPeriod;
  maxActiveEvents: number;
  maxAttendeesPerMonth: number;
  maxStaffSeats: number;
  isDefault: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  state: SubscriptionState;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  externalSubscriptionId: string | null;
}

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  amountMinor: number;
  currency: string;
  issuedAt: string;
  paidAt: string | null;
  providerInvoiceId: string | null;
}

export interface UsageMeter {
  activeEvents: number;
  maxActiveEvents: number;
  attendeesThisMonth: number;
  maxAttendeesPerMonth: number;
  staffSeats: number;
  maxStaffSeats: number;
}
