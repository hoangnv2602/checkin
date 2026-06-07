/**
 * apps/api-gateway/src/modules/billing/connect/commission.config.spec.ts
 *
 * I-803 — Commission resolution + application fee math tests.
 * Per plan + tenant override + edge cases.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveCommissionBps,
  computeApplicationFee,
  DEFAULT_COMMISSION_BPS,
} from "./commission.config";

describe("commission.config", () => {
  const originalEnv = process.env.TENANT_COMMISSION_OVERRIDE;

  beforeEach(() => {
    delete process.env.TENANT_COMMISSION_OVERRIDE;
  });

  describe("resolveCommissionBps", () => {
    it("Marketplace plan = 10% (1000 bps)", () => {
      expect(resolveCommissionBps("marketplace")).toBe(1000);
    });

    it("Pro plan = 5% (500 bps)", () => {
      expect(resolveCommissionBps("pro")).toBe(500);
    });

    it("Enterprise plan = 2% (200 bps)", () => {
      expect(resolveCommissionBps("enterprise")).toBe(200);
    });

    it("Free plan = 0%", () => {
      expect(resolveCommissionBps("free")).toBe(0);
    });

    it("default constant is 1000 bps (10%)", () => {
      expect(DEFAULT_COMMISSION_BPS).toBe(1000);
    });

    it("tenant override via env wins over plan", () => {
      process.env.TENANT_COMMISSION_OVERRIDE = "tenant_abc:300,tenant_xyz:700";
      expect(resolveCommissionBps("marketplace", "tenant_abc")).toBe(300);
      expect(resolveCommissionBps("marketplace", "tenant_xyz")).toBe(700);
    });

    it("falls back to plan when override entry exists for other tenant", () => {
      process.env.TENANT_COMMISSION_OVERRIDE = "tenant_abc:300";
      expect(resolveCommissionBps("pro", "tenant_xyz")).toBe(500);
    });

    it("malformed override entries are ignored (no crash)", () => {
      process.env.TENANT_COMMISSION_OVERRIDE = "garbage_no_colon,also:bad,good:450";
      expect(resolveCommissionBps("marketplace", "good")).toBe(450);
      expect(resolveCommissionBps("marketplace", "garbage_no_colon")).toBe(1000);
    });
  });

  describe("computeApplicationFee", () => {
    it("0 bps returns 0 fee", () => {
      expect(computeApplicationFee(10_000, 0)).toBe(0);
    });

    it("10% on $100 (10000 minor) = 1000 minor", () => {
      expect(computeApplicationFee(10_000, 1000)).toBe(1000);
    });

    it("5% on $50.00 (5000 minor) = 250 minor", () => {
      expect(computeApplicationFee(5_000, 500)).toBe(250);
    });

    it("2% on $1234.56 (123456 minor) = 2469 minor (floor)", () => {
      // 123456 * 200 / 10000 = 2469.12 → floor → 2469
      expect(computeApplicationFee(123_456, 200)).toBe(2469);
    });

    it("100% bps returns full amount as fee", () => {
      expect(computeApplicationFee(10_000, 10_000)).toBe(10_000);
    });

    it("handles odd amounts without floating point drift", () => {
      // 9999 minor * 333 bps / 10000 = 332.9667 → floor → 332
      expect(computeApplicationFee(9_999, 333)).toBe(332);
    });
  });
});
