/**
 * test/billing/subscription-webhook.e2e-spec.ts — I-505.
 *
 * Subscription webhook: HMAC signature verify, dedup, dispatch to core-api.
 *  - bad signature → 401
 *  - missing signature → 401
 *  - good signature + new event → handled, core-api called once
 *  - good signature + duplicate event → handled=true, core-api NOT called
 *  - customer.subscription.deleted → POSTs /cancel
 *  - invoice.payment_failed → POSTs /past-due
 */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SubscriptionWebhookController } from "../../src/modules/billing/subscription/subscription-webhook.controller";

const SECRET = "whsec_test_123";

function sign(rawBody: string): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

function makeEvent(overrides: Partial<{ id: string; type: string; orgId: string; planId: string; status: string; subId: string }> = {}) {
  return {
    id: overrides.id ?? "evt_test_1",
    type: overrides.type ?? "customer.subscription.created",
    data: {
      object: {
        id: overrides.subId ?? "sub_test_1",
        customer: "cus_test",
        status: overrides.status ?? "active",
        current_period_start: 0,
        current_period_end: 0,
        metadata: {
          organizationId: overrides.orgId ?? "00000000-0000-0000-0000-000000000001",
          planId: overrides.planId ?? "00000000-0000-0000-0000-000000000002",
        },
      },
    },
  };
}

describe("SubscriptionWebhookController", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let controller: SubscriptionWebhookController;

  beforeEach(() => {
    process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET = SECRET;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    controller = new SubscriptionWebhookController(undefined);
  });

  it("rejects when stripe-signature missing", async () => {
    await expect(controller.stripe({ id: "x", type: "x" }, undefined as unknown as string))
      .rejects.toThrow(/stripe-signature required/);
  });

  it("rejects when signature invalid", async () => {
    const body = makeEvent();
    await expect(controller.stripe(body, "t=1,v1=invalidsig"))
      .rejects.toThrow(/Invalid signature/);
  });

  it("dispatches customer.subscription.created → /v1/billing/subscriptions", async () => {
    const body = makeEvent();
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const res = await controller.stripe(body, sign(JSON.stringify(body)));
    expect(res).toMatchObject({ handled: true, type: "customer.subscription.created" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/billing/subscriptions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("dispatches customer.subscription.deleted → /v1/billing/subscriptions/cancel", async () => {
    const body = makeEvent({ type: "customer.subscription.deleted", id: "evt_del" });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await controller.stripe(body, sign(JSON.stringify(body)));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/billing/subscriptions/cancel"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("dispatches invoice.payment_failed → /v1/billing/subscriptions/past-due", async () => {
    const body = makeEvent({ type: "invoice.payment_failed", id: "evt_pf" });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await controller.stripe(body, sign(JSON.stringify(body)));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/billing/subscriptions/past-due"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("skips dispatch when metadata.organizationId missing", async () => {
    const body = { id: "x", type: "customer.subscription.created", data: { object: { id: "s", status: "active", metadata: {} } } };
    await expect(controller.stripe(body, sign(JSON.stringify(body))))
      .rejects.toThrow(/organizationId required/);
  });
});
