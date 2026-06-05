/**
 * test/payments/stripe.adapter.test.ts — I-306 (Phase 3 test for I-302).
 *
 * Verifies Stripe webhook signature handling — đây là payment-critical path,
 * sai là mất tiền hoặc bị double-charge.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { StripeAdapter } from "../../src/modules/billing/payments/adapters/stripe.adapter";

const WEBHOOK_SECRET = "whsec_test_dummy";

describe("StripeAdapter.verifyWebhook", () => {
  let adapter: StripeAdapter;
  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    adapter = new StripeAdapter();
  });

  it("accepts a valid signed event and returns parsed WebhookEvent", () => {
    const rawBody = JSON.stringify({
      id: "evt_test_123",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_test",
          amount_total: 5000,
          currency: "usd",
          metadata: { orderId: "ord-1", organizationId: "org-1" },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest("hex");
    const signatureHeader = `t=${t},v1=${sig}`;

    const ev = adapter.verifyWebhook({ rawBody, signatureHeader });
    expect(ev).not.toBeNull();
    expect(ev!.provider).toBe("stripe");
    expect(ev!.type).toBe("payment_intent.succeeded");
    expect(ev!.orderId).toBe("ord-1");
    expect(ev!.organizationId).toBe("org-1");
    expect(ev!.amountMinor).toBe(5000);
    expect(ev!.currency).toBe("USD");
    expect(ev!.signatureValid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const original = JSON.stringify({ id: "evt_1", type: "x", data: { object: { metadata: { orderId: "a", organizationId: "b" } } } });
    const tampered = JSON.stringify({ id: "evt_1", type: "x", data: { object: { metadata: { orderId: "DIFFERENT", organizationId: "b" } } } });
    const t = "1700000000";
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${original}`).digest("hex");
    const ev = adapter.verifyWebhook({ rawBody: tampered, signatureHeader: `t=${t},v1=${sig}` });
    expect(ev).toBeNull();
  });

  it("rejects a signature from a different secret", () => {
    const rawBody = JSON.stringify({ id: "evt_2", type: "x", data: { object: { metadata: { orderId: "a", organizationId: "b" } } } });
    const t = "1700000000";
    const sig = createHmac("sha256", "whsec_attacker").update(`${t}.${rawBody}`).digest("hex");
    const ev = adapter.verifyWebhook({ rawBody, signatureHeader: `t=${t},v1=${sig}` });
    expect(ev).toBeNull();
  });

  it("rejects missing metadata fields", () => {
    const rawBody = JSON.stringify({ id: "evt_3", type: "x", data: { object: { metadata: {} } } });
    const t = "1700000000";
    const sig = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest("hex");
    const ev = adapter.verifyWebhook({ rawBody, signatureHeader: `t=${t},v1=${sig}` });
    expect(ev).toBeNull();
  });

  it("rejects when webhook secret is not configured", () => {
    const orig = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const empty = new StripeAdapter();
    const ev = empty.verifyWebhook({ rawBody: "{}", signatureHeader: "t=1,v1=abc" });
    expect(ev).toBeNull();
    process.env.STRIPE_WEBHOOK_SECRET = orig;
  });
});
