/**
 * apps/api-gateway/test/billing/commission.test.ts
 *
 * I-803 — Unit test cho commission split calculation.
 */
import {
  resolveCommissionBps,
  computeApplicationFee,
} from "../../src/modules/billing/connect/commission.config";

describe("commission config", () => {
  describe("resolveCommissionBps", () => {
    it("Pro plan = 5% (500 bps)", () => {
      expect(resolveCommissionBps("pro")).toBe(500);
    });
    it("Marketplace plan = 10% (1000 bps)", () => {
      expect(resolveCommissionBps("marketplace")).toBe(1000);
    });
    it("Free plan = 0% (Connect disabled)", () => {
      expect(resolveCommissionBps("free")).toBe(0);
    });
    it("Enterprise = 2% (200 bps)", () => {
      expect(resolveCommissionBps("enterprise")).toBe(200);
    });

    it("env override per-tenant", () => {
      process.env.TENANT_COMMISSION_OVERRIDE = "tenant_special:300";
      expect(resolveCommissionBps("marketplace", "tenant_special")).toBe(300);
      expect(resolveCommissionBps("marketplace", "tenant_normal")).toBe(1000);
      delete process.env.TENANT_COMMISSION_OVERRIDE;
    });
  });

  describe("computeApplicationFee", () => {
    it("$100 gross @ 10% = $10 fee", () => {
      expect(computeApplicationFee(10000, 1000)).toBe(1000);
    });
    it("0% rate = 0 fee", () => {
      expect(computeApplicationFee(10000, 0)).toBe(0);
    });
    it("100% rate = full amount", () => {
      expect(computeApplicationFee(10000, 10000)).toBe(10000);
    });
    it("floor on odd amounts (10001 * 5% = 500.05 → 500)", () => {
      expect(computeApplicationFee(10001, 500)).toBe(500);
    });
    it("organizer net = gross - fee", () => {
      const gross = 25000;
      const fee = computeApplicationFee(gross, 1000);
      expect(gross - fee).toBe(22500);
    });
  });
});
