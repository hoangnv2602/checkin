/**
 * apps/api-gateway/src/modules/billing/subscription/subscription.module.ts
 *
 * I-501 — Wires the Stripe subscription webhook controller (separate from
 * order payment webhook) + BFF-side subscription REST endpoints.
 */
import { Module } from "@nestjs/common";
import { RedisModule } from "../../_shared/redis/redis.module";
import { SubscriptionWebhookController } from "./subscription-webhook.controller";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionService } from "./subscription.service";

@Module({
  imports: [RedisModule],
  controllers: [SubscriptionWebhookController, SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
