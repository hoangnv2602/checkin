/**
 * test/payments/webhook-router.test.ts — I-306 (Phase 3 webhook dedup).
 *
 * Verify WebhookRouter:
 *  1. First call → handled=true, dispatches to markPaid
 *  2. Repeat call (same providerEventId) → handled=true, duplicate=true
 *    (idempotent retry)
 *  3. Failure on markPaid → rollback Redis dedup key (allow retry)
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { WebhookRouter } from "../../src/modules/billing/payments/webhooks/webhook-router";
import type { WebhookEvent } from "../../src/modules/billing/payments/payment-provider.interface";

// In-memory Redis stub
function makeRedisStub() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
      // SET key value EX 7d NX — return "OK" if set, null if exists
      if (store.has(key)) return null;
      store.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  };
}

function makeEvent(id: string, orderId = "ord-1"): WebhookEvent {
  return {
    provider: "stripe",
    providerEventId: id,
    type: "payment_intent.succeeded",
    orderId,
    organizationId: "00000000-0000-0000-0000-000000000001",
    signatureValid: true,
    rawPayload: "{}",
    receivedAt: new Date().toISOString(),
  };
}

describe("WebhookRouter.dispatch", () => {
  let redis: ReturnType<typeof makeRedisStub>;
  let payments: { markPaidIfNeeded: ReturnType<typeof vi.fn> };
  let router: WebhookRouter;

  beforeEach(() => {
    redis = makeRedisStub();
    payments = { markPaidIfNeeded: vi.fn().mockResolvedValue(undefined) };
    router = new WebhookRouter(payments as never, redis as never);
  });

  it("first call dispatches and returns handled=true", async () => {
    const result = await router.dispatch(makeEvent("evt_1"));
    expect(result.handled).toBe(true);
    expect(result.duplicate).toBeUndefined();
    expect(payments.markPaidIfNeeded).toHaveBeenCalledOnce();
  });

  it("second call with same providerEventId is deduped (duplicate=true)", async () => {
    await router.dispatch(makeEvent("evt_1"));
    const result = await router.dispatch(makeEvent("evt_1"));
    expect(result.handled).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(payments.markPaidIfNeeded).toHaveBeenCalledOnce();   // not called twice
  });

  it("different providerEventId → new dispatch", async () => {
    await router.dispatch(makeEvent("evt_1"));
    const result = await router.dispatch(makeEvent("evt_2"));
    expect(result.handled).toBe(true);
    expect(result.duplicate).toBeUndefined();
    expect(payments.markPaidIfNeeded).toHaveBeenCalledTimes(2);
  });

  it("markPaid failure rolls back dedup key so retry can reprocess", async () => {
    payments.markPaidIfNeeded = vi.fn().mockRejectedValue(new Error("core-api down"));
    router = new WebhookRouter(payments as never, redis as never);

    await expect(router.dispatch(makeEvent("evt_fail"))).rejects.toThrow("core-api down");
    // Dedup key must be removed so the next retry can try again
    expect(redis.del).toHaveBeenCalledWith("webhook:processed:stripe:evt_fail");

    // Retry with same event id should now pass through (no longer deduped)
    payments.markPaidIfNeeded = vi.fn().mockResolvedValue(undefined);
    router = new WebhookRouter(payments as never, redis as never);
    const result = await router.dispatch(makeEvent("evt_fail"));
    expect(result.handled).toBe(true);
    expect(result.duplicate).toBeUndefined();
  });

  it("rejects events with signatureValid=false", async () => {
    const bad = { ...makeEvent("evt_evil"), signatureValid: false };
    const result = await router.dispatch(bad);
    expect(result.handled).toBe(false);
    expect(payments.markPaidIfNeeded).not.toHaveBeenCalled();
  });
});
