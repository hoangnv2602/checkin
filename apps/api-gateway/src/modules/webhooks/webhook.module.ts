/**
 * apps/api-gateway/src/modules/webhooks/webhook.module.ts
 *
 * I-901 — Module composition: WebhookController + WebhookService +
 * InMemoryWebhookStore + WebhookDeliveryProcessor.
 *
 * Queue: `webhook_delivery` registered với default options (3 retries, exp backoff)
 * — worker overrides thành 5 attempts ở enqueue.
 */
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DEFAULT_JOB_OPTIONS, queueOptions } from "../_shared/queue/queue-defaults";
import { WebhookController } from "./webhook.controller";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { InMemoryWebhookStore } from "./webhook-subscription.store";
import { WEBHOOK_DELIVERY_QUEUE, WebhookService } from "./webhook.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEBHOOK_DELIVERY_QUEUE,
      ...queueOptions(WEBHOOK_DELIVERY_QUEUE),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
      },
    }),
  ],
  controllers: [WebhookController],
  providers: [InMemoryWebhookStore, WebhookService, WebhookDeliveryProcessor, JwtAuthGuard],
  exports: [WebhookService, InMemoryWebhookStore],
})
export class WebhookModule {}
