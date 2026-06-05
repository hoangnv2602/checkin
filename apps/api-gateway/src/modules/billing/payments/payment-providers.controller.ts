/**
 * apps/api-gateway/src/modules/billing/payments/payment-providers.controller.ts
 *
 * I-302 — Public REST endpoints cho attendee flow (Phase 3):
 *   GET  /v1/payments/providers?organizationId=...      → list enabled
 *   POST /v1/payments/checkout                          → create Stripe/VNPay session
 */
import { BadRequestException, Body, Controller, Get, Headers, NotFoundException, Param, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";
import type { PaymentProviderName } from "./payment-provider.interface";

@Controller("v1/payments")
export class PaymentProvidersController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("providers")
  async listProviders(@Query("organizationId") organizationId: string) {
    if (!organizationId) throw new BadRequestException("organizationId required");
    return { providers: await this.payments.listEnabled(organizationId) };
  }

  @Post("checkout")
  async createCheckout(
    @Body()
    body: {
      organizationId: string;
      orderId: string;
      provider: PaymentProviderName;
      amountMinor: number;
      currency: string;
      buyerEmail: string;
      buyerName: string;
      description: string;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    if (!body.organizationId) throw new BadRequestException("organizationId required");
    if (!body.provider || !["stripe", "vnpay"].includes(body.provider)) {
      throw new BadRequestException("provider must be 'stripe' or 'vnpay'");
    }
    if (body.amountMinor <= 0) throw new BadRequestException("amountMinor must be > 0");
    return this.payments.createCheckout(body.organizationId, body);
  }
}
