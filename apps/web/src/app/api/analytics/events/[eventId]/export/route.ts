/**
 * apps/web/src/app/api/analytics/events/[eventId]/export/route.ts
 *
 * Bridge to .NET CSV export.
 */
import { NextResponse } from "next/server";

const CORE_API = process.env.CORE_API_BASE ?? "http://localhost:5050";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;
  const res = await fetch(`${CORE_API}/v1/analytics/events/${eventId}/export?organizationId=00000000-0000-0000-0000-000000000001`);
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: res.status });
  }
  const blob = await res.blob();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="event-${eventId}-report.csv"`,
    },
  });
}
