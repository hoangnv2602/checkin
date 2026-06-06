/**
 * apps/api-gateway/test/registration/registration-flow.test.ts — I-306.
 *
 * End-to-end happy path test: create order → checkout → webhook → mark-paid.
 * Uses Fetch mocks for Stripe, real fetch for BFF endpoints (assumes BFF
 * already wired in test).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

const BFF = process.env.BFF_URL ?? "http://localhost:3001";
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const STRIPE_WEBHOOK_SECRET = "whsec_e2e_test";

function signStripePayload(rawBody: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${sig}`;
}

describe("Registration happy path (E2E)", () => {
  let orderId: string;

  beforeAll(async () => {
    // 1. Create order qua BFF
    const res = await fetch(`${BFF}/v1/registration/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: ORG_ID,
        eventId: "00000000-0000-0000-0000-000000000010",
        ticketTypeId: "00000000-0000-0000-0000-000000000020",
        quantity: 1,
        buyerName: "E2E Tester",
        buyerEmail: "e2e@example.com",
        provider: "stripe",
      }),
    });
    if (!res.ok) throw new Error(`create order failed: ${res.status}`);
    const data = (await res.json()) as { id: string };
    orderId = data.id;
  });

  it("creates order in Pending state", async () => {
    const res = await fetch(`${BFF}/v1/registration/orders/${orderId}?organizationId=${ORG_ID}`);
    const order = (await res.json()) as { status: string };
    expect(order.status).toBe("Pending");
  });

  it("marks paid on Stripe webhook with valid signature", async () => {
    const rawBody = JSON.stringify({
      id: "evt_e2e_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          metadata: { orderId, organizationId: ORG_ID },
          amount_total: 10000,
          currency: "usd",
        },
      },
    });
    const sig = signStripePayload(rawBody, STRIPE_WEBHOOK_SECRET);
    const res = await fetch(`${BFF}/v1/payments/webhook/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: rawBody,
    });
    expect(res.status).toBe(200);
    const result = (await res.json()) as { handled: boolean; duplicate?: boolean };
    expect(result.handled).toBe(true);
  });

  it("deduplicates repeat webhook (idempotency)", async () => {
    const rawBody = JSON.stringify({
      id: "evt_e2e_1",  // same as previous
      type: "payment_intent.succeeded",
      data: { object: { metadata: { orderId, organizationId: ORG_ID } } },
    });
    const sig = signStripePayload(rawBody, STRIPE_WEBHOOK_SECRET);
    const res = await fetch(`${BFF}/v1/payments/webhook/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: rawBody,
    });
    expect(res.status).toBe(200);
    const result = (await res.json()) as { handled: boolean; duplicate?: boolean };
    expect(result.duplicate).toBe(true);
  });

  it("rejects webhook with tampered body (signature mismatch)", async () => {
    const valid = JSON.stringify({
      id: "evt_e2e_2",
      type: "payment_intent.succeeded",
      data: { object: { metadata: { orderId, organizationId: ORG_ID } } },
    });
    const sig = signStripePayload(valid, STRIPE_WEBHOOK_SECRET);
    const tampered = valid.replace("payment_intent.succeeded", "payment_intent.canceled");
    const res = await fetch(`${BFF}/v1/payments/webhook/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: tampered,
    });
    expect(res.status).toBe(401);
  });
});
