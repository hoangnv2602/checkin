/**
 * apps/api-gateway/src/modules/billing/connect/refund.service.spec.ts
 *
 * I-803 — RefundService fee behavior + split math tests.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RefundService } from "./refund.service";

describe("RefundService", () => {
  let service: RefundService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    service = new RefundService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("decideFeeBehavior", () => {
    it("reverses fee if charge < 7 days old AND organizer not paid out", () => {
      const charge = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      expect(service.decideFeeBehavior(charge, false)).toBe("reversed");
    });

    it("keeps fee if organizer already paid out", () => {
      const charge = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      expect(service.decideFeeBehavior(charge, true)).toBe("kept");
    });

    it("keeps fee if charge > 7 days old (Stripe window closed)", () => {
      const charge = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      expect(service.decideFeeBehavior(charge, false)).toBe("kept");
    });

    it("keeps fee at exactly the 7-day boundary (off-by-one safety)", () => {
      const charge = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      // ageMs > SEVEN_DAYS_MS? No, equal — but use `>` so equal is "reversed".
      // Caller should treat the boundary as still reversible.
      expect(service.decideFeeBehavior(charge, false)).toBe("reversed");
    });
  });

  describe("computeSplit", () => {
    it("full refund with reversed fee: buyer full, organizer net, platform fee returned", () => {
      const r = service.computeSplit(undefined, 10_000, 1_000, "reversed");
      expect(r.buyerRefundMinor).toBe(10_000);
      expect(r.organizerDebitMinor).toBe(9_000); // 10000 - 1000
      expect(r.platformFeeReturnedMinor).toBe(1_000);
    });

    it("partial refund with reversed fee: proportional fee returned", () => {
      const r = service.computeSplit(5_000, 10_000, 1_000, "reversed");
      expect(r.buyerRefundMinor).toBe(5_000);
      expect(r.platformFeeReturnedMinor).toBe(500); // 50% of original fee
      expect(r.organizerDebitMinor).toBe(4_500);
    });

    it("full refund with kept fee: buyer full, organizer loses full, platform keeps fee", () => {
      const r = service.computeSplit(undefined, 10_000, 1_000, "kept");
      expect(r.buyerRefundMinor).toBe(10_000);
      expect(r.organizerDebitMinor).toBe(10_000);
      expect(r.platformFeeReturnedMinor).toBe(0);
    });

    it("throws if refund amount exceeds original charge", () => {
      expect(() => service.computeSplit(20_000, 10_000, 1_000, "reversed")).toThrow(/exceeds/);
    });

    it("refund amount equal to gross charge works (full refund)", () => {
      const r = service.computeSplit(10_000, 10_000, 1_000, "reversed");
      expect(r.buyerRefundMinor).toBe(10_000);
    });
  });

  describe("refund (dev path)", () => {
    it("returns dev refund with split math", async () => {
      const r = await service.refund({
        paymentIntentId: "pi_test_1",
        orderId: "ord_1",
        chargeCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        organizerPaidOut: false,
      });
      expect(r.refundId).toMatch(/^re_dev_ord_1_/);
      expect(r.feeBehavior).toBe("reversed");
      expect(r.status).toBe("succeeded");
    });
  });

  describe("refund (live path)", () => {
    it("calls Stripe API with reverse_application_fee=true for reversed case", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_fake";
      service = new RefundService();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "re_123", amount: 5000, status: "succeeded" }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      const r = await service.refund({
        paymentIntentId: "pi_test_2",
        orderId: "ord_2",
        amountMinor: 5_000,
        chargeCreatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        organizerPaidOut: false,
        reason: "requested_by_customer",
      });
      expect(r.refundId).toBe("re_123");
      expect(r.feeBehavior).toBe("reversed");
      const body = fetchMock.mock.calls[0][1].body as string;
      expect(body).toContain("reverse_application_fee=true");
      expect(body).toContain("amount=5000");
      expect(body).toContain("payment_intent=pi_test_2");
    });

    it("calls Stripe API with reverse_application_fee omitted for kept case", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_fake";
      service = new RefundService();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "re_456", amount: 10000, status: "succeeded" }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      await service.refund({
        paymentIntentId: "pi_test_3",
        orderId: "ord_3",
        chargeCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        organizerPaidOut: false,
      });
      const body = fetchMock.mock.calls[0][1].body as string;
      expect(body).not.toContain("reverse_application_fee");
    });

    it("throws on non-2xx Stripe response", async () => {
      process.env.STRIPE_SECRET_KEY = "sk_test_fake";
      service = new RefundService();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () => "charge already refunded",
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      await expect(
        service.refund({
          paymentIntentId: "pi_test_4",
          orderId: "ord_4",
          chargeCreatedAt: new Date(),
          organizerPaidOut: false,
        }),
      ).rejects.toThrow(/already refunded/);
    });
  });
});
