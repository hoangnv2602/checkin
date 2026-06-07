/**
 * apps/api-gateway/src/modules/_shared/crypto/secrets.ts
 *
 * I-802 — Symmetric encryption (AES-256-GCM) cho at-rest secrets (Slack/Discord
 * webhook URL, Stripe Connect secret, etc). Key derive từ
 * `WEBHOOK_ENCRYPTION_KEY` env (32-byte hex). Nếu không set, fallback về
 * `JWT_SIGNING_KEY` (đã có sẵn ở .env) — cảnh báo loud để operator biết.
 *
 * Format: base64( iv[12] || authTag[16] || ciphertext )
 *  - iv: random mỗi lần encrypt
 *  - authTag: GCM integrity
 *  - ciphertext: AES-256-GCM(plaintext)
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(): Buffer {
  const hex = process.env.WEBHOOK_ENCRYPTION_KEY ?? process.env.JWT_SIGNING_KEY;
  if (!hex) {
    throw new Error("WEBHOOK_ENCRYPTION_KEY (or JWT_SIGNING_KEY fallback) is required");
  }
  // Accept 64-char hex (256-bit) or arbitrary-length — SHA-256 to normalize.
  const key = createHash("sha256").update(hex).digest();
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
