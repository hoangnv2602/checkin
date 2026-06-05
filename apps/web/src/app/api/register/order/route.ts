/**
 * apps/web/src/app/api/register/order/route.ts
 *
 * Bridge Next.js → BFF: tạo Order + ApplyDiscount qua core-api.
 */
import { NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://localhost:3001";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    eventId: string;
    ticketTypeId: string;
    quantity: number;
    buyerName: string;
    buyerEmail: string;
    discountCode?: string;
    provider: "stripe" | "vnpay";
  };

  // 1. apply discount (preview) — không bắt buộc nhưng giúp hiển thị breakdown
  const discountRes = await fetch(`${BFF}/v1/registration/apply-discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: body.eventId, // TODO: resolve org from event ở Phase 5+
      eventId: body.eventId,
      ticketTypeId: body.ticketTypeId,
      quantity: body.quantity,
      discountCode: body.discountCode ?? "",
    }),
  });
  const quote = discountRes.ok ? await discountRes.json() : null;

  // 2. create order
  const orderRes = await fetch(`${BFF}/v1/registration/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId: body.eventId, // TODO: real org id
      eventId: body.eventId,
      ticketTypeId: body.ticketTypeId,
      quantity: body.quantity,
      buyerName: body.buyerName,
      buyerEmail: body.buyerEmail,
      discountCode: body.discountCode,
      provider: body.provider,
    }),
  });
  if (!orderRes.ok) {
    return NextResponse.json({ error: await orderRes.text() }, { status: orderRes.status });
  }
  const order = await orderRes.json();
  return NextResponse.json({ order, quote });
}
