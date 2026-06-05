/**
 * apps/api-gateway/src/modules/auth/guards/jwt-auth.guard.spec.ts
 *
 * Unit tests cho JwtAuthGuard (I-105).
 *
 * Reflector không có @Injectable() — phải tự new. JwtAuthGuard được tạo thẳng
 * qua constructor (DI thật sẽ inject Reflector + JwtVerifierService từ module).
 */
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { JwtVerifierService, type VerifiedAuth } from "../services/jwt-verifier.service";
import { newKeyPair, type TestKeyPair } from "../../../../test/keypair";

function makeContext(req: Partial<Request>, handler?: any, klass?: any): ExecutionContext {
  const http = {
    getRequest: () => req,
    getHandler: () => handler ?? (() => undefined),
    getClass: () => klass ?? class {},
  };
  return { switchToHttp: () => http, getHandler: () => handler, getClass: () => klass } as unknown as ExecutionContext;
}

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let verifier: { verify: (t: string, a?: string) => Promise<VerifiedAuth> };
  let keypair: TestKeyPair;

  beforeEach(async () => {
    keypair = await newKeyPair();
    reflector = new Reflector();
    verifier = {
      verify: vi.fn(async (_t: string) => ({
        sub: "u-1", email: "a@b.c", fullName: "A",
        tenantId: "t-1", role: "owner", permissions: [], jti: "j-1",
      })),
    };
    guard = new JwtAuthGuard(reflector, verifier as unknown as JwtVerifierService);
  });

  it("returns true when handler is marked @Public()", async () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    const ctx = makeContext({ headers: {} });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("throws when no Authorization header and no cookie", async () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
    const ctx = makeContext({ headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("extracts Bearer token from Authorization header", async () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
    const token = await keypair.signToken({ sub: "u-1" });
    const ctx = makeContext({ headers: { authorization: `Bearer ${token}` } });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(verifier.verify).toHaveBeenCalledWith(token);
  });

  it("extracts token from sa_access_token cookie", async () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
    const token = await keypair.signToken({ sub: "u-1" });
    const ctx = makeContext({ headers: { cookie: `sa_access_token=${token}` } });
    await guard.canActivate(ctx);
    expect(verifier.verify).toHaveBeenCalledWith(token);
  });

  it("propagates verifier errors as 401", async () => {
    vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
    vi.spyOn(verifier, "verify").mockRejectedValueOnce(new UnauthorizedException("bad"));
    const token = await keypair.signToken({ sub: "u-1" });
    const ctx = makeContext({ headers: { authorization: `Bearer ${token}` } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
