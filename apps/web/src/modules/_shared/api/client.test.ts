/**
 * apps/web/src/modules/_shared/api/client.test.ts
 *
 * Unit tests cho bffFetch + forwardCookies. Test qua mocked globalThis.fetch.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { bffFetch, forwardCookies, AuthError } from "./client";

const BFF = "http://localhost:3001";

describe("bffFetch", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST sends Content-Type + JSON body and returns parsed JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ userId: "u-1" }), { status: 200 }),
    );
    const result = await bffFetch<{ userId: string }>("/v1/auth/login", {
      body: { email: "a@b.c", password: "PlainP@ss123" },
    });
    expect(result).toEqual({ userId: "u-1" });
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BFF}/v1/auth/login`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: "a@b.c", password: "PlainP@ss123" }),
      }),
    );
  });

  it("forwards cookie header when provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await bffFetch("/v1/auth/whoami", { method: "GET", cookies: "sa_access_token=abc" });
    const call = fetchSpy.mock.calls[0];
    const headers = (call?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.cookie).toBe("sa_access_token=abc");
  });

  it("throws AuthError on non-ok status with status + body text", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("Invalid credentials", { status: 401 }),
    );
    await expect(bffFetch("/v1/auth/login", { body: {} })).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
      message: "Invalid credentials",
    });
  });

  it("throws AuthError with statusText fallback when body empty", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("", { status: 500, statusText: "boom" }));
    await expect(bffFetch("/v1/auth/login", { body: {} })).rejects.toBeInstanceOf(AuthError);
  });
});

describe("forwardCookies", () => {
  // happy-dom + Node 22 may not implement getSetCookie. We polyfill the
  // header parsing by reading raw "set-cookie" header and splitting on ", "
  // boundary that respects Expires=Wed, 09 Jun 2027 10:00:00 GMT (no comma).
  function makeRes(setCookieValues: string[]): Response {
    const headers = new Headers();
    // Inject all set-cookie values into a comma-joined string. The forwardCookies
    // helper checks getSetCookie first; we polyfill that getter via Object.defineProperty.
    const res = new Response(null, {
      headers: { "Set-Cookie": setCookieValues.join(", ") },
    });
    Object.defineProperty(res.headers, "getSetCookie", {
      value: () => setCookieValues,
      configurable: true,
    });
    return res;
  }

  it("parses a single Set-Cookie with HttpOnly + Path + SameSite", () => {
    const captured: Array<{ name: string; value: string; opts: Record<string, unknown> }> = [];
    const res = makeRes(["sa_access_token=abc; Path=/; HttpOnly; SameSite=Lax"]);
    forwardCookies(res, (name, value, opts) => {
      captured.push({ name, value, opts });
    });
    expect(captured).toEqual([
      {
        name: "sa_access_token",
        value: "abc",
        opts: { path: "/", httpOnly: true, sameSite: "lax" },
      },
    ]);
  });

  it("parses Max-Age and Expires attributes", () => {
    const captured: Array<{ name: string; value: string; opts: Record<string, unknown> }> = [];
    const res = makeRes([
      "x=y; Max-Age=60; Expires=Wed, 09 Jun 2027 10:00:00 GMT; Path=/",
    ]);
    forwardCookies(res, (name, value, opts) => captured.push({ name, value, opts }));
    const opts = captured[0]?.opts as { maxAge?: number; expires?: Date; path?: string };
    expect(opts.maxAge).toBe(60);
    expect(opts.expires).toBeInstanceOf(Date);
    expect(opts.path).toBe("/");
  });

  it("parses Secure flag", () => {
    const captured: Array<{ opts: Record<string, unknown> }> = [];
    const res = makeRes(["x=y; Secure; Path=/"]);
    forwardCookies(res, (_n, _v, opts) => captured.push({ opts }));
    expect(captured[0]?.opts.secure).toBe(true);
  });

  it("decodes URI-encoded cookie values", () => {
    const captured: Array<{ value: string }> = [];
    const res = makeRes(["x=hello%20world; Path=/"]);
    forwardCookies(res, (_n, value) => captured.push({ value }));
    expect(captured[0]?.value).toBe("hello world");
  });

  it("skips malformed cookie pairs", () => {
    const captured: Array<{ name: string }> = [];
    // Test 2 separate cookies — getSetCookie polyfill returns each as a separate entry
    const res = makeRes(["=novalue; Path=/", "good=ok; Path=/"]);
    forwardCookies(res, (name) => captured.push({ name }));
    expect(captured.map((c) => c.name)).toEqual(["good"]);
  });
});
