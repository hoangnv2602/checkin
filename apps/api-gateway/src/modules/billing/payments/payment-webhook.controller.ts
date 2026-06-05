/**
 * apps/api-gateway/src/modules/billing/payments/payment-webhook.controller.ts
 *
 * I-302 — Webhook endpoints (Stripe + VNPay IPN). Public, no JWT.
 *  - /v1/payments/webhook/stripe   — raw body + Stripe-Signature header
 *  - /v1/payments/webhook/vnpay    — form-encoded body, vnp_SecureHash in query
 *
 * Returns 200 ngay cả khi duplicate (provider retry-friendly) — but logs warn
 * nếu signature invalid → 401.
 */
import { BadRequestException, Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PaymentsService } from "./payments.service";

@Controller("v1/payments/webhook")
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("stripe")
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers("stripe-signature") signature: string,
  ) {
    if (!signature) throw new UnauthorizedException("stripe-signature required");
    const rawBody = JSON.stringify(body); // for production: use raw body parser
    const result = await this.payments.handleWebhook({
      provider: "stripe",
      rawBody,
      signatureHeader: signature,
    });
    if (!result.handled) throw new UnauthorizedException("Invalid signature");
    return result;
  }

  @Post("vnpay")
  @HttpCode(200)
  async vnpayWebhook(@Req() req: Request, @Body() body: Record<string, string>) {
    if (!body["vnp_SecureHash"]) throw new BadRequestException("vnp_SecureHash required");
    const metadata = { ...body, organizationId: body["organizationId"] ?? "" };
    const rawBody = new URLSearchParams(body).toString();
    const result = await this.payments.handleWebhook({
      provider: "vnpay",
      rawBody,
      signatureHeader: body["vnp_SecureHash"],
      metadata,
    });
    if (!result.handled) throw new UnauthorizedException("Invalid signature");
    return result;
  }
}
