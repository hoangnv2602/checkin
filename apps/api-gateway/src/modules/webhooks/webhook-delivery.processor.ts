/**
 * apps/api-gateway/src/modules/webhooks/webhook-delivery.processor.ts
 *
 * I-901 — Worker xử lý mỗi webhook delivery job.
 *
 * Luồng:
 *  1. Nhận job { deliveryId, subscriptionId }.
 *  2. Đọc WebhookDelivery + WebhookSubscription từ store.
 *  3. Decrypt secret, ký HMAC, POST tới URL.
 *  4. Cập nhật status (delivered | failed). Throw để BullMQ retry.
 *
 * Retry policy (set ở enqueue):
 *   - attempts: 5
 *   - backoff: exponential 5s → 25s → 125s → 625s → 3125s
 *   - max 5 attempts
 *
 * Thành công: 2xx → done. 4xx (non-429) → fail ngay (don't retry client error).
 * 5xx + 429 + network error → throw để retry.
 */
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { decryptSecret } from "../_shared/crypto/secrets";
import { signPayload } from "./webhook-signer";
import { InMemoryWebhookStore, type IWebhookStore } from "./webhook-subscription.store";
import { WEBHOOK_DELIVERY_QUEUE, WebhookService } from "./webhook.service";

export interface DeliveryJobData {
  deliveryId: string;
  subscriptionId: string;
}

const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 410, 422]);

@Processor(WEBHOOK_DELIVERY_QUEUE, { concurrency: 8 })
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    private readonly store: IWebhookStore,
    private readonly service: WebhookService,
  ) {
    super();
  }

  async process(job: Job<DeliveryJobData>): Promise<{ status: number; deliveryId: string }> {
    const { deliveryId } = job.data;
    const delivery = await this.store.getDelivery(deliveryId);
    if (!delivery) {
      this.logger.warn(`delivery not found ${deliveryId}`);
      return { status: 0, deliveryId };
    }
    const sub = await this.store.get(delivery.subscriptionId);
    if (!sub) {
      this.logger.warn(`subscription gone ${delivery.subscriptionId}`);
      await this.store.updateDelivery(deliveryId, {
        status: "failed",
        lastError: "subscription deleted",
      });
      return { status: 0, deliveryId };
    }
    if (!sub.active) {
      this.logger.warn(`subscription inactive ${sub.id}`);
      await this.store.updateDelivery(deliveryId, {
        status: "failed",
        lastError: "subscription inactive",
      });
      return { status: 0, deliveryId };
    }

    const secret = decryptSecret(sub.encryptedSecret);
    const body = JSON.stringify({
      id: deliveryId,
      type: delivery.eventType,
      created_at: delivery.createdAt,
      data: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signPayload({ secret, timestamp, body });
    const attempt = job.attemptsMade + 1;

    await this.store.updateDelivery(deliveryId, {
      status: "in_flight",
      attempts: attempt,
      lastAttemptAt: new Date().toISOString(),
    });

    let response: Response;
    try {
      response = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Signature-SHA256": signature,
          "X-Webhook-Timestamp": String(timestamp),
          "X-Webhook-Id": deliveryId,
          "X-Webhook-Event": delivery.eventType,
          "User-Agent": "SaasCheckin-Webhooks/1.0",
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const message = (err as Error).message;
      await this.store.updateDelivery(deliveryId, { lastError: `network: ${message}` });
      this.logger.warn(`delivery ${deliveryId} attempt ${attempt} network error: ${message}`);
      throw err; // retry
    }

    const status = response.status;
    if (status >= 200 && status < 300) {
      await this.store.updateDelivery(deliveryId, {
        status: "delivered",
        deliveredAt: new Date().toISOString(),
        lastError: undefined,
      });
      this.logger.log(`delivery ${deliveryId} delivered HTTP ${status} attempt ${attempt}`);
      return { status, deliveryId };
    }

    // Non-retryable: client error → don't keep retrying
    if (NON_RETRYABLE_STATUS.has(status)) {
      const snippet = await response.text().catch(() => "");
      await this.store.updateDelivery(deliveryId, {
        status: "failed",
        lastError: `HTTP ${status}: ${snippet.slice(0, 200)}`,
      });
      this.logger.warn(`delivery ${deliveryId} permanent fail HTTP ${status}`);
      // Return normally — don't throw so BullMQ marks complete (no retry).
      return { status, deliveryId };
    }

    // Retryable: 5xx, 408, 429, etc.
    const snippet = await response.text().catch(() => "");
    await this.store.updateDelivery(deliveryId, { lastError: `HTTP ${status}: ${snippet.slice(0, 200)}` });
    this.logger.warn(`delivery ${deliveryId} attempt ${attempt} HTTP ${status} (will retry)`);
    throw new Error(`webhook HTTP ${status}`);
  }
}

// Re-export the type guard for tests
export const _isInMemory = (s: IWebhookStore): s is InMemoryWebhookStore => s instanceof InMemoryWebhookStore;
