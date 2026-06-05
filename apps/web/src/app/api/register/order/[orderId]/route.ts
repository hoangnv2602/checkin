/**
 * apps/web/src/app/api/register/order/[orderId]/route.ts
 */
import { NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://localhost:3001";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params;
  // TODO: real org id — Phase 3 demo: hardcoded ở middleware
  const orgId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${BFF}/v1/registration/orders/${orderId}?organizationId=${orgId}`);
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
