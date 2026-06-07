/**
 * apps/api-gateway/src/modules/webhooks/webhook.types.ts
 *
 * I-901 — Tenant outbound webhook contracts.
 *
 * Subscription: tenant đăng ký URL + danh sách event types cần nhận.
 * Secret: dùng để HMAC-SHA256 payload (header `X-Signature-SHA256`).
 * Storage: encrypted trong DB bằng `encryptSecret` (I-802 AES-256-GCM helper).
 *
 * Plan gate (enforced ở controller):
 *   - free:   1 subscription, event types = ["*"]  → chỉ để test
 *   - pro:    5 subscriptions, 10 event types
 *   - ent:    unlimited
 */
export type WebhookEventType =
  | "event.published"
  | "event.updated"
  | "event.cancelled"
  | "order.created"
  | "order.paid"
  | "order.refunded"
  | "registration.created"
  | "registration.checked_in"
  | "registration.no_show"
  | "*";

export const ALL_WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = [
  "event.published",
  "event.updated",
  "event.cancelled",
  "order.created",
  "order.paid",
  "order.refunded",
  "registration.created",
  "registration.checked_in",
  "registration.no_show",
  "*",
];

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  url: string;
  /** AES-256-GCM ciphertext của HMAC secret. */
  encryptedSecret: string;
  events: WebhookEventType[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface WebhookSubscriptionCreateInput {
  url: string;
  events: WebhookEventType[];
  description?: string;
  /** Optional override — service generate nếu null. */
  secret?: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  tenantId: string;
  eventType: WebhookEventType;
  url: string;
  payload: Record<string, unknown>;
  /** 0 = pending, 1 = in-flight, 2 = delivered, 3 = failed (max attempts reached). */
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt?: string;
  deliveredAt?: string;
  lastError?: string;
  createdAt: string;
}

export type DeliveryStatus = "pending" | "in_flight" | "delivered" | "failed";

export const MAX_DELIVERY_ATTEMPTS = 5;

/** Quota per plan. */
export const WEBHOOK_PLAN_QUOTAS: Record<string, { maxSubscriptions: number; maxEventTypes: number; allowAll: boolean }> = {
  free:       { maxSubscriptions: 1, maxEventTypes: 1, allowAll: true },
  pro:        { maxSubscriptions: 5, maxEventTypes: 10, allowAll: true },
  enterprise: { maxSubscriptions: 100, maxEventTypes: 50, allowAll: true },
  internal:   { maxSubscriptions: 1000, maxEventTypes: 50, allowAll: true },
};

/** Validation rules. */
export const WEBHOOK_URL_MAX_LENGTH = 2048;
export const WEBHOOK_DESCRIPTION_MAX_LENGTH = 256;
/** Allow http(s) only — block javascript:, file:, etc. */
export const WEBHOOK_URL_PATTERN = /^https?:\/\/.+/i;
