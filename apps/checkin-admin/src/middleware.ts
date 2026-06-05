import { NextRequest, NextResponse } from "next/server";

/**
 * apps/checkin-admin/src/middleware.ts — I-108
 *
 * 3 redirect rules (D12/ADR-0014):
 *  1. No sa_pa_session cookie → /login
 *  2. Cookie present but mfa=false claim → /mfa-setup
 *  3. Cookie + mfa=true → pass through
 *
 * Note: signature verification happens ở BFF (api-gateway) mỗi request.
 * Middleware chỉ là fast-path presence check + decode mfa claim từ payload
 * (không verify — chỉ đọc). Production: dùng jose để verify + cache key.
 */
const ACCESS_COOKIE = "sa_pa_session";

export function middleware(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE);

  if (!access) {
    return redirectTo(request, "/login");
  }

  // Decode payload without verify (just to read mfa claim).
  // Real verify happens ở BFF for every /v1/* request.
  const mfa = readMfaClaim(access.value);
  if (mfa === false) {
    return redirectTo(request, "/mfa-setup");
  }
  // mfa === true or unknown — pass through (BFF will reject if invalid)
  return NextResponse.next();
}

function redirectTo(request: NextRequest, target: string) {
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
  url.searchParams.set("redirect", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

/**
 * Decode JWT payload segment #2 (base64url). Returns mfa claim or undefined.
 */
function readMfaClaim(token: string): boolean | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const payload = parts[1]!;
    const padded = payload + "==".slice(0, (4 - (payload.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(decoded) as { mfa?: boolean; aud?: string };
    if (json.aud !== "checkin-admin") return undefined; // wrong audience
    return json.mfa;
  } catch {
    return undefined;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|login|mfa-setup).*)",
  ],
};
