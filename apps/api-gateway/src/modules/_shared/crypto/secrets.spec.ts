/**
 * apps/api-gateway/src/modules/_shared/crypto/secrets.spec.ts
 *
 * I-802 — AES-256-GCM roundtrip tests cho webhook URL encryption.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./secrets";

describe("secrets (AES-256-GCM)", () => {
  beforeAll(() => {
    process.env.WEBHOOK_ENCRYPTION_KEY =
      "a".repeat(64); // 64-char hex = 256 bits
  });

  it("roundtrips a Slack webhook URL", () => {
    const url = "https://hooks.slack.com/services/T0123/B0456/abcxyz";
    const enc = encryptSecret(url);
    expect(enc).not.toContain(url);
    expect(enc.length).toBeGreaterThan(50);
    const dec = decryptSecret(enc);
    expect(dec).toBe(url);
  });

  it("roundtrips a Discord webhook URL", () => {
    const url = "https://discord.com/api/webhooks/1234567890/abcdef-token";
    const enc = encryptSecret(url);
    const dec = decryptSecret(enc);
    expect(dec).toBe(url);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const url = "https://example.com/webhook";
    const a = encryptSecret(url);
    const b = encryptSecret(url);
    expect(a).not.toBe(b);
  });

  it("detects tampered ciphertext (GCM auth tag)", () => {
    const url = "https://example.com/webhook";
    const enc = encryptSecret(url);
    const buf = Buffer.from(enc, "base64");
    // Flip a bit in the ciphertext portion
    buf[buf.length - 1] ^= 0x01;
    const tampered = buf.toString("base64");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("rejects malformed payload", () => {
    expect(() => decryptSecret("not-base64-or-too-short")).toThrow();
  });
});
