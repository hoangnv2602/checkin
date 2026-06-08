/**
 * apps/api-gateway/src/modules/webhooks/webhook.service.ts
 *
 * I-901 — Webhook service: CRUD subscriptions + dispatch events.
 *
 * Dispatch flow:
 *  1. Service nhận event (eventType + payload) qua `dispatchEvent()`.
 *  2. Lấy tất cả active subscriptions của tenant match eventType.
 *  3. Với mỗi subscription → tạo WebhookDelivery row + enqueue BullMQ job
 *     `WEBHOOK_DELIVERY_QUEUE`. Worker sẽ thực hiện HTTP POST + retry.
 *  4. Trả về danh sách delivery IDs cho caller log/audit.
 *
 * Plan gate: `WEBHOOK_PLAN_QUOTAS` enforce ở `createSubscription` —
 * controller pass plan xuống service.
 */
import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "../_shared/crypto/secrets";
import { DEFAULT_JOB_OPTIONS, queueOptions } from "../_shared/queue/queue-defaults";
import { InMemoryWebhookStore } from "./webhook-subscription.store";
import { signPayload } from "./webhook-signer";
import {
  ALL_WEBHOOK_EVENT_TYPES,
  MAX_DELIVERY_ATTEMPTS,
  WEBHOOK_DESCRIPTION_MAX_LENGTH,
  WEBHOOK_PLAN_QUOTAS,
  WEBHOOK_URL_MAX_LENGTH,
  WEBHOOK_URL_PATTERN,
  type WebhookDelivery,
  type WebhookEventType,
  type WebhookSubscription,
  type WebhookSubscriptionCreateInput,
} from "./webhook.types";

export const WEBHOOK_DELIVERY_QUEUE = "webhook_delivery";

export interface DispatchResult {
  matchedSubscriptions: number;
  deliveryIds: string[];
}

