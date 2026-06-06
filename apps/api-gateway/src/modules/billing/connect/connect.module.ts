/**
 * apps/api-gateway/src/modules/billing/connect/connect.module.ts
 *
 * I-803 — Stripe Connect module. Wires StripeConnectService,
 * MarketplacePaymentService, ConnectWebhookController.
 */
import { Module } from "@nestjs/common";
import { StripeConnectService } from "./stripe-connect.service";
import { MarketplacePaymentService } from "./marketplace-payment.service";
import { ConnectWebhookController } from "./connect-webhook.controller";

@Module({
  providers: [StripeConnectService, MarketplacePaymentService],
  controllers: [ConnectWebhookController],
  exports: [StripeConnectService, MarketplacePaymentService],
})
export class ConnectModule {}
