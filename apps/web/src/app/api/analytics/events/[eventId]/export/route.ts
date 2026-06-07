/**
 * apps/web/src/app/api/analytics/events/[eventId]/export/route.ts
 *
 * Bridge to BFF CSV export (which proxies to .NET core-api).
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@saas-checkin/contracts";
import { env } from "@/modules/_shared/config/env";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value ?? "";
  const res = await fetch(`${env.bffUrl}/v1/analytics/events/${eventId}/export`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  const blob = await res.blob();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/csv",
      "Content-Disposition":
        res.headers.get("Content-Disposition") ?? `attachment; filename="event-${eventId}-report.csv"`,
    },
  });
}
