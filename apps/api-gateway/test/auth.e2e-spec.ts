/**
 * apps/api-gateway/test/auth.e2e-spec.ts
 *
 * e2e tests cho /v1/auth/* với supertest (I-105).
 *
 * Strategy: standalone module — register AuthController, AuthService,
 * JwtVerifierService, JwtAuthGuard (stub) trực tiếp qua providers. Avoid
 * pulling in AuthModule's @Global() side effects. Mock globalThis.fetch
 * để chặn AuthService gọi ra core-api. Stub JwtVerifierService với real
 * RS256 keypair được load từ REDIS stub.
 */
import { Test } from "@nestjs/testing";
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { Reflector } from "@nestjs/core";
import { APP_GUARD } from "@nestjs/core";

import { AuthController } from "../src/modules/auth/auth.controller";
import { AuthService } from "../src/modules/auth/services/auth.service";
import { JwtVerifierService } from "../src/modules/auth/services/jwt-verifier.service";
import { JwtAuthGuard } from "../src/modules/auth/guards/jwt-auth.guard";
import { REDIS } from "../src/modules/_shared/redis/redis.module";
import { newKeyPair, type TestKeyPair } from "./keypair";

const fakeTokens = {
  login: {
    userId: "11111111-1111-1111-1111-111111111111",
    accessToken: "access.fake",
    accessExpiresAt: "2026-06-05T10:15:00Z",
    refreshToken: "refresh.fake",
    refreshExpiresAt: "2026-07-05T10:00:00Z",
  },
  refresh: {
    accessToken: "access2.fake",
    accessExpiresAt: "2026-06-05T10:30:00Z",
    refreshToken: "refresh2.fake",
    refreshExpiresAt: "2026-07-05T10:00:00Z",
  },
  register: {
    userId: "22222222-2222-2222-2222-222222222222",
    organizationId: "33333333-3333-3333-3333-333333333333",
    accessToken: "access.fake",
    accessExpiresAt: "2026-06-05T10:15:00Z",
    refreshToken: "refresh.fake",
    refreshExpiresAt: "2026-07-05T10:00:00Z",
  },
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "alice@acme.test",
    fullName: "Alice",
    emailVerified: true,
    lastLoginAt: null,
  },
};

describe("Auth e2e (supertest)", () => {
  let app: INestApplication;
  let keypair: TestKeyPair;
  let redisStore: Map<string, string>;

  beforeAll(async () => {
    keypair = await newKeyPair();
    redisStore = new Map<string, string>();
    redisStore.set(
      "jwt:signing:key",
      JSON.stringify({ publicPem: keypair.publicPem, keyId: "test" }),
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const make = (status: number, body?: unknown) =>
        new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      if (url.endsWith("/v1/identity/login")) return make(200, fakeTokens.login);
      if (url.endsWith("/v1/identity/refresh")) return make(200, fakeTokens.refresh);
      if (url.endsWith("/v1/identity/logout")) return make(204);
      if (url.endsWith("/v1/identity/register")) return make(201, fakeTokens.register);
      if (url.includes("/v1/identity/users/")) return make(200, fakeTokens.user);
      return make(500, "Unexpected URL in test");
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtVerifierService,
        JwtAuthGuard,
        Reflector,
        { provide: REDIS, useValue: { get: async (k: string) => redisStore.get(k) ?? null } },
        // Register JwtAuthGuard as APP_GUARD so it runs on every route
        { provide: APP_GUARD, useExisting: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    vi.restoreAllMocks();
  });

  it("POST /v1/auth/login returns 200 + sets sa_access_token cookie", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "alice@acme.test", password: "PlainP@ss123" })
      .expect(200);

    expect(res.body.userId).toBe("11111111-1111-1111-1111-111111111111");
    expect(res.body.accessToken).toBe("access.fake");
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const access = cookies.find((c: string) => c.startsWith("sa_access_token="));
    const refresh = cookies.find((c: string) => c.startsWith("sa_refresh_token="));
    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
  });

  it("POST /v1/auth/refresh returns 200 + new tokens", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/refresh")
      .send({ refreshToken: "rt" })
      .expect(200);

    expect(res.body.accessToken).toBe("access2.fake");
  });

  it("POST /v1/auth/logout returns 204", async () => {
    await request(app.getHttpServer())
      .post("/v1/auth/logout")
      .send({ refreshToken: "rt" })
      .expect(204);
  });

  it("POST /v1/auth/register returns 201 + org id", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({
        email: "bob@acme.test",
        fullName: "Bob",
        password: "BobP@ss123",
        organizationName: "Bob Events",
        organizationSlug: "bob-events",
      })
      .expect(201);

    expect(res.body.organizationId).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("GET /v1/auth/whoami returns 401 without token", async () => {
    await request(app.getHttpServer()).get("/v1/auth/whoami").expect(401);
  });

  it("GET /v1/auth/whoami returns 200 with valid cookie", async () => {
    const token = await keypair.signToken({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "alice@acme.test",
      full_name: "Alice",
      tenant_id: "t-1",
      role: "owner",
      permission: ["members:read"],
      jti: "j-1",
      aud: "web",
      iss: "saas-checkin-core-api",
    });
    const res = await request(app.getHttpServer())
      .get("/v1/auth/whoami")
      .set("Cookie", `sa_access_token=${token}`)
      .expect(200);

    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.email).toBe("alice@acme.test");
    expect(res.body.permissions).toContain("members:read");
  });

  it("POST /v1/auth/login rejects bad payload via ValidationPipe", async () => {
    await request(app.getHttpServer())
      .post("/v1/auth/login")
      .send({ email: "not-an-email", password: "x" })
      .expect(400);
  });
});
