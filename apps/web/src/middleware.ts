/**
 * apps/web/src/middleware.ts
 *
 * Presence-check cookie `sa_access_token`. KHÔNG verify JWT signature ở đây —
 * BFF re-verifies ở mọi /v1/* request. Middleware chỉ là fast-path redirect
 * để giảm round-trip tới BFF cho unauth user.
 *
 * Trade-off: cookie có thể expired → user nhận 401 từ layout's `useAuth()`.
 * Phase 2+ sẽ thêm refresh interval hoặc verify signature bằng `jose`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@saas-checkin/contracts";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Static + public APIs (e.g. health) — pass through.
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const access = req.cookies.get(ACCESS_COOKIE);
  if (access) {
    return NextResponse.next();
  }

  // Unauth → redirect to /login với redirect param.
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("redirect", pathname + (search || ""));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static
     * - _next/image
     * - favicon.ico, robots.txt
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
