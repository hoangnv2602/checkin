/**
 * apps/api-gateway/src/modules/webhooks/webhook.service.spec.ts
 *
 * I-901 — Service unit tests với in-memory store + fake BullMQ Queue.
 * Cover:
 *   - subscription CRUD (happy path + plan quota enforcement)
 *   - input validation (url, events, description)
 *   - dispatchEvent (matching by event type + wildcard)
 *   - test event send (no queue)
 *   - replay delivery
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryWebhookStore } from "./webhook-subscription.store";
import { WebhookService, WEBHOOK_DELIVERY_QUEUE } from "./webhook.service";
import { MAX_DELIVERY_ATTEMPTS, WEBHOOK_PLAN_QUOTAS } from "./webhook.types";
import type { Queue } from "bullmq";

// Set encryption key for secrets roundtrip
process.env.JWT_SIGNING_KEY ??= "a".repeat(64);

class FakeQueue {
  readonly name = WEBHOOK_DELIVERY_QUEUE;
  readonly added: Array<{ name: string; data: unknown; opts: unknown }> = [];
  async add(name: string, data: unknown, opts: unknown): Promise<unknown> {
    this.added.push({ name, data, opts });
    return { id: `job_${this.added.length}` };
  }
  // Minimal surface that the service touches
  async getJob(): Promise<null> {
    return null;
  }
  async close(): Promise<void> {}
}

describe("WebhookService", () => {
  let store: InMemoryWebhookStore;
  let queue: FakeQueue;
  let service: WebhookService;

  beforeEach(() => {
    store = new InMemoryWebhookStore();
    queue = new FakeQueue();
    service = new WebhookService(store, queue as unknown as Queue);
  });

  describe("create", () => {
    it("creates a subscription with auto-generated secret and returns it once", async () => {
      const sub = await service.create(
        "tenant_1",
        { url: "https://example.com/wh", events: ["event.published"] },
        "pro",
      );
      expect(sub.tenantId).toBe("tenant_1");
      expect(sub.url).toBe("https://example.com/wh");
      expect(sub.encryptedSecret.length).toBeGreaterThan(0);

      const revealed = service.revealSecret(sub);
      expect(revealed).toMatch(/^[a-f0-9]{64}$/);
    });

    it("rejects invalid url (not http(s))", async () => {
      await expect(
        service.create("t1", { url: "javascript:alert(1)", events: ["event.published"] }, "pro"),
      ).rejects.toThrow(/http\(s\)/);
    });

    it("rejects empty events", async () => {
      await expect(
        service.create("t1", { url: "https://example.com/wh", events: [] }, "pro"),
      ).rejects.toThrow(/events cannot be empty/);
    });

    it("rejects events over quota for free plan", async () => {
      await expect(
        service.create(
          "t1",
          { url: "https://example.com/wh", events: ["event.published", "order.paid"] },
          "free",
        ),
      ).rejects.toThrow(/event types must be 1\.\./);
    });

    it("enforces subscription count quota for free plan", async () => {
      await service.create("t1", { url: "https://a.example.com/wh", events: ["event.published"] }, "free");
      await expect(
        service.create("t1", { url: "https://b.example.com/wh", events: ["event.published"] }, "free"),
      ).rejects.toThrow(/quota/);
    });
  });

  describe("update", () => {
    it("patches url/events/active", async () => {
      const sub = await service.create("t1", { url: "https://a.example.com/wh", events: ["event.published"] }, "pro");
      const updated = await service.update(
        sub.id,
        "t1",
        { url: "https://b.example.com/wh", active: false },
        "pro",
      );
      expect(updated.url).toBe("https://b.example.com/wh");
      expect(updated.active).toBe(false);
    });

    it("rejects update for wrong tenant", async () => {
      const sub = await service.create("t1", { url: "https://a.example.com/wh", events: ["event.published"] }, "pro");
      await expect(
        service.update(sub.id, "t2", { url: "https://b.example.com/wh" }, "pro"),
      ).rejects.toThrow(/not found/);
    });
  });

  describe("dispatchEvent", () => {
    it("matches subscriptions by event type and enqueues deliveries", async () => {
      await service.create("t1", { url: "https://a.example.com/wh", events: ["event.published"] }, "pro");
      await service.create("t1", { url: "https://b.example.com/wh", events: ["order.paid"] }, "pro");
      await service.create("t1", { url: "https://c.example.com/wh", events: ["*"] }, "pro");

      const r1 = await service.dispatchEvent("t1", "event.published", { foo: 1 });
      expect(r1.matchedSubscriptions).toBe(2); // a + c (wildcard)
      expect(r1.deliveryIds).toHaveLength(2);
      expect(queue.added).toHaveLength(2);

      const r2 = await service.dispatchEvent("t1", "order.paid", { foo: 2 });
      expect(r2.matchedSubscriptions).toBe(2); // b + c
    });

    it("skips inactive subscriptions", async () => {
      const sub = await service.create("t1", { url: "https://a.example.com/wh", events: ["event.published"] }, "pro");
      await service.update(sub.id, "t1", { active: false }, "pro");
      const r = await service.dispatchEvent("t1", "event.published", { foo: 1 });
      expect(r.matchedSubscriptions).toBe(0);
    });

    it("rejects unknown event types", async () => {
      await expect(
        service.dispatchEvent("t1", "bogus.event" as unknown as "event.published", {}),
      ).rejects.toThrow(/unknown event type/);
    });
  });

  describe("sendTestEvent", () => {
    it("posts to subscription URL and records delivery", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      try {
        const sub = await service.create("t1", { url: "https://example.com/wh", events: ["event.published"] }, "pro");
        const result = await service.sendTestEvent({ subscriptionId: sub.id, tenantId: "t1" });
        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://example.com/wh");
        const headers = init.headers as Record<string, string>;
        expect(headers["X-Signature-SHA256"]).toMatch(/^sha256=/);
        expect(headers["X-Webhook-Event"]).toBe("event.published");
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it("records failure on 5xx", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("server error", { status: 500 }),
      );
      try {
        const sub = await service.create("t1", { url: "https://example.com/wh", events: ["event.published"] }, "pro");
        const result = await service.sendTestEvent({ subscriptionId: sub.id, tenantId: "t1" });
        expect(result.success).toBe(false);
        expect(result.status).toBe(500);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe("replay", () => {
    it("re-enqueues a delivery", async () => {
      const sub = await service.create("t1", { url: "https://example.com/wh", events: ["event.published"] }, "pro");
      const dispatch = await service.dispatchEvent("t1", "event.published", { x: 1 });
      const beforeReplay = queue.added.length;
      const replayed = await service.replay(dispatch.deliveryIds[0], "t1");
      expect(replayed).not.toBeNull();
      expect(queue.added.length).toBe(beforeReplay + 1);
      // The replayed job attempts reset to 0
      expect(replayed?.attempts).toBe(0);
      expect(replayed?.status).toBe("pending");
    });

    it("rejects replay for wrong tenant", async () => {
      const sub = await service.create("t1", { url: "https://example.com/wh", events: ["event.published"] }, "pro");
      const dispatch = await service.dispatchEvent("t1", "event.published", { x: 1 });
      const replayed = await service.replay(dispatch.deliveryIds[0], "t2");
      expect(replayed).toBeNull();
    });
  });

  describe("plan quota matrix", () => {
    it("enterprise gets 100 subscription cap", () => {
      expect(WEBHOOK_PLAN_QUOTAS.enterprise.maxSubscriptions).toBe(100);
    });
    it("free gets 1 subscription cap", () => {
      expect(WEBHOOK_PLAN_QUOTAS.free.maxSubscriptions).toBe(1);
    });
  });

  describe("max delivery attempts", () => {
    it("is 5 (so DLQ activates after 5 retries)", () => {
      expect(MAX_DELIVERY_ATTEMPTS).toBe(5);
    });
  });
});
