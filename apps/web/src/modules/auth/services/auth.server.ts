/**
 * apps/web/src/modules/auth/services/auth.server.ts
 *
 * Server-side auth service — gọi BFF endpoints + forward cookies vào Next cookie store.
 * File này `import "server-only"` để chặn nhầm lẫn import từ client component
 * (cookie store chỉ available trong RSC / Server Action).
 */
import "server-only";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  type LoginResponse,
  type RegisterResponse,
  type WhoAmIResponse,
} from "@saas-checkin/contracts";
import { AuthError, bffFetch, forwardCookies } from "@/modules/_shared/api";
import { env } from "@/modules/_shared/config/env";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema";

/**
 * POST /v1/auth/login → set sa_access_token + sa_refresh_token cookies + return LoginResponse.
 * Throw AuthError(401) nếu credentials sai.
 */
export async function loginAction(input: LoginInput): Promise<LoginResponse> {
  const res = await fetch(`${env.bffUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    redirect: "manual",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AuthError(res.status, text || "Đăng nhập thất bại");
  }
  const data = (await res.json()) as LoginResponse;
  const store = await cookies();
  forwardCookies(res, (name, value, opts) => {
    store.set(name, value, opts as Parameters<typeof store.set>[2]);
  });
  return data;
}

/** POST /v1/auth/register → set cookies + return RegisterResponse. */
export async function registerAction(input: RegisterInput): Promise<RegisterResponse> {
  const res = await fetch(`${env.bffUrl}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    redirect: "manual",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AuthError(res.status, text || "Đăng ký thất bại");
  }
  const data = (await res.json()) as RegisterResponse;
  const store = await cookies();
  forwardCookies(res, (name, value, opts) => {
    store.set(name, value, opts as Parameters<typeof store.set>[2]);
  });
  return data;
}

/**
 * POST /v1/auth/logout → revoke refresh + clear cookies. Best-effort:
 * nếu BFF down vẫn clear local cookies.
 */
export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await fetch(`${env.bffUrl}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      // best-effort — luôn clear local cookies
    }
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/**
 * GET /v1/auth/whoami với cookie forward. Return null nếu chưa đăng nhập
 * (cookie missing hoặc BFF trả 401). Throw các lỗi khác để caller biết.
 */
export async function whoami(): Promise<WhoAmIResponse | null> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  if (!access) return null;
  try {
    return await bffFetch<WhoAmIResponse>("/v1/auth/whoami", {
      method: "GET",
      cookies: `${ACCESS_COOKIE}=${access}`,
    });
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) return null;
    throw e;
  }
}
