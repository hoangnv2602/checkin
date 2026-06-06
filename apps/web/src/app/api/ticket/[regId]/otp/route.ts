/**
 * apps/web/src/app/api/ticket/[regId]/otp/route.ts
 *
 * Generate 6-digit OTP, email cho attendee, cache ở Redis 5 phút.
 * BFF endpoint (api-gateway) chịu trách nhiệm gửi mail + lưu hash.
 */
import { NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://localhost:3001";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ regId: string }> },
) {
  const { regId } = await ctx.params;
  const res = await fetch(`${BFF}/v1/registration/ticket/${regId}/otp`, { method: "POST" });
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  return NextResponse.json({ sent: true });
}
