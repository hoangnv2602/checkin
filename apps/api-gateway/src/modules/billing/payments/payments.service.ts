/**
 * apps/api-gateway/src/modules/billing/payments/payments.service.ts
 *
 * I-302 — top-level PaymentsService. Public API cho controllers:
 *  - listEnabled(organizationId)
 *  - createCheckout(organizationId, body)
 *  - handleWebhook(provider, body, signature, metadata) — idem dispatcher
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProviderName, WebhookEvent } from "./payment-provider.interface";
import { StripeAdapter } from "./adapters/stripe.adapter";
import { VnpayAdapter } from "./adapters/vnpay.adapter";
import { WebhookRouter } from "./webhooks/webhook-router";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly stripe: StripeAdapter,
    private readonly vnpay: VnpayAdapter,
    private readonly router: WebhookRouter,
  ) {}

  async listEnabled(organizationId: string): Promise<PaymentProviderName[]> {
    const out: PaymentProviderName[] = [];
    if (await this.stripe.isEnabledFor(organizationId)) out.push("stripe");
    if (await this.vnpay.isEnabledFor(organizationId)) out.push("vnpay");
    return out;
  }

  async createCheckout(
    organizationId: string,
    body: {
      orderId: string;
      provider: PaymentProviderName;
      amountMinor: number;
      currency: string;
      buyerEmail: string;
      buyerName: string;
      description: string;
      successUrl: string;
      cancelUrl: string;
      idempotencyKey?: string;
    },
  ): Promise<CreateCheckoutResult> {
    const adapter = this.adapterFor(body.provider);
    if (!(await adapter.isEnabledFor(organizationId))) {
      throw new BadRequestException(`Provider ${body.provider} is not enabled for this tenant`);
    }
    const input: CreateCheckoutInput = {
      organizationId,
      orderId: body.orderId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      buyerEmail: body.buyerEmail,
      buyerName: body.buyerName,
      description: body.description,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
      idempotencyKey: body.idempotencyKey ?? `${organizationId}:${body.orderId}:${Date.now()}`,
    };
    return adapter.createCheckout(input);
  }

  async handleWebhook(args: {
    provider: PaymentProviderName;
    rawBody: string;
    signatureHeader: string;
    metadata?: Record<string, string>;
  }): Promise<{ handled: boolean; orderId?: string; type?: string; duplicate?: boolean }> {
    const event = this.adapterFor(args.provider).verifyWebhook({
      rawBody: args.rawBody,
      signatureHeader: args.signatureHeader,
      metadata: args.metadata,
    });
    if (!event) {
      this.logger.warn(`webhook signature invalid (${args.provider})`);
      return { handled: false };
    }
    return this.router.dispatch(event);
  }

  async markPaidIfNeeded(event: WebhookEvent): Promise<void> {
    if (event.type !== "payment_intent.succeeded" && event.type !== "ipn_paid") return;
    // Idempotency: MarkOrderPaid check ở .NET side (status transition).
    const res = await fetch(`${CORE_API_BASE}/v1/registration/orders/${event.orderId}/mark-paid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": event.organizationId,
      },
      body: JSON.stringify({
        organizationId: event.organizationId,
        providerSessionId: event.providerEventId,
      }),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`core-api mark-paid failed: ${res.status} ${await res.text()}`);
    }
  }

  private adapterFor(provider: PaymentProviderName) {
    if (provider === "stripe") return this.stripe;
    if (provider === "vnpay") return this.vnpay;
    throw new NotFoundException(`Unknown provider ${provider}`);
  }
}
