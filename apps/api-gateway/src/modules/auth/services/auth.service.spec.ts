/**
 * apps/api-gateway/src/modules/auth/services/auth.service.spec.ts
 *
 * Unit tests cho AuthService — verify fetch wrapping logic (I-105).
 */
import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { AuthService } from "./auth.service";
import { TrialProvisioner } from "../../billing/trial/trial-provisioner.service";

describe("AuthService", () => {
  let service: AuthService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let trialMock: { provisionTrial: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    trialMock = { provisionTrial: vi.fn().mockResolvedValue({ subscriptionId: "s", trialEndsAt: "x" }) };
    service = new AuthService(trialMock as unknown as TrialProvisioner);
    fetchSpy = vi.spyOn(globalThis, "fetch" as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("login posts to /v1/identity/login and returns parsed body", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          userId: "u-1",
          accessToken: "at",
          accessExpiresAt: "2026-06-05T10:15:00Z",
          refreshToken: "rt",
          refreshExpiresAt: "2026-07-05T10:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await service.login("alice@acme.test", "PlainP@ss123");

    expect(result.userId).toBe("u-1");
    expect(result.accessToken).toBe("at");
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("http://localhost:0/v1/identity/login");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("refresh posts refresh token", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: "at2" }), { status: 200 }),
    );

    const result = await service.refresh("rt");
    expect(result.accessToken).toBe("at2");
  });

  it("logout posts refresh token and swallows errors silently", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(service.logout("rt")).resolves.toBeUndefined();
  });

  it("register posts registration payload with default locale/currency/timezone", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ userId: "u-2", organizationId: "o-1", accessToken: "at" }),
        { status: 201 },
      ),
    );

    await service.register({
      email: "bob@x.com",
      fullName: "Bob",
      password: "BobP@ss123",
      organizationName: "Bob Events",
      organizationSlug: "bob-events",
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.defaultLocale).toBe("vi");
    expect(body.defaultCurrency).toBe("VND");
    expect(body.timezone).toBe("Asia/Ho_Chi_Minh");
  });

  it("login throws UnauthorizedException on 401", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("bad creds", { status: 401 }));
    await expect(service.login("a@b.c", "wrong")).rejects.toThrow(UnauthorizedException);
  });

  it("login throws on other 4xx/5xx with CoreApiError", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("server error", { status: 500 }));
    await expect(service.login("a@b.c", "p")).rejects.toThrow();
  });

  it("getUser passes X-Tenant-Id header", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "u-1", email: "a@b.c", fullName: "A", emailVerified: false, lastLoginAt: null }),
        { status: 200 },
      ),
    );

    await service.getUser("u-1", "t-1");
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Tenant-Id"]).toBe("t-1");
  });
});
