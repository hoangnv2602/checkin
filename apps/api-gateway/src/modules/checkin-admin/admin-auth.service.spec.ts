/**
 * apps/api-gateway/src/modules/checkin-admin/admin-auth.service.spec.ts
 *
 * I-107 — Regression test for AdminAuthService ↔ core-api error mapping.
 *
 * Bug: postJson() chỉ nhánh 401 (Unauthorized) và 404 (Service Unavailable).
 * Mọi status khác (423 Locked, 403 Forbidden, 429 Too Many Requests, …) rơi
 * vào `throw new CoreApiError(...)` — không phải NestJS exception, nên default
 * exception filter trả 500 Internal Server Error, che mất status thật từ
 * core-api.
 *
 * Quan trọng nhất: 423 Locked — core-api trả 423 khi platform user bị khóa
 * do nhập sai password ≥ 5 lần (PlatformUser.VerifyPassword ném
 * InvalidOperationException → controller map thành 423). Bug này khiến
 * checkin-admin Next.js thấy "Internal server error" thay vì "tài khoản
 * bị tạm khóa, thử lại sau 15 phút".
 *
 * Test matrix (mock global fetch):
 *   - 200 OK        → resolves with parsed JSON
 *   - 401 Unauthorized → throws UnauthorizedException (forward body)
 *   - 423 Locked    → throws HttpException with status 423 (forward body)
 *   - 404 Not Found → throws ServiceUnavailableException (existing behaviour)
 *   - 500 generic   → throws CoreApiError (preserved — caught by NestJS 500)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";

describe("AdminAuthService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let svc: AdminAuthService;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    svc = new AdminAuthService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("login() resolves with parsed JSON on 200", async () => {
    const body = {
      userId: "u1",
      email: "owner@saas-checkin.com",
      fullName: "Platform Owner",
      role: "PlatformOwner",
      accessToken: "at",
      accessExpiresAt: "2026-06-08T00:00:00Z",
      refreshToken: "rt",
      refreshExpiresAt: "2026-06-08T08:00:00Z",
      mfaRequired: false,
      mfaSetupRequired: true,
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));

    const result = await svc.login("owner@saas-checkin.com", "VeryStrongP@ss123");

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/v1\/platform\/login$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "owner@saas-checkin.com",
      password: "VeryStrongP@ss123",
      totpCode: undefined,
    });
  });

  it("login() throws UnauthorizedException on 401 (forwards body)", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Email hoặc password không đúng." }), { status: 401 }),
    );

    await expect(svc.login("owner@saas-checkin.com", "wrong")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // Regression: trước đây BFF trả 500 thay vì 423 khi core-api trả 423
  it("login() throws HttpException(423) on 423 Locked (does NOT collapse to 500)", async () => {
    const body = "PlatformUser is locked until 2026-06-08T04:10:00+00:00";
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 423 }));

    let caught: unknown;
    try {
      await svc.login("owner@saas-checkin.com", "VeryStrongP@ss123");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(HttpException);
    const http = caught as HttpException;
    expect(http.getStatus()).toBe(423);
    // Body phải được forward nguyên văn để client đọc được message.
    expect(http.getResponse()).toBe(body);
  });

  it("login() throws ServiceUnavailableException on 404 (Phase 2 not-yet-implemented)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));

    await expect(svc.login("owner@saas-checkin.com", "x")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("login() returns undefined on 204 No Content", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await svc.logout("rt");
    expect(result).toBeUndefined();
  });
});
