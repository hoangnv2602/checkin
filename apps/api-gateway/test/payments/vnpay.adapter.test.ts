/**
 * test/payments/vnpay.adapter.test.ts — I-306 (Phase 3 test for I-302).
 *
 * Verifies VNPay IPN signature handling (SHA512, sorted params minus
 * vnp_SecureHash). Real money path.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { VnpayAdapter } from "../../src/modules/billing/payments/adapters/vnpay.adapter";

const HASH_SECRET = "VNPAY_TEST_SECRET";

function signParams(meta: Record<string, string>, secret: string): string {
  const sortedKeys = Object.keys(meta)
    .filter((k) => k.startsWith("vnp_") && k !== "vnp_SecureHash" && k !== "vnp_SecureHashType")
    .sort();
  const signData = sortedKeys.map((k) => `${k}=${meta[k]}`).join("&");
  return createHmac("sha512", secret).update(signData).digest("hex");
}

describe("VnpayAdapter.verifyWebhook", () => {
  let adapter: VnpayAdapter;
  beforeAll(() => {
    process.env.VNP_HASH_SECRET = HASH_SECRET;
    adapter = new VnpayAdapter();
  });

  it("accepts a valid IPN with vnp_ResponseCode=00 (paid)", () => {
    const meta: Record<string, string> = {
      vnp_TxnRef: "ord-vnpay-1",
      vnp_Amount: "1000000",  // 1,000,000 VND * 100
      vnp_CurrCode: "VND",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      vnp_PayDate: "20260605120000",
      organizationId: "org-1",
    };
    meta["vnp_SecureHash"] = signParams(meta, HASH_SECRET);
    const ev = adapter.verifyWebhook({ rawBody: "", signatureHeader: meta["vnp_SecureHash"]!, metadata: meta });
    expect(ev).not.toBeNull();
    expect(ev!.provider).toBe("vnpay");
    expect(ev!.type).toBe("ipn_paid");
    expect(ev!.orderId).toBe("ord-vnpay-1");
    expect(ev!.organizationId).toBe("org-1");
    expect(ev!.currency).toBe("VND");
  });

  it("returns ipn_failed for non-zero response code", () => {
    const meta: Record<string, string> = {
      vnp_TxnRef: "ord-2",
      vnp_Amount: "500000",
      vnp_CurrCode: "VND",
      vnp_ResponseCode: "24",  // user cancelled
      vnp_TransactionStatus: "02",
      organizationId: "org-1",
    };
    meta["vnp_SecureHash"] = signParams(meta, HASH_SECRET);
    const ev = adapter.verifyWebhook({ rawBody: "", signatureHeader: meta["vnp_SecureHash"]!, metadata: meta });
    expect(ev).not.toBeNull();
    expect(ev!.type).toBe("ipn_failed");
  });

  it("rejects a tampered amount", () => {
    const meta: Record<string, string> = {
      vnp_TxnRef: "ord-3",
      vnp_Amount: "1000000",
      vnp_CurrCode: "VND",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      organizationId: "org-1",
    };
    meta["vnp_SecureHash"] = signParams(meta, HASH_SECRET);
    meta["vnp_Amount"] = "99999999";  // tampered
    const ev = adapter.verifyWebhook({ rawBody: "", signatureHeader: meta["vnp_SecureHash"]!, metadata: meta });
    expect(ev).toBeNull();
  });

  it("rejects signature from wrong secret", () => {
    const meta: Record<string, string> = {
      vnp_TxnRef: "ord-4",
      vnp_Amount: "100",
      vnp_CurrCode: "VND",
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
      organizationId: "org-1",
    };
    meta["vnp_SecureHash"] = signParams(meta, "attacker_secret");
    const ev = adapter.verifyWebhook({ rawBody: "", signatureHeader: meta["vnp_SecureHash"]!, metadata: meta });
    expect(ev).toBeNull();
  });
});
