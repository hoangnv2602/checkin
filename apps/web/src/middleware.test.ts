/**
 * apps/web/src/middleware.test.ts
 *
 * Unit tests cho middleware — public paths, redirect with ?redirect, static bypass.
 * Note: middleware runs at edge runtime; we test the handler function trực tiếp.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function makeReq(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = `https://example.test${pathname}`;
  const req = new NextRequest(url);
  for (const [k, v] of Object.entries(cookies)) {
    req.cookies.set(k, v);
  }
  return req;
}

describe("middleware", () => {
  it("passes through static assets", () => {
    const res = middleware(makeReq("/_next/static/foo.js"));
    expect(res.status).toBe(200);
  });

  it("passes through favicon", () => {
    const res = middleware(makeReq("/favicon.ico"));
    expect(res.status).toBe(200);
  });

  it("passes through public paths (login)", () => {
    const res = middleware(makeReq("/login"));
    expect(res.status).toBe(200);
  });

  it("passes through public paths (register)", () => {
    const res = middleware(makeReq("/register"));
    expect(res.status).toBe(200);
  });

  it("redirects to /login?redirect=… when no cookie on protected route", () => {
    const res = middleware(makeReq("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?redirect=%2Fdashboard");
  });

  it("preserves search string in redirect param", () => {
    const res = middleware(makeReq("/events?tab=upcoming"));
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/login");
    expect(decodeURIComponent(loc)).toContain("/events?tab=upcoming");
  });

  it("allows when access cookie present", () => {
    const res = middleware(makeReq("/dashboard", { sa_access_token: "fake" }));
    expect(res.status).toBe(200);
  });

  it("redirects /forgot-password without cookie (it's public)", () => {
    // forgot-password is in PUBLIC_PATHS — should pass through
    const res = middleware(makeReq("/forgot-password"));
    expect(res.status).toBe(200);
  });
});
