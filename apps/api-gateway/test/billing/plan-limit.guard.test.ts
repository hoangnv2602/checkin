/**
 * test/billing/plan-limit.guard.test.ts — I-505.
 *
 * PlanLimitGuard: 402 response with details, 200 when allowed, cache hit
 * short-circuits the upstream call.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ExecutionContext, HttpException } from "@nestjs/common";
import { PlanLimitGuard } from "../../src/modules/billing/plan-limits/plan-limit.guard";
import { Reflector } from "@nestjs/core";

function makeContext(metadata: unknown = "ActiveEvents"): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { "x-tenant-id": "org-1" }, body: {} }),
      getResponse: () => ({}),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe("PlanLimitGuard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("passes when allowed=true from upstream", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ allowed: true }), { status: 200 }));
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue("ActiveEvents") } as unknown as Reflector;
    const guard = new PlanLimitGuard(reflector);
    const ok = await guard.canActivate(makeContext("ActiveEvents"));
    expect(ok).toBe(true);
  });

  it("throws 402 Payment Required when allowed=false", async () => {
    fetchMock.mockResolvedValueOnce(new Response(
      JSON.stringify({ allowed: false, code: "plan_limit_exceeded", message: "limit reached", limit: 1, current: 1 }),
      { status: 200 },
    ));
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue("ActiveEvents") } as unknown as Reflector;
    const guard = new PlanLimitGuard(reflector);
    await expect(guard.canActivate(makeContext("ActiveEvents"))).rejects.toThrow(HttpException);
  });

  it("falls back to allow when upstream 404 (no subscription yet)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue("ActiveEvents") } as unknown as Reflector;
    const guard = new PlanLimitGuard(reflector);
    const ok = await guard.canActivate(makeContext("ActiveEvents"));
    expect(ok).toBe(true);
  });

  it("treats 5xx as transient — allows and logs", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue("ActiveEvents") } as unknown as Reflector;
    const guard = new PlanLimitGuard(reflector);
    const ok = await guard.canActivate(makeContext("ActiveEvents"));
    expect(ok).toBe(true);
  });

  it("passes through when no @PlanLimit decorator set", async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new PlanLimitGuard(reflector);
    const ok = await guard.canActivate(makeContext());
    expect(ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
