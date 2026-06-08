/**
 * apps/api-gateway/test/webhooks/webhook.di.e2e-spec.ts
 *
 * I-901 — Regression test for the WebhookService + WebhookDeliveryProcessor
 * DI error.
 *
 * Root cause: both classes declared `private readonly store: IWebhookStore`
 * and imported the interface as a `type` binding. Interfaces are erased at
 * compile time, so reflect-metadata's `design:paramtypes[0]` resolved to
 * `Object` at runtime. Fix: inject the concrete `InMemoryWebhookStore`
 * class (the only impl). This test wires up the affected providers in a
 * minimal TestingModule; if the interface is reintroduced as the param
 * type, the test fails with UnknownDependenciesException.
 *
 * We don't boot the full `WebhookModule` here because it transitively pulls
 * in AuthModule → TrialModule → NotificationModule → QueueModule (BullMQ
 * wiring, REDIS, etc.). That's a separate concern; this test focuses on the
 * Rule-4 DI fix for the store field on the two classes that touch it.
 */
import { describe, it, expect } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { Queue } from "bullmq";
import { InMemoryWebhookStore } from "../../src/modules/webhooks/webhook-subscription.store";
import { WEBHOOK_DELIVERY_QUEUE, WebhookService } from "../../src/modules/webhooks/webhook.service";
import { WebhookDeliveryProcessor } from "../../src/modules/webhooks/webhook-delivery.processor";

describe("Webhook store DI (Rule 4 fix)", () => {
  it("resolves WebhookService + WebhookDeliveryProcessor + InMemoryWebhookStore via constructor injection", async () => {
    const fakeQueue = { name: WEBHOOK_DELIVERY_QUEUE } as unknown as Queue;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        InMemoryWebhookStore,
        WebhookService,
        // WebhookDeliveryProcessor extends WorkerHost (BullMQ). The DI fix
        // under test is the `store: IWebhookStore → InMemoryWebhookStore`
        // change on its constructor — not the BullMQ worker registration.
        // We override the queue token so the constructor resolves without
        // booting a real BullMQ worker.
        WebhookDeliveryProcessor,
        { provide: `BullQueue_${WEBHOOK_DELIVERY_QUEUE}`, useValue: fakeQueue },
      ],
    }).compile();

    const service = moduleRef.get(WebhookService);
    const processor = moduleRef.get(WebhookDeliveryProcessor);
    const store = moduleRef.get(InMemoryWebhookStore);

    expect(service).toBeInstanceOf(WebhookService);
    expect(processor).toBeInstanceOf(WebhookDeliveryProcessor);
    expect(store).toBeInstanceOf(InMemoryWebhookStore);
  });
});
