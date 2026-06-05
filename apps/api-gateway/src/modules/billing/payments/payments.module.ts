/**
 * apps/api-gateway/src/modules/billing/payments/payments.module.ts
 *
 * I-302 — payments module wires the two adapters + webhook router + worker.
 */
import { Module } from "@nestjs/common";
import { StripeAdapter } from "./adapters/stripe.adapter";
import { VnpayAdapter } from "./adapters/vnpay.adapter";
import { WebhookRouter } from "./webhooks/webhook-router";
import { PaymentProvidersController } from "./payment-providers.controller";
import { PaymentWebhookController } from "./payment-webhook.controller";
import { PaymentsService } from "./payments.service";
import { PendingOrderSweeper, PAYMENT_SWEEP_QUEUE } from "./jobs/pending-order-sweeper";
import { BullModule } from "@nestjs/bullmq";
import { RedisModule } from "../../_shared/redis/redis.module";

@Module({
  imports: [
    RedisModule,
    BullModule.registerQueue({ name: PAYMENT_SWEEP_QUEUE }),
  ],
  controllers: [PaymentProvidersController, PaymentWebhookController],
  providers: [StripeAdapter, VnpayAdapter, WebhookRouter, PaymentsService, PendingOrderSweeper],
  exports: [StripeAdapter, VnpayAdapter, WebhookRouter, PaymentsService],
})
export class PaymentsModule {}
