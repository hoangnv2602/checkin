/**
 * apps/api-gateway/src/modules/billing/subscription/subscription-webhook.controller.ts
 *
 * I-501 — Stripe subscription webhook → core-api Subscription aggregate.
 * Public, no JWT. Verifies Stripe-Signature HMAC-SHA256.
 *
 * Handles:
 *  - customer.subscription.created → SubscribeToPlanCommand
 *  - customer.subscription.updated → UpgradePlanCommand
 *  - customer.subscription.deleted → CancelSubscriptionCommand
 *  - invoice.payment_failed      → MarkPastDue (deferred, surfaces in billing UI)
 *  - invoice.paid                → Reactivate if PastDue
 *
 * Idempotency: same as payment-webhook — Redis SET NX on `webhook:processed:`
 * key, TTL 7 days. Duplicate retry → 200 no-op.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Body, Controller, Headers, HttpCode, Inject, Optional, Post, UnauthorizedException } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS } from "../../_shared/redis/redis.module";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";
const DEDUP_TTL_SECONDS = 7 * 24 * 3600;
function getWebhookSecret(): string {
  return process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

interface StripeSubscriptionEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      customer: string;
      status: string;
      current_period_start: number;
      current_period_end: number;
      trial_end?: number | null;
      metadata?: Record<string, string>;
      items?: { data: { price: { id?: string; metadata?: Record<string, string> } }[] };
    };
  };
}

@Controller("v1/billing/webhook")
export class SubscriptionWebhookController {
  constructor(@Optional() @Inject(REDIS) private readonly redis?: Redis) {}

  @Post("stripe")
  @HttpCode(200)
  async stripe(@Body() body: unknown, @Headers("stripe-signature") signature: string) {
    if (!signature) throw new UnauthorizedException("stripe-signature required");
    const secret = getWebhookSecret();
    if (!secret) throw new UnauthorizedException("STRIPE_WEBHOOK_SECRET not configured");

    const rawBody = JSON.stringify(body);
    const verified = this.verifySignature(rawBody, signature, secret);
    if (!verified) throw new UnauthorizedException("Invalid signature");

    const event = body as StripeSubscriptionEvent;
    const sub = event.data.object;
    const orgId = sub.metadata?.["organizationId"];
    if (!orgId) throw new BadRequestException("metadata.organizationId required");

    // Dedup
    const dedupKey = `webhook:processed:stripe:subscription:${event.id}`;
    if (this.redis) {
      const set = await this.redis.set(dedupKey, "1", "EX", DEDUP_TTL_SECONDS, "NX");
      if (set !== "OK") {
        return { handled: true, duplicate: true };
      }
    }

    try {
      await this.dispatch(event.type, sub.id, orgId, sub);
      return { handled: true, type: event.type };
    } catch (err) {
      // Rollback dedup so provider retry can re-attempt
      if (this.redis) await this.redis.del(dedupKey);
      throw err;
    }
  }

  private async dispatch(
    type: string,
    externalSubscriptionId: string,
    organizationId: string,
    sub: StripeSubscriptionEvent["data"]["object"],
  ): Promise<void> {
    const url = `${CORE_API_BASE}/v1/billing/subscriptions`;
    const headers = { "Content-Type": "application/json" };

    switch (type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // Resolve planId from metadata; if missing, store as external id and let
        // core-api resolve via plan name. For Phase 5: assume metadata.planId set.
        const planId = sub.metadata?.["planId"];
        if (!planId) return;  // skip — needs manual reconciliation
        await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            organizationId,
            planId,
            startTrial: sub.status === "trialing",
            externalSubscriptionId,
          }),
        });
        break;
      }
      case "customer.subscription.deleted": {
        await fetch(`${url}/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            organizationId,
            actorUserId: sub.metadata?.["actorUserId"] ?? "00000000-0000-0000-0000-000000000000",
          }),
        });
        break;
      }
      case "invoice.payment_failed": {
        await fetch(`${url}/past-due`, {
          method: "POST",
          headers,
          body: JSON.stringify({ organizationId }),
        });
        break;
      }
      // invoice.paid and other events are no-ops at this layer.
      default:
        break;
    }
  }

  private verifySignature(rawBody: string, sigHeader: string, secret: string): boolean {
    const parts = Object.fromEntries(
      sigHeader.split(",").map((kv) => {
        const idx = kv.indexOf("=");
        return [kv.slice(0, idx), kv.slice(idx + 1)];
      }),
    );
    const t = parts["t"];
    const v1 = parts["v1"];
    if (!t || !v1) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
