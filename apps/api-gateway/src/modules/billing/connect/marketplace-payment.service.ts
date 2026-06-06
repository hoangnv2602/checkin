/**
 * apps/api-gateway/src/modules/billing/connect/marketplace-payment.service.ts
 *
 * I-803 — Marketplace payment: split charge giữa platform và organizer qua
 * Stripe Connect. Tính application_fee từ commission rate, tạo checkout
 * session với `payment_intent_data.application_fee_amount` + `transfer_data.destination`.
 */
import { Injectable, Logger } from "@nestjs/common";
import {
  resolveCommissionBps,
  computeApplicationFee,
} from "./commission.config";
import { StripeConnectService } from "./stripe-connect.service";
import type { PlanTier } from "../plan-limits/plan-limits.types";

export interface MarketplaceCheckoutInput {
  orderId: string;
  organizerId: string;          // tenant id (organizer) — Connect account của họ
  organizerStripeAccountId: string;
  amountMinor: number;
  currency: string;
  description: string;
  buyerEmail: string;
  plan: PlanTier;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface MarketplaceCheckoutResult {
  provider: "stripe";
  sessionId: string;
  redirectUrl: string;
  expiresAt: string;
  applicationFeeMinor: number;
  organizerNetMinor: number;
  commissionBps: number;
}

@Injectable()
export class MarketplacePaymentService {
  private readonly logger = new Logger(MarketplacePaymentService.name);
  private readonly secretKey: string | undefined;

  constructor(private readonly connect: StripeConnectService) {
    this.secretKey = process.env.STRIPE_SECRET_KEY;
  }

  async createSplitCheckout(input: MarketplaceCheckoutInput): Promise<MarketplaceCheckoutResult> {
    const commissionBps = resolveCommissionBps(input.plan, input.organizerId);
    const applicationFeeMinor = computeApplicationFee(input.amountMinor, commissionBps);
    const organizerNetMinor = input.amountMinor - applicationFeeMinor;

    if (!this.secretKey) {
      const sessionId = `cs_dev_${input.idempotencyKey}`;
      const url = new URL(input.successUrl);
      url.searchParams.set("dev", "1");
      url.searchParams.set("session_id", sessionId);
      return {
        provider: "stripe",
        sessionId,
        redirectUrl: url.toString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        applicationFeeMinor,
        organizerNetMinor,
        commissionBps,
      };
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", input.successUrl);
    params.set("cancel_url", input.cancelUrl);
    params.set("customer_email", input.buyerEmail);
    params.set("client_reference_id", input.orderId);
    params.set("metadata[orderId]", input.orderId);
    params.set("metadata[organizationId]", input.organizerId);
    params.set("metadata[plan]", input.plan);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(input.amountMinor));
    params.set("line_items[0][price_data][product_data][name]", input.description);

    // Connect split — quan trọng nhất của I-803
    params.set("payment_intent_data[application_fee_amount]", String(applicationFeeMinor));
    params.set("payment_intent_data[transfer_data][destination]", input.organizerStripeAccountId);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe split checkout failed: ${res.status} ${err}`);
    }
    const session = (await res.json()) as { id: string; url: string; expires_at: number };
    return {
      provider: "stripe",
      sessionId: session.id,
      redirectUrl: session.url,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
      applicationFeeMinor,
      organizerNetMinor,
      commissionBps,
    };
  }
}
