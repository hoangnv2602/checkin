/**
 * apps/api-gateway/src/modules/billing/payments/payment-provider.interface.ts
 *
 * I-302 — Payment provider abstraction (ADR-0005).
 *
 * Mọi payment integration phải implement interface này. Không bao giờ
 * gọi provider SDK trực tiếp từ use case / controller.
 *
 * 2 adapter hiện tại:
 *  - StripeAdapter:   PaymentIntent + webhook Stripe-Signature
 *  - VnpayAdapter:    VNPay API + IPN vnp_SecureHash SHA512
 *
 * Tenant-scoped config: org_settings.default_provider, enabled_providers[].
 * Cùng 1 bảng `payments` với enum provider + idempotency_key.
 */
export type PaymentProviderName = "stripe" | "vnpay";

export interface CreateCheckoutInput {
  organizationId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  buyerEmail: string;
  buyerName: string;
  description: string;
  /** Tenant-provided success/cancel URL (e.g. /e/[slug]/register/success). */
  successUrl: string;
  cancelUrl: string;
  /** Idempotency key — provider sẽ trả cùng session nếu trùng. */
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutResult {
  provider: PaymentProviderName;
  /** Provider session/checkout id — gắn vào Order.ProviderSessionId qua AttachProviderSession. */
  sessionId: string;
  /** URL user được redirect tới (Stripe Checkout / VNPay gateway). */
  redirectUrl: string;
  expiresAt: string;
}

export interface WebhookEvent {
  provider: PaymentProviderName;
  /** Unique event id trên provider (evt_*, vnp_TxnRef). Idempotency key cho handler. */
  providerEventId: string;
  type: string; // "payment_intent.succeeded" | "ipn_paid" | "ipn_failed" | ...
  /** Order id của ta (đã được gắn qua AttachProviderSession). */
  orderId: string;
  organizationId: string;
  amountMinor?: number;
  currency?: string;
  /** Signature verified = true. Nếu false, controller reject 401. */
  signatureValid: boolean;
  rawPayload: string; // raw body bytes (string) để log/replay
  receivedAt: string;
}

export interface VerifyWebhookInput {
  rawBody: string;
  signatureHeader: string;
  /** Provider-specific metadata — Stripe cần `stripe-signature`, VNPay cần query string. */
  metadata?: Record<string, string>;
}

export interface PaymentProviderInterface {
  readonly name: PaymentProviderName;

  /** Bật cho tenant này? Check `org_settings.enabled_providers[]`. */
  isEnabledFor(organizationId: string): Promise<boolean>;

  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;

  /** Verify signature webhook. Trả null nếu signature không hợp lệ. */
  verifyWebhook(input: VerifyWebhookInput): WebhookEvent | null;

  /** Worker poll cho order pending > 10 phút — provider-specific status check. */
  checkStatus(providerSessionId: string): Promise<{
    status: "paid" | "pending" | "failed" | "expired";
    rawResponse?: unknown;
  }>;
}
