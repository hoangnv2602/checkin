/**
 * apps/api-gateway/src/modules/webhooks/webhook-subscription.store.ts
 *
 * I-901 — In-memory store cho webhook subscriptions + delivery log.
 *
 * Phase 9 dùng in-memory (Map) vì:
 *   - 1k subscriptions đầu vừa đủ test
 *   - Phase 10+ swap sang Postgres table `webhook_subscriptions`,
 *     `webhook_deliveries` qua repository pattern (interface `IWebhookStore`).
 *
 * Interface thiết kế rõ để Phase 10+ thay implementation không đổi tên function
 * ở service layer.
 */
import { Injectable, Logger } from "@nestjs/common";
import type {
  WebhookDelivery,
  WebhookEventType,
  WebhookSubscription,
  WebhookSubscriptionCreateInput,
} from "./webhook.types";

export interface IWebhookStore {
  listByTenant(tenantId: string): Promise<WebhookSubscription[]>;
  get(subscriptionId: string): Promise<WebhookSubscription | null>;
  create(tenantId: string, input: WebhookSubscriptionCreateInput, encryptedSecret: string): Promise<WebhookSubscription>;
  update(
    subscriptionId: string,
    tenantId: string,
    patch: Partial<Pick<WebhookSubscription, "url" | "events" | "active" | "description">>,
  ): Promise<WebhookSubscription | null>;
  delete(subscriptionId: string, tenantId: string): Promise<boolean>;

  // Delivery log (audit + debug)
  recordDelivery(delivery: WebhookDelivery): Promise<void>;
  updateDelivery(deliveryId: string, patch: Partial<WebhookDelivery>): Promise<WebhookDelivery | null>;
  listDeliveries(tenantId: string, limit: number): Promise<WebhookDelivery[]>;
  getDelivery(deliveryId: string): Promise<WebhookDelivery | null>;
}

@Injectable()
export class InMemoryWebhookStore implements IWebhookStore {
  private readonly logger = new Logger(InMemoryWebhookStore.name);
  private readonly subscriptions = new Map<string, WebhookSubscription>();
  private readonly deliveries = new Map<string, WebhookDelivery>();
  private idCounter = 0;
  private deliveryIdCounter = 0;

  private nextSubId(): string {
    this.idCounter += 1;
    return `wh_sub_${Date.now().toString(36)}_${this.idCounter.toString(36)}`;
  }

  private nextDeliveryId(): string {
    this.deliveryIdCounter += 1;
    return `wh_dlv_${Date.now().toString(36)}_${this.deliveryIdCounter.toString(36)}`;
  }

  async listByTenant(tenantId: string): Promise<WebhookSubscription[]> {
    return [...this.subscriptions.values()].filter((s) => s.tenantId === tenantId);
  }

  async get(subscriptionId: string): Promise<WebhookSubscription | null> {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  async create(
    tenantId: string,
    input: WebhookSubscriptionCreateInput,
    encryptedSecret: string,
  ): Promise<WebhookSubscription> {
    const now = new Date().toISOString();
    const sub: WebhookSubscription = {
      id: this.nextSubId(),
      tenantId,
      url: input.url,
      encryptedSecret,
      events: input.events,
      active: true,
      createdAt: now,
      updatedAt: now,
      description: input.description,
    };
    this.subscriptions.set(sub.id, sub);
    this.logger.log(`subscription created ${sub.id} tenant=${tenantId} events=${input.events.length}`);
    return sub;
  }

  async update(
    subscriptionId: string,
    tenantId: string,
    patch: Partial<Pick<WebhookSubscription, "url" | "events" | "active" | "description">>,
  ): Promise<WebhookSubscription | null> {
    const existing = this.subscriptions.get(subscriptionId);
    if (!existing || existing.tenantId !== tenantId) return null;
    const updated: WebhookSubscription = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  async delete(subscriptionId: string, tenantId: string): Promise<boolean> {
    const existing = this.subscriptions.get(subscriptionId);
    if (!existing || existing.tenantId !== tenantId) return false;
    this.subscriptions.delete(subscriptionId);
    this.logger.log(`subscription deleted ${subscriptionId} tenant=${tenantId}`);
    return true;
  }

  async recordDelivery(delivery: WebhookDelivery): Promise<void> {
    this.deliveries.set(delivery.id, delivery);
  }

  async updateDelivery(deliveryId: string, patch: Partial<WebhookDelivery>): Promise<WebhookDelivery | null> {
    const existing = this.deliveries.get(deliveryId);
    if (!existing) return null;
    const updated: WebhookDelivery = { ...existing, ...patch };
    this.deliveries.set(deliveryId, updated);
    return updated;
  }

  async listDeliveries(tenantId: string, limit: number): Promise<WebhookDelivery[]> {
    return [...this.deliveries.values()]
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  async getDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return this.deliveries.get(deliveryId) ?? null;
  }

  /** Helper cho service layer: generate delivery ID. */
  generateDeliveryId(): string {
    return this.nextDeliveryId();
  }
}
