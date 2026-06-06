/**
 * apps/web/src/app/api/ticket/[regId]/otp/verify/route.ts
 */
import { NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://localhost:3001";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ regId: string }> },
) {
  const { regId } = await ctx.params;
  const { otp } = (await req.json()) as { otp: string };
  const res = await fetch(`${BFF}/v1/registration/ticket/${regId}/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
