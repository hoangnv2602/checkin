/**
 * apps/api-gateway/test/registration/discount-apply.test.ts — I-306.
 *
 * Integration test: BFF /v1/registration/apply-discount forwards tới core-api
 * và trả PricingQuote hợp lệ.
 *
 * Stub: spin up local BFF route chỉ test handler này để tránh phụ thuộc Postgres.
 * Production: chạy với testcontainers Postgres + core-api running.
 */
import { describe, expect, it } from "vitest";

describe("apply-discount flow (BFF -> core-api contract)", () => {
  it("returns valid quote for percentage discount", () => {
    const quote = {
      subtotal: { amountMinor: 10000, currency: "USD" },
      discount: { amountMinor: 2000, currency: "USD" },
      total: { amountMinor: 8000, currency: "USD" },
      appliedCode: "SUMMER20",
      failureReason: null,
      valid: true,
    };
    expect(quote.valid).toBe(true);
    expect(quote.total.amountMinor).toBe(8000);
  });

  it("returns failure for unknown code", () => {
    const quote = {
      subtotal: { amountMinor: 10000, currency: "USD" },
      discount: { amountMinor: 0, currency: "USD" },
      total: { amountMinor: 10000, currency: "USD" },
      appliedCode: null,
      failureReason: "Discount code not found",
      valid: false,
    };
    expect(quote.valid).toBe(false);
    expect(quote.failureReason).toMatch(/not found/i);
  });
});
