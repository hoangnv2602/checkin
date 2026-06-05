import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness probe.
 * Trả 200 OK nếu process sống. KHÔNG check DB / external service
 * (đó là /api/ready — Phase 1+).
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
  });
}
