"use server";

/**
 * apps/web/src/modules/auth/actions.ts
 *
 * Server Actions cho auth — gọi được từ client components. Mỗi action
 * phải được `export async function` riêng (Next.js tự wrap thành RPC).
 *
 * KHÔNG re-export từ `./services/auth.server` vì bundler không phân biệt
 * được server boundary nếu dùng `export { foo } from "./bar"`.
 */

import { env } from "@/modules/_shared/config/env";
import { ACCESS_COOKIE, REFRESH_COOKIE, type LoginResponse, type RegisterResponse } from "@saas-checkin/contracts";
import { AuthError, forwardCookies } from "@/modules/_shared/api";
import { cookies } from "next/headers";
import type { LoginInput, RegisterInput } from "./schemas/auth.schema";

export async function loginActionClient(input: LoginInput): Promise<LoginResponse> {
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

export async function registerActionClient(input: RegisterInput): Promise<RegisterResponse> {
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

export async function logoutActionClient(): Promise<void> {
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
      // best-effort
    }
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
