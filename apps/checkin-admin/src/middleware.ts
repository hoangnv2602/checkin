import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware — Phase 0 stub.
 * Phase 1+:
 *   1. Read cookie `sa_pa_session` (secure, httpOnly, sameSite=strict, domain .admin.saas-checkin.com)
 *   2. Verify JWT signature (RS256 public key từ BFF)
 *   3. Check `aud: 'checkin-admin'` + `mfa: true`
 *   4. If missing/invalid → redirect /login
 *   5. Set x-tenant-id (empty — checkin-admin là global) + x-user-id headers
 */
export function middleware(request: NextRequest) {
  // Phase 0: pass through.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except: _next, api, health, login
    "/((?!_next/static|_next/image|favicon.ico|api/health|login|mfa-setup).*)",
  ],
};
