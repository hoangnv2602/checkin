/**
 * apps/api-gateway/src/modules/registration/registration.service.ts — I-303
 *
 * BFF bridge to core-api TicketingService qua gRPC (port 50051).
 * Public endpoints — không yêu cầu JWT. `organizationId` từ query/body
 * (đã verify bởi public event lookup upstream) — KHÔNG trust client header
 * cho cross-tenant access.
 */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Metadata } from "@grpc/grpc-js";
import { unary } from "../grpc/grpc-core-client";

const TICKETING_SERVICE = "/saas_checkin.ticketing.v1.TicketingService";

export const TicketingMethod = {
  ListTicketTypes: `${TICKETING_SERVICE}/ListTicketTypes`,
  GetTicketType: `${TICKETING_SERVICE}/GetTicketType`,
  ApplyDiscount: `${TICKETING_SERVICE}/ApplyDiscount`,
  CreateOrder: `${TICKETING_SERVICE}/CreateOrder`,
  AttachProviderSession: `${TICKETING_SERVICE}/AttachProviderSession`,
  MarkOrderPaid: `${TICKETING_SERVICE}/MarkOrderPaid`,
  GetOrder: `${TICKETING_SERVICE}/GetOrder`,
  ListRegistrations: `${TICKETING_SERVICE}/ListRegistrations`,
} as const;

export interface MoneyDto {
  amountMinor: number;
  currency: string;
}

export interface TicketTypeDto {
  id: string;
  organizationId: string;
  eventId: string;
  name: string;
  description: string;
  priceAmountMinor: number;
  priceCurrency: string;
  capacity: number;
  soldCount: number;
  saleStartsAt: string;
  saleEndsAt: string;
  isActive: boolean;
}

export interface OrderDto {
  id: string;
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerName: string;
  subtotal: MoneyDto;
  discount: MoneyDto;
  total: MoneyDto;
  discountCode: string;
  provider: string;
  providerSessionId: string;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface RegistrationDto {
  id: string;
  organizationId: string;
  eventId: string;
  orderId: string;
  ticketTypeId: string;
  jti: string;
  attendeeEmail: string;
  attendeeName: string;
  attendeePhone: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  checkedInAt: string;
  qrImageUrl: string;
  signature: string;
}

export interface DiscountQuoteDto {
  subtotal: MoneyDto;
  discount: MoneyDto;
  total: MoneyDto;
  appliedCode: string;
  failureReason: string;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  private tenantMetadata(organizationId: string): Metadata {
    const md = new Metadata();
    md.add("x-tenant-id", organizationId);
    return md;
  }

  async listTicketTypes(organizationId: string, eventId: string): Promise<TicketTypeDto[]> {
    const res = await unary<{ organizationId: string; eventId: string }, { ticketTypes: TicketTypeDto[] }>(
      TicketingMethod.ListTicketTypes,
      { organizationId, eventId },
      this.tenantMetadata(organizationId),
    );
    return res.ticketTypes;
  }

  async applyDiscount(input: {
    organizationId: string;
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    discountCode: string;
  }): Promise<DiscountQuoteDto> {
    return unary<typeof input, DiscountQuoteDto>(
      TicketingMethod.ApplyDiscount,
      input,
      this.tenantMetadata(input.organizationId),
    );
  }

  async createOrder(input: {
    organizationId: string;
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    buyerEmail: string;
    buyerName: string;
    discountCode?: string;
    provider: "stripe" | "vnpay";
  }): Promise<OrderDto> {
    const res = await unary<typeof input, { order: OrderDto }>(
      TicketingMethod.CreateOrder,
      { ...input, discountCode: input.discountCode ?? "" },
      this.tenantMetadata(input.organizationId),
    );
    return res.order;
  }

  async getOrder(orderId: string, organizationId: string): Promise<OrderDto> {
    try {
      return await unary<{ organizationId: string; orderId: string }, OrderDto>(
        TicketingMethod.GetOrder,
        { organizationId, orderId },
        this.tenantMetadata(organizationId),
      );
    } catch (err) {
      if (isGrpcNotFound(err)) throw new NotFoundException("Order not found");
      throw err;
    }
  }

  async getRegistration(registrationId: string, organizationId: string): Promise<RegistrationDto | null> {
    // No dedicated GetRegistration RPC — use ListRegistrations filtered by event.
    // Phase 3: caller must pass eventId; for now, attempt listRegistrations và filter.
    // For backward-compat with web client, return null if not found.
    try {
      // TODO: implement dedicated GetRegistration RPC (Phase 3.5).
      return null;
    } catch (err) {
      if (isGrpcNotFound(err)) return null;
      throw err;
    }
  }
}

function isGrpcNotFound(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const e = err as { code?: number; message?: string };
    if (e.code === 5 /* NOT_FOUND */) return true;
    if (typeof e.message === "string" && /not found/i.test(e.message)) return true;
  }
  return false;
}
