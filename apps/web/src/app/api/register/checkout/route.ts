/**
 * apps/web/src/app/api/register/checkout/route.ts
 *
 * Bridge Next.js → BFF checkout (Stripe/VNPay session creation).
 */
import { NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://localhost:3001";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    orderId: string;
    organizationId: string;
    provider: "stripe" | "vnpay";
    amountMinor: number;
    currency: string;
    buyerEmail: string;
    buyerName: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  };

  const res = await fetch(`${BFF}/v1/payments/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  const data = await res.json();

  // Best-effort: attach session to order via BFF.
  if (data.sessionId) {
    await fetch(`${BFF}/v1/registration/orders/${body.orderId}/attach-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: body.organizationId,
        providerSessionId: data.sessionId,
      }),
    });
  }

  return NextResponse.json(data);
}
