/**
 * apps/web/src/modules/registration/types/ticket.ts
 *
 * Domain types cho public registration flow. Mirror các proto DTO từ
 * packages/proto/ticketing/v1/ticketing.proto.
 */
export type PaymentProviderName = "stripe" | "vnpay";

export interface Money {
  amountMinor: number;
  currency: string;
}

export interface TicketType {
  id: string;
  organizationId: string;
  eventId: string;
  name: string;
  description: string | null;
  price: Money;
  capacity: number;
  soldCount: number;
  saleStartsAt: string;
  saleEndsAt: string;
  isActive: boolean;
}

export type OrderStatus = "Pending" | "Paid" | "Failed" | "Refunded";

export interface Order {
  id: string;
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerName: string;
  subtotal: Money;
  discount: Money;
  total: Money;
  discountCode: string | null;
  provider: string;
  providerSessionId: string | null;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
}

export interface DiscountQuote {
  subtotal: Money;
  discount: Money;
  total: Money;
  appliedCode: string | null;
  failureReason: string | null;
  valid: boolean;
}

export type RegistrationStatus = "Active" | "CheckedIn" | "Revoked" | "Expired";

export interface Registration {
  id: string;
  organizationId: string;
  eventId: string;
  orderId: string;
  ticketTypeId: string;
  jti: string;
  attendeeEmail: string;
  attendeeName: string;
  attendeePhone: string | null;
  status: RegistrationStatus;
  issuedAt: string;
  expiresAt: string;
  checkedInAt: string | null;
  qrImageUrl: string | null;
  signature: string | null;
}

export interface PublicEvent {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  soldTickets: number;
  status: "draft" | "published" | "cancelled" | "completed";
  ticketTypes: TicketType[];
  enabledProviders: PaymentProviderName[];
  currency: string;
}
