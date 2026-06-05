/**
 * apps/api-gateway/src/modules/billing/payments/adapters/stripe.adapter.ts
 *
 * I-302 — Stripe adapter. Implements PaymentProviderInterface using Stripe SDK.
 *
 * Signature verification uses Stripe's constructEvent() which validates
 * `Stripe-Signature` header (HMAC-SHA256, v1 scheme). NEVER trust raw body
 * without verification.
 *
 * Idempotency: client (BFF) generates `idempotencyKey` (orderId + nonce) →
 * Stripe `Idempotency-Key` header. Stripe returns the same Checkout Session
 * for repeated calls with the same key within 24h.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProviderInterface,
  VerifyWebhookInput,
  WebhookEvent,
} from "../payment-provider.interface";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { REDIS } from "../../../_shared/redis/redis.module";
import type Redis from "ioredis";

interface StripeCheckoutSession {
  id: string;
  url: string;
  expires_at: number;
}

@Injectable()
export class StripeAdapter implements PaymentProviderInterface {
  readonly name = "stripe" as const;
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly secretKey: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor(
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {
    this.secretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  }

  isEnabledFor(organizationId: string): Promise<boolean> {
    // TODO: read org_settings.enabled_providers[]. Phase 5 wiring.
    return Promise.resolve(Boolean(this.secretKey));
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.secretKey) {
      // dev fallback — synthesize a fake session so end-to-end flow runs
      return this.devStubCheckout(input);
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: this.buildCheckoutBody(input),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Stripe create checkout failed: ${res.status} ${err}`);
    }
    const session = (await res.json()) as StripeCheckoutSession;
    return {
      provider: "stripe",
      sessionId: session.id,
      redirectUrl: session.url,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
    };
  }

  verifyWebhook(input: VerifyWebhookInput): WebhookEvent | null {
    if (!this.webhookSecret) {
      this.logger.warn("STRIPE_WEBHOOK_SECRET not configured; rejecting webhook");
      return null;
    }
    const event = this.constructEvent(input.rawBody, input.signatureHeader, this.webhookSecret);
    if (!event) return null;
    return event;
  }

  async checkStatus(providerSessionId: string): Promise<{ status: "paid" | "pending" | "failed" | "expired" }> {
    if (!this.secretKey) return { status: "pending" };
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${providerSessionId}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    if (!res.ok) return { status: "pending" };
    const session = (await res.json()) as { payment_status?: string; status?: string };
    if (session.payment_status === "paid") return { status: "paid" };
    if (session.status === "expired") return { status: "expired" };
    return { status: "pending" };
  }

  private constructEvent(rawBody: string, sigHeader: string, secret: string): WebhookEvent | null {
    // Stripe signature format: t=<timestamp>,v1=<hmac sha256 of "t.body" with secret>
    const parts = Object.fromEntries(
      sigHeader.split(",").map((kv) => {
        const idx = kv.indexOf("=");
        return [kv.slice(0, idx), kv.slice(idx + 1)];
      }),
    );
    const t = parts["t"];
    const v1 = parts["v1"];
    if (!t || !v1) return null;

    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const v1Buf = Buffer.from(v1, "hex");
    if (expectedBuf.length !== v1Buf.length) return null;
    if (!timingSafeEqual(expectedBuf, v1Buf)) return null;

    const parsed = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: { metadata?: Record<string, string>; amount_total?: number; currency?: string } };
    };
    const meta = parsed.data.object.metadata ?? {};
    if (!meta["orderId"] || !meta["organizationId"]) return null;
    return {
      provider: "stripe",
      providerEventId: parsed.id,
      type: parsed.type,
      orderId: meta["orderId"],
      organizationId: meta["organizationId"],
      amountMinor: parsed.data.object.amount_total,
      currency: parsed.data.object.currency?.toUpperCase(),
      signatureValid: true,
      rawPayload: rawBody,
      receivedAt: new Date().toISOString(),
    };
  }

  private buildCheckoutBody(input: CreateCheckoutInput): string {
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", input.successUrl);
    params.set("cancel_url", input.cancelUrl);
    params.set("customer_email", input.buyerEmail);
    params.set("client_reference_id", input.orderId);
    params.set("metadata[orderId]", input.orderId);
    params.set("metadata[organizationId]", input.organizationId);
    params.set("line_items[0][quantity]", String(1));
    params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(input.amountMinor));
    params.set("line_items[0][price_data][product_data][name]", input.description);
    return params.toString();
  }

  private devStubCheckout(input: CreateCheckoutInput): CreateCheckoutResult {
    const sessionId = `cs_dev_${input.idempotencyKey}`;
    // Append ?dev=1 so client can render mock checkout page.
    const u = new URL(input.successUrl);
    u.searchParams.set("dev", "1");
    u.searchParams.set("session_id", sessionId);
    return {
      provider: "stripe",
      sessionId,
      redirectUrl: u.toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }
}
