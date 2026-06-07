/**
 * apps/api-gateway/src/modules/webhooks/webhook-signer.ts
 *
 * I-901 — HMAC-SHA256 signature cho outbound webhook payloads.
 *
 * Header: `X-Signature-SHA256: sha256=<hex>`
 * Header: `X-Webhook-Timestamp: <unix-seconds>`  (replay protection)
 * Header: `X-Webhook-Id: <delivery-id>`           (idempotency ở consumer)
 * Header: `X-Webhook-Event: <event-type>`
 *
 * Tenant verify ở phía họ:
 *
 *   const expected = crypto.createHmac('sha256', secret)
 *     .update(`${timestamp}.${rawBody}`).digest('hex');
 *   const sig = req.headers['x-signature-sha256']?.replace('sha256=', '');
 *   if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) ...
 *
 * Format chuẩn Stripe-style — quen thuộc, nhiều SDK verify sẵn.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-signature-sha256";
export const TIMESTAMP_HEADER = "x-webhook-timestamp";
export const ID_HEADER = "x-webhook-id";
export const EVENT_HEADER = "x-webhook-event";

export interface SignInput {
  secret: string;
  timestamp: number;
  body: string;
}

export function signPayload({ secret, timestamp, body }: SignInput): string {
  const signed = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(signed).digest("hex");
  return `sha256=${sig}`;
}

export interface VerifyInput {
  secret: string;
  timestamp: number;
  body: string;
  signatureHeader: string | undefined;
  /** Max allowed clock skew (seconds). Default 300 (5 min) theo Stripe convention. */
  toleranceSeconds?: number;
  /** Current time (epoch seconds) — injectable cho test. */
  nowSeconds?: number;
}

export interface VerifyResult {
  valid: boolean;
  reason?: "missing_header" | "bad_format" | "expired" | "mismatch";
}

export function verifyPayload({
  secret,
  timestamp,
  body,
  signatureHeader,
  toleranceSeconds = 300,
  nowSeconds,
}: VerifyInput): VerifyResult {
  if (!signatureHeader) return { valid: false, reason: "missing_header" };
  if (!signatureHeader.startsWith("sha256=")) return { valid: false, reason: "bad_format" };

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { valid: false, reason: "expired" };
  }

  const expected = signPayload({ secret, timestamp, body }).replace("sha256=", "");
  const got = signatureHeader.replace("sha256=", "");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(got, "utf8");
  if (a.length !== b.length) return { valid: false, reason: "mismatch" };
  return { valid: timingSafeEqual(a, b), reason: timingSafeEqual(a, b) ? undefined : "mismatch" };
}
