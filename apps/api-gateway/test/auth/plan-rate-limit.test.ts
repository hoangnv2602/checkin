/**
 * apps/api-gateway/test/auth/plan-rate-limit.test.ts
 *
 * I-807 — Unit test cho PlanRateLimitGuard sliding window logic.
 */
import { PlanRateLimitGuard, type PlanTier } from "../../src/modules/auth/guards/plan-rate-limit.guard";

const zaddMock = jest.fn();
const zcardMock = jest.fn();
const zremrangebyscoreMock = jest.fn();
const zrangeMock = jest.fn();
const expireMock = jest.fn();

const fakeRedis = {
  zadd: zaddMock,
  zcard: zcardMock,
  zremrangebyscore: zremrangebyscoreMock,
  zrange: zrangeMock,
  expire: expireMock,
};

const makeCtx = (req: Record<string, unknown>) => ({
  switchToHttp: () => ({ getRequest: () => req }),
});

describe("PlanRateLimitGuard", () => {
  let guard: PlanRateLimitGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    guard = new PlanRateLimitGuard(fakeRedis as any);
  });

  it("cho phép request khi count dưới limit", async () => {
    zcardMock.mockResolvedValue(10); // dưới free limit 60
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { sub: "u1", plan: "free" } });
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
    expect(zaddMock).toHaveBeenCalled();
  });

  it("reject 429 khi count >= limit", async () => {
    zcardMock.mockResolvedValue(60); // bằng free limit
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { sub: "u1", plan: "free" } });
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(/rate_limited/);
  });

  it("per-IP fallback khi không có tenant", async () => {
    zcardMock.mockResolvedValue(10);
    const ctx = makeCtx({ headers: {}, ip: "203.0.113.5" });
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
  });

  it("burst check: count trong 10s > 2x limit → reject", async () => {
    zcardMock
      .mockResolvedValueOnce(10) // first zcard = minute window (passes)
      .mockResolvedValueOnce(120); // second zcard = burst window (fails for free: 60*2=120)
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { sub: "u1", plan: "free" } });
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(/rate_limited/);
  });

  it("Pro tier có limit 300", async () => {
    zcardMock.mockResolvedValue(299);
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { sub: "u1", plan: "pro" } });
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
  });

  it("Enterprise tier có limit 1000", async () => {
    zcardMock.mockResolvedValue(999);
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { sub: "u1", plan: "enterprise" } });
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
  });

  it("Plan tier không hợp lệ → fallback free", async () => {
    zcardMock.mockResolvedValue(10);
    const ctx = makeCtx({ headers: { "x-tenant-id": "t1" }, user: { sub: "u1", plan: "unknown_tier" } });
    const result = await guard.canActivate(ctx as never);
    expect(result).toBe(true);
  });
});
