/**
 * apps/api-gateway/src/modules/billing/connect/connect.module.ts
 *
 * I-803 — Stripe Connect module. Wires StripeConnectService,
 * MarketplacePaymentService, RefundService, ConnectWebhookController.
 */
import { Module } from "@nestjs/common";
import { StripeConnectService } from "./stripe-connect.service";
import { MarketplacePaymentService } from "./marketplace-payment.service";
import { RefundService } from "./refund.service";
import { ConnectWebhookController } from "./connect-webhook.controller";

@Module({
  providers: [StripeConnectService, MarketplacePaymentService, RefundService],
  controllers: [ConnectWebhookController],
  exports: [StripeConnectService, MarketplacePaymentService, RefundService],
})
export class ConnectModule {}
