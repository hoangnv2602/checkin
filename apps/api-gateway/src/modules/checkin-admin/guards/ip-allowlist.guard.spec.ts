/**
 * apps/api-gateway/src/modules/checkin-admin/guards/ip-allowlist.guard.spec.ts
 *
 * I-107 — Regression test for IpAllowlistGuard.
 *
 * Bug: the guard default-deny behaviour made it impossible to log in for
 * the first time in a fresh deployment, because no admin can reach
 * /v1/admin/auth/login to set the env var. The fix is a NODE_ENV-gated
 * bootstrap bypass: in non-production, an unset env var allows the
 * request. In production the default-deny still applies.
 *
 * Test matrix:
 *   NODE_ENV=production + unset env  -> 403 (unchanged, must be the default)
 *   NODE_ENV=development + unset env -> 200 (bootstrap bypass)
 *   NODE_ENV=development + env set   -> enforces (allowlist still wins)
 *     - matching IP     -> 200
 *     - non-matching IP -> 403
 *   non-/v1/admin path                -> 200 (path filter, regardless of env)
 *
 * vi.stubEnv() is used so the env mutations auto-revert after each test,
 * keeping the test process's environment clean.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { IpAllowlistGuard } from "./ip-allowlist.guard";

interface FakeRequest {
  path: string;
  headers: Record<string, string | undefined>;
  socket: { remoteAddress: string };
}

function makeCtx(req: FakeRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function buildReq(overrides: Partial<FakeRequest> = {}): FakeRequest {
  return {
    path: "/v1/admin/auth/login",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  };
}

describe("IpAllowlistGuard", () => {
  // Snapshot original env so afterEach can scrub anything a test forgot.
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowlist = process.env.PLATFORM_ADMIN_IP_ALLOWLIST;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Restore env explicitly (vi.stubEnv auto-restores; belt + suspenders).
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowlist === undefined) delete process.env.PLATFORM_ADMIN_IP_ALLOWLIST;
    else process.env.PLATFORM_ADMIN_IP_ALLOWLIST = originalAllowlist;
  });

  it("non-/v1/admin path is always allowed (path filter)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "");
    const guard = new IpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx(buildReq({ path: "/v1/auth/login" })))).not.toThrow();
  });

  it("production + unset env -> 403 (default-deny preserved)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "");
    const guard = new IpAllowlistGuard();
    expect(() => guard.canActivate(makeCtx(buildReq()))).toThrow();
    try {
      guard.canActivate(makeCtx(buildReq()));
    } catch (err) {
      expect((err as ForbiddenException).message).toContain("IpAllowlist not configured");
    }
  });

  it("development + unset env -> allowed (bootstrap bypass)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "");
    const guard = new IpAllowlistGuard();
    expect(guard.canActivate(makeCtx(buildReq()))).toBe(true);
  });

  it("test + unset env -> allowed (bootstrap bypass covers test runs too)", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "");
    const guard = new IpAllowlistGuard();
    expect(guard.canActivate(makeCtx(buildReq()))).toBe(true);
  });

  it("development + allowlist set + matching IPv4 -> allowed", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "127.0.0.1/32,10.0.0.0/8");
    const guard = new IpAllowlistGuard();
    expect(guard.canActivate(makeCtx(buildReq()))).toBe(true);
  });

  it("development + allowlist set + non-matching IP -> 403", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "10.0.0.0/8");
    const guard = new IpAllowlistGuard();
    expect(() =>
      guard.canActivate(makeCtx(buildReq({ socket: { remoteAddress: "192.168.1.1" } }))),
    ).toThrow();
  });

  it("IPv4 /24 CIDR allows any IP in the range, rejects IPs outside", () => {
    // Bug-fix: matches() previously did an exact 32-bit compare, so
    // 203.0.113.0/24 only matched 203.0.113.0 (the network address itself),
    // not the rest of the range. This test pins the correct /24 behaviour.
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "203.0.113.0/24");
    const guard = new IpAllowlistGuard();
    expect(
      guard.canActivate(makeCtx(buildReq({ socket: { remoteAddress: "203.0.113.42" } }))),
    ).toBe(true);
    expect(
      guard.canActivate(makeCtx(buildReq({ socket: { remoteAddress: "203.0.113.1" } }))),
    ).toBe(true);
    expect(() =>
      guard.canActivate(makeCtx(buildReq({ socket: { remoteAddress: "203.0.114.42" } }))),
    ).toThrow();
  });

  it("respects x-forwarded-for when present (proxy/CDN scenario)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLATFORM_ADMIN_IP_ALLOWLIST", "203.0.113.0/24");
    const guard = new IpAllowlistGuard();
    // socket says 10.0.0.1 (private), x-forwarded-for says 203.0.113.42 (public)
    // — guard must trust the forwarded header.
    expect(
      guard.canActivate(
        makeCtx(
          buildReq({
            socket: { remoteAddress: "10.0.0.1" },
            headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" },
          }),
        ),
      ),
    ).toBe(true);
  });
});
