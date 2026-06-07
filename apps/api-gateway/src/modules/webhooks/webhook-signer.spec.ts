/**
 * apps/api-gateway/src/modules/webhooks/webhook-signer.spec.ts
 *
 * I-901 — Signer unit tests (no DI, no HTTP).
 */
import { describe, expect, it } from "vitest";
import { signPayload, verifyPayload } from "./webhook-signer";

describe("webhook-signer", () => {
  const secret = "test-secret-32-bytes-long-aaaaaa";
  const body = JSON.stringify({ id: "evt_1", type: "event.published", data: { hello: "world" } });

  it("signs and verifies a valid payload", () => {
    const ts = 1_700_000_000;
    const sig = signPayload({ secret, timestamp: ts, body });
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    const result = verifyPayload({ secret, timestamp: ts, body, signatureHeader: sig, nowSeconds: ts });
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects a missing header", () => {
    const result = verifyPayload({
      secret,
      timestamp: 1_700_000_000,
      body,
      signatureHeader: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("missing_header");
  });

  it("rejects a wrong-format header", () => {
    const result = verifyPayload({
      secret,
      timestamp: 1_700_000_000,
      body,
      signatureHeader: "md5=abc",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("bad_format");
  });

  it("rejects an expired timestamp", () => {
    const ts = 1_700_000_000;
    const sig = signPayload({ secret, timestamp: ts, body });
    const future = ts + 1000;
    const result = verifyPayload({
      secret,
      timestamp: ts,
      body,
      signatureHeader: sig,
      toleranceSeconds: 60,
      nowSeconds: future,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("rejects a body-tampered signature", () => {
    const ts = 1_700_000_000;
    const sig = signPayload({ secret, timestamp: ts, body });
    const tampered = body + " ";
    const result = verifyPayload({ secret, timestamp: ts, body: tampered, signatureHeader: sig, nowSeconds: ts });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("mismatch");
  });

  it("rejects a wrong-secret signature", () => {
    const ts = 1_700_000_000;
    const sig = signPayload({ secret: "other-secret", timestamp: ts, body });
    const result = verifyPayload({ secret, timestamp: ts, body, signatureHeader: sig, nowSeconds: ts });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("mismatch");
  });
});
