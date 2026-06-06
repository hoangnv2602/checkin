/**
 * apps/api-gateway/src/modules/billing/connect/stripe-connect.service.ts
 *
 * I-803 — Stripe Connect service. Quản lý:
 *   - Tạo Connect Express account cho organizer
 *   - Account onboarding link
 *   - Lấy thông tin account (charges_enabled, payouts_enabled, requirements)
 *
 * Không tạo charge ở đây — xem marketplace-payment.service.ts cho split checkout.
 */
import { Injectable, Logger } from "@nestjs/common";

export interface ConnectAccountOnboarding {
  accountId: string;
  onboardingUrl: string;
  expiresAt: string;
}

export interface ConnectAccountStatus {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: {
    currentlyDue: string[];
    pastDue: string[];
    disabledReason: string | null;
  };
}

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly secretKey: string | undefined;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY;
  }

  /**
   * Tạo Connect Express account cho organizer. Trả về accountId.
   * Idempotent: truyền idempotencyKey để retry-safe.
   */
  async createAccount(organizerId: string, idempotencyKey: string): Promise<string> {
    if (!this.secretKey) {
      // dev fallback
      return `acct_dev_${organizerId}`;
    }

    const res = await fetch("https://api.stripe.com/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: new URLSearchParams({
        type: "express",
        capabilities: JSON.stringify({
          card_payments: { requested: true },
          transfers: { requested: true },
        }),
        business_type: "individual",
        metadata: JSON.stringify({ organizerId }),
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe create account failed: ${res.status} ${err}`);
    }
    const account = (await res.json()) as { id: string };
    return account.id;
  }

  /**
   * Tạo Account Link cho onboarding flow. Express accounts cần user
   * điền thông tin tax/bank qua hosted page.
   */
  async createOnboardingLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<ConnectAccountOnboarding> {
    if (!this.secretKey) {
      return {
        accountId,
        onboardingUrl: `${returnUrl}?dev=1&account=${accountId}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      };
    }

    const res = await fetch("https://api.stripe.com/v1/account_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe create account link failed: ${res.status} ${err}`);
    }
    const link = (await res.json()) as { url: string; expires_at: number };
    return {
      accountId,
      onboardingUrl: link.url,
      expiresAt: new Date(link.expires_at * 1000).toISOString(),
    };
  }

  async getAccountStatus(accountId: string): Promise<ConnectAccountStatus | null> {
    if (!this.secretKey) {
      return {
        accountId,
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        requirements: { currentlyDue: [], pastDue: [], disabledReason: null },
      };
    }

    const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    if (!res.ok) {
      this.logger.warn(`stripe account fetch failed status=${res.status} account=${accountId}`);
      return null;
    }
    const acc = (await res.json()) as {
      id: string;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
      requirements?: {
        currently_due?: string[];
        past_due?: string[];
        disabled_reason?: string | null;
      };
    };
    return {
      accountId: acc.id,
      chargesEnabled: acc.charges_enabled,
      payoutsEnabled: acc.payouts_enabled,
      detailsSubmitted: acc.details_submitted,
      requirements: {
        currentlyDue: acc.requirements?.currently_due ?? [],
        pastDue: acc.requirements?.past_due ?? [],
        disabledReason: acc.requirements?.disabled_reason ?? null,
      },
    };
  }
}
