/**
 * apps/web/src/modules/registration/services/registrationApi.ts
 *
 * Public registration API client (server-side fetch). No JWT — public endpoints.
 */
import "server-only";
import { env } from "@/modules/_shared/config/env";
import type { DiscountQuote, Order, PublicEvent, Registration, TicketType } from "../types/ticket";

const BFF = env.bffUrl;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BFF}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Public event detail theo org slug + event slug.
 * Ở Phase 3 chưa có slug index; truyền eventId qua query. Có thể refactor ở
 * Phase 5+ khi thêm slug column vào events.
 */
export async function getPublicEvent(orgSlug: string, eventSlugOrId: string): Promise<PublicEvent> {
  // resolve slug → eventId bằng public endpoint nếu có; fall back dùng id
  return call<PublicEvent>(`/v1/public/${orgSlug}/events/${eventSlugOrId}`);
}

export async function listTicketTypes(organizationId: string, eventId: string): Promise<TicketType[]> {
  return call<TicketType[]>(`/v1/registration/ticket-types?organizationId=${organizationId}&eventId=${eventId}`);
}

export async function applyDiscount(input: {
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  discountCode: string;
}): Promise<DiscountQuote> {
  return call<DiscountQuote>("/v1/registration/apply-discount", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createOrder(input: {
  organizationId: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerName: string;
  discountCode?: string;
  provider: "stripe" | "vnpay";
}): Promise<Order> {
  return call<Order>("/v1/registration/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getOrder(orderId: string, organizationId: string): Promise<Order> {
  return call<Order>(`/v1/registration/orders/${orderId}?organizationId=${organizationId}`);
}

export async function getRegistration(registrationId: string, organizationId: string): Promise<Registration> {
  return call<Registration>(`/v1/registration/registrations/${registrationId}?organizationId=${organizationId}`);
}
