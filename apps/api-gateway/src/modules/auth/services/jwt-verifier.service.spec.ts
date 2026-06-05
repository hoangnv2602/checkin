/**
 * apps/api-gateway/src/modules/auth/services/jwt-verifier.service.spec.ts
 *
 * Unit tests cho JwtVerifierService (I-105).
 * Mock REDIS provider, use real RS256 keypair via jose.
 */
import { Test } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, beforeEach } from "vitest";
import { newKeyPair, type TestKeyPair } from "../../../../test/keypair";
import { REDIS } from "../../_shared/redis/redis.module";
import { JwtVerifierService } from "./jwt-verifier.service";

describe("JwtVerifierService", () => {
  let verifier: JwtVerifierService;
  let keypair: TestKeyPair;
  let redisStore: Map<string, string>;

  const SIGNING_KEY_CACHE_KEY = "jwt:signing:key";

  beforeEach(async () => {
    keypair = await newKeyPair();
    redisStore = new Map<string, string>();
    redisStore.set(
      SIGNING_KEY_CACHE_KEY,
      JSON.stringify({ publicPem: keypair.publicPem, keyId: "test" }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtVerifierService,
        { provide: REDIS, useValue: { get: async (k: string) => redisStore.get(k) ?? null } },
      ],
    }).compile();

    verifier = moduleRef.get(JwtVerifierService);
  });

  it("verifies a valid token and returns VerifiedAuth", async () => {
    const token = await keypair.signToken({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "alice@acme.test",
      full_name: "Alice",
      tenant_id: "22222222-2222-2222-2222-222222222222",
      role: "owner",
      permission: ["members:read", "members:invite"],
      aud: "web",
      iss: "saas-checkin-core-api",
    });

    const result = await verifier.verify(token);

    expect(result.sub).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.email).toBe("alice@acme.test");
    expect(result.fullName).toBe("Alice");
    expect(result.tenantId).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.role).toBe("owner");
    expect(result.permissions).toEqual(["members:read", "members:invite"]);
  });

  it("throws on wrong audience", async () => {
    const token = await keypair.signToken({
      sub: "x", email: "a@b.c", full_name: "A", aud: "checkin-admin", iss: "saas-checkin-core-api",
    });
    await expect(verifier.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it("throws on wrong issuer", async () => {
    const token = await keypair.signToken({
      sub: "x", email: "a@b.c", full_name: "A", aud: "web", iss: "some-other-issuer",
    });
    await expect(verifier.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when signing key missing from Redis", async () => {
    redisStore.delete(SIGNING_KEY_CACHE_KEY);
    const token = await keypair.signToken({
      sub: "x", email: "a@b.c", full_name: "A", aud: "web", iss: "saas-checkin-core-api",
    });
    await expect(verifier.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when Redis JSON is corrupt", async () => {
    redisStore.set(SIGNING_KEY_CACHE_KEY, "{not-json");
    const token = await keypair.signToken({
      sub: "x", email: "a@b.c", full_name: "A", aud: "web", iss: "saas-checkin-core-api",
    });
    await expect(verifier.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it("throws when key material missing publicPem", async () => {
    redisStore.set(SIGNING_KEY_CACHE_KEY, JSON.stringify({ keyId: "x" }));
    const token = await keypair.signToken({
      sub: "x", email: "a@b.c", full_name: "A", aud: "web", iss: "saas-checkin-core-api",
    });
    await expect(verifier.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it("throws on garbage token", async () => {
    await expect(verifier.verify("not-a-jwt")).rejects.toThrow(UnauthorizedException);
  });

  it("normalizes permission claim (string vs array)", async () => {
    const token = await keypair.signToken({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "a@b.c", full_name: "A",
      permission: "members:read", // single string
      aud: "web", iss: "saas-checkin-core-api",
    });
    const result = await verifier.verify(token);
    expect(result.permissions).toEqual(["members:read"]);
  });
});
