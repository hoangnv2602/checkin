/**
 * apps/api-gateway/src/modules/billing/payments/webhooks/webhook-router.ts
 *
 * I-302 — WebhookRouter nhận WebhookEvent đã verify chữ ký, dispatch:
 *  1. Dedup: kiểm tra Redis SET `webhook:processed:{providerEventId}` (TTL 7d).
 *  2. Mark order paid qua .NET core-api (PaymentsService.markPaidIfNeeded).
 *  3. Set processed flag — duplicate lần 2 chỉ trả 200 OK no-op.
 *
 * Return shape giúp controller map:
 *  - duplicate=true → trả 200 (idempotent retry)
 *  - handled=true → trả 200 + log
 *  - handled=false → trả 401/400 cho caller
 */
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import type { WebhookEvent } from "../payment-provider.interface";
import type Redis from "ioredis";
import { REDIS } from "../../../_shared/redis/redis.module";
import { PaymentsService } from "../payments.service";

const DEDUP_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class WebhookRouter {
  private readonly logger = new Logger(WebhookRouter.name);

  constructor(
    private readonly payments: PaymentsService,
    @Optional() @Inject(REDIS) private readonly redis?: Redis,
  ) {}

  async dispatch(event: WebhookEvent): Promise<{ handled: boolean; orderId?: string; type?: string; duplicate?: boolean }> {
    if (!event.signatureValid) {
      return { handled: false };
    }

    const key = `webhook:processed:${event.provider}:${event.providerEventId}`;
    if (this.redis) {
      const set = await this.redis.set(key, "1", "EX", DEDUP_TTL_SECONDS, "NX");
      if (set !== "OK") {
        this.logger.log(`webhook duplicate ${event.provider}/${event.providerEventId}`);
        return { handled: true, orderId: event.orderId, type: event.type, duplicate: true };
      }
    }

    try {
      await this.payments.markPaidIfNeeded(event);
      this.logger.log(`webhook handled ${event.provider}/${event.type} order=${event.orderId}`);
      return { handled: true, orderId: event.orderId, type: event.type };
    } catch (err) {
      // Rollback dedup flag để retry từ provider có thể xử lý lại
      if (this.redis) await this.redis.del(key);
      throw err;
    }
  }
}
