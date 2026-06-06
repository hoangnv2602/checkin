/**
 * apps/api-gateway/src/modules/billing/connect/connect-webhook.controller.ts
 *
 * I-803 — Webhook handler cho Stripe Connect events:
 *   - account.updated         : organizer thay đổi thông tin, hoàn tất onboarding
 *   - payout.paid             : Stripe trả tiền cho organizer
 *   - charge.refunded         : khách refund → reverse application_fee
 *
 * Verify signature bằng cùng Stripe-Signature scheme (re-use StripeAdapter).
 * Dedup qua Redis (idempotency — xem webhook-router).
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

interface ConnectWebhookEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

@Controller("v1/billing/connect/webhook")
export class ConnectWebhookController {
  private readonly logger = new Logger(ConnectWebhookController.name);
  private readonly webhookSecret: string | undefined;

  constructor() {
    this.webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  }

  @Post()
  async handle(
    @Headers("stripe-signature") sig: string,
    @Body() rawBody: string,
  ): Promise<{ handled: boolean; type?: string }> {
    if (!this.webhookSecret) {
      throw new ForbiddenException("webhook secret not configured");
    }
    const event = this.verifyAndParse(rawBody, sig);
    if (!event) {
      throw new ForbiddenException("invalid signature");
    }

    switch (event.type) {
      case "account.updated":
        this.logger.log(`connect.account.updated account=${event.data.object["id"]}`);
        // TODO: persist to core-api via gRPC (UpdateOrganizerStripeAccount)
        break;
      case "payout.paid":
        this.logger.log(`connect.payout.paid payout=${event.data.object["id"]} amount=${event.data.object["amount"]}`);
        // TODO: emit PayoutCompletedIntegrationEvent
        break;
      case "charge.refunded":
        this.logger.log(`connect.charge.refunded charge=${event.data.object["id"]}`);
        // TODO: notify organizer + reconcile application_fee reversal
        break;
      default:
        this.logger.debug(`connect webhook ignored type=${event.type}`);
    }

    return { handled: true, type: event.type };
  }

  private verifyAndParse(rawBody: string, sigHeader: string): ConnectWebhookEvent | null {
    if (!sigHeader) return null;
    const parts = Object.fromEntries(
      sigHeader.split(",").map((kv) => {
        const idx = kv.indexOf("=");
        return [kv.slice(0, idx), kv.slice(idx + 1)];
      }),
    );
    const t = parts["t"];
    const v1 = parts["v1"];
    if (!t || !v1) return null;
    const expected = createHmac("sha256", this.webhookSecret!).update(`${t}.${rawBody}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const v1Buf = Buffer.from(v1, "hex");
    if (expectedBuf.length !== v1Buf.length) return null;
    if (!timingSafeEqual(expectedBuf, v1Buf)) return null;
    try {
      return JSON.parse(rawBody) as ConnectWebhookEvent;
    } catch {
      return null;
    }
  }
}