export interface TestEventInput {
  subscriptionId: string;
  tenantId: string;
  /** Optional override event type for the test (default: event.published). */
  eventType?: WebhookEventType;
  /** Optional custom payload. */
  payload?: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    // Inject the concrete InMemoryWebhookStore class (not the IWebhookStore
    // interface) so Nest's runtime DI can resolve the token via
    // reflect-metadata. Interfaces are erased at compile time; declaring the
    // param as the interface would surface as `Object` to the injector and
    // fail with UnknownDependenciesException. The interface stays in
    // webhook-subscription.store.ts for documentation and test-mock purposes.
    private readonly store: InMemoryWebhookStore,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE) private readonly deliveryQueue: Queue,
  ) {}

  // ─── Subscription CRUD ───────────────────────────────────────────

  async list(tenantId: string): Promise<WebhookSubscription[]> {
    return this.store.listByTenant(tenantId);
  }

  async create(
    tenantId: string,
    input: WebhookSubscriptionCreateInput,
    plan: string,
  ): Promise<WebhookSubscription> {
    this.validateInput(input);

    const quota = WEBHOOK_PLAN_QUOTAS[plan] ?? WEBHOOK_PLAN_QUOTAS.free;
    const existing = await this.store.listByTenant(tenantId);
    if (existing.length >= quota.maxSubscriptions) {
      throw new BadRequestException(
        `plan ${plan} reached webhook subscription quota (${quota.maxSubscriptions})`,
      );
    }

    if (input.events.length === 0 || input.events.length > quota.maxEventTypes) {
      throw new BadRequestException(
        `plan ${plan} event types must be 1..${quota.maxEventTypes}`,
      );
    }
    // Disallow "*" wildcard for free
    if (!quota.allowAll && input.events.includes("*")) {
      throw new BadRequestException(`plan ${plan} cannot subscribe to wildcard "*"`);
    }

    const secret = input.secret ?? randomBytes(32).toString("hex");
    const encrypted = encryptSecret(secret);
    const sub = await this.store.create(tenantId, input, encrypted);
    return sub;
  }

  async update(
    subscriptionId: string,
    tenantId: string,
    patch: Partial<Pick<WebhookSubscription, "url" | "events" | "active" | "description">>,
    plan: string,
  ): Promise<WebhookSubscription> {
    if (patch.url !== undefined) {
      this.assertValidUrl(patch.url);
    }
    if (patch.description !== undefined && patch.description.length > WEBHOOK_DESCRIPTION_MAX_LENGTH) {
      throw new BadRequestException(`description max ${WEBHOOK_DESCRIPTION_MAX_LENGTH} chars`);
    }
    if (patch.events !== undefined) {
      if (patch.events.length === 0) {
        throw new BadRequestException("events cannot be empty");
      }
      const quota = WEBHOOK_PLAN_QUOTAS[plan] ?? WEBHOOK_PLAN_QUOTAS.free;
      if (patch.events.length > quota.maxEventTypes) {
        throw new BadRequestException(
          `plan ${plan} event types must be 1..${quota.maxEventTypes}`,
        );
      }
      if (!quota.allowAll && patch.events.includes("*")) {
        throw new BadRequestException(`plan ${plan} cannot subscribe to wildcard "*"`);
      }
    }

    const updated = await this.store.update(subscriptionId, tenantId, patch);
    if (!updated) throw new NotFoundException("subscription not found");
    return updated;
  }

  async remove(subscriptionId: string, tenantId: string): Promise<void> {
    const ok = await this.store.delete(subscriptionId, tenantId);
    if (!ok) throw new NotFoundException("subscription not found");
  }

  /**
   * Trả HMAC secret (plaintext) 1 lần duy nhất khi create — controller dùng để
   * hiển thị cho tenant copy. Sau đó secret chỉ tồn tại encrypted ở DB.
   */
  revealSecret(subscription: WebhookSubscription): string {
    return decryptSecret(subscription.encryptedSecret);
  }

  // ─── Dispatch ─────────────────────────────────────────────────────

  async dispatchEvent(
    tenantId: string,
    eventType: WebhookEventType,
    payload: Record<string, unknown>,
  ): Promise<DispatchResult> {
    if (!ALL_WEBHOOK_EVENT_TYPES.includes(eventType)) {
      throw new BadRequestException(`unknown event type: ${eventType}`);
    }
    const subs = await this.store.listByTenant(tenantId);
    const matched = subs.filter((s) => s.active && (s.events.includes("*") || s.events.includes(eventType)));
    if (matched.length === 0) {
      return { matchedSubscriptions: 0, deliveryIds: [] };
    }

    const deliveryIds: string[] = [];
    for (const sub of matched) {
      const deliveryId = this.makeDeliveryId();
      const delivery: WebhookDelivery = {
        id: deliveryId,
        subscriptionId: sub.id,
        tenantId,
        eventType,
        url: sub.url,
        payload,
        status: "pending",
        attempts: 0,
        createdAt: new Date().toISOString(),
      };
      await this.store.recordDelivery(delivery);
      await this.deliveryQueue.add(
        "deliver",
        { deliveryId, subscriptionId: sub.id },
        {
          ...DEFAULT_JOB_OPTIONS,
          attempts: MAX_DELIVERY_ATTEMPTS,
          backoff: { type: "exponential", delay: 5_000 },
        },
      );
      deliveryIds.push(deliveryId);
    }
    this.logger.log(
      `dispatched ${eventType} tenant=${tenantId} matched=${matched.length} deliveries=${deliveryIds.length}`,
    );
    return { matchedSubscriptions: matched.length, deliveryIds };
  }

  /**
   * Test event — sync path dùng cho UI "Send test event" button. Bypass queue,
   * trả kết quả HTTP response trực tiếp. Không retry.
   */
  async sendTestEvent(input: TestEventInput): Promise<{
    deliveryId: string;
    url: string;
    status: number;
    success: boolean;
    body?: string;
  }> {
    const sub = await this.store.get(input.subscriptionId);
    if (!sub || sub.tenantId !== input.tenantId) {
      throw new NotFoundException("subscription not found");
    }
    const secret = decryptSecret(sub.encryptedSecret);
    const eventType = input.eventType ?? "event.published";
    const payload = input.payload ?? { hello: "world", ts: new Date().toISOString() };
    const body = JSON.stringify({ id: `evt_test_${Date.now()}`, type: eventType, data: payload });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload({ secret, timestamp, body });

    const deliveryId = this.makeDeliveryId();
    const delivery: WebhookDelivery = {
      id: deliveryId,
      subscriptionId: sub.id,
      tenantId: input.tenantId,
      eventType,
      url: sub.url,
      payload,
      status: "in_flight",
      attempts: 1,
      createdAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
    };
    await this.store.recordDelivery(delivery);

    try {
      const res = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature-SHA256": signature,
          "X-Webhook-Timestamp": String(timestamp),
          "X-Webhook-Id": deliveryId,
          "X-Webhook-Event": eventType,
          "User-Agent": "SaasCheckin-Webhooks/1.0",
        },
        body,
        // 5s timeout via AbortSignal
        signal: AbortSignal.timeout(5_000),
      });
      const responseBody = await res.text().catch(() => "");
      const success = res.status >= 200 && res.status < 300;
      await this.store.updateDelivery(deliveryId, {
        status: success ? "delivered" : "failed",
        deliveredAt: success ? new Date().toISOString() : undefined,
        lastError: success ? undefined : `HTTP ${res.status}: ${responseBody.slice(0, 200)}`,
      });
      return { deliveryId, url: sub.url, status: res.status, success, body: responseBody };
    } catch (err) {
      const message = (err as Error).message;
      await this.store.updateDelivery(deliveryId, {
        status: "failed",
        lastError: message,
      });
      return { deliveryId, url: sub.url, status: 0, success: false, body: message };
    }
  }

  async listDeliveries(tenantId: string, limit: number): Promise<WebhookDelivery[]> {
    return this.store.listDeliveries(tenantId, Math.min(Math.max(limit, 1), 200));
  }

  async replay(deliveryId: string, tenantId: string): Promise<WebhookDelivery | null> {
    const d = await this.store.getDelivery(deliveryId);
    if (!d || d.tenantId !== tenantId) return null;
    // Re-enqueue (cộng dồn attempts ở worker, mình reset về 0 ở đây)
    await this.store.updateDelivery(deliveryId, {
      status: "pending",
      attempts: 0,
      lastError: undefined,
      deliveredAt: undefined,
    });
    await this.deliveryQueue.add(
      "deliver",
      { deliveryId, subscriptionId: d.subscriptionId },
      { ...DEFAULT_JOB_OPTIONS, attempts: MAX_DELIVERY_ATTEMPTS, backoff: { type: "exponential", delay: 5_000 } },
    );
    this.logger.log(`replay delivery ${deliveryId} tenant=${tenantId}`);
    return this.store.getDelivery(deliveryId);
  }

  // ─── helpers ──────────────────────────────────────────────────────

  private validateInput(input: WebhookSubscriptionCreateInput): void {
    this.assertValidUrl(input.url);
    if (input.description !== undefined && input.description.length > WEBHOOK_DESCRIPTION_MAX_LENGTH) {
      throw new BadRequestException(`description max ${WEBHOOK_DESCRIPTION_MAX_LENGTH} chars`);
    }
    if (input.events.length === 0) {
      throw new BadRequestException("events cannot be empty");
    }
    for (const ev of input.events) {
      if (!ALL_WEBHOOK_EVENT_TYPES.includes(ev)) {
        throw new BadRequestException(`unknown event type: ${ev}`);
      }
    }
  }

  private assertValidUrl(url: string): void {
    if (!url || url.length > WEBHOOK_URL_MAX_LENGTH) {
      throw new BadRequestException(`url must be 1..${WEBHOOK_URL_MAX_LENGTH} chars`);
    }
    if (!WEBHOOK_URL_PATTERN.test(url)) {
      throw new BadRequestException("url must be http(s)");
    }
  }

  private makeDeliveryId(): string {
    // Use store's generator if available (in-memory has counter).
    if (this.store instanceof InMemoryWebhookStore) {
      return this.store.generateDeliveryId();
    }
    return `wh_dlv_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  }
}

export function webhookQueueOptions() {
  return queueOptions(WEBHOOK_DELIVERY_QUEUE);
}
