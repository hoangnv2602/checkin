/**
 * apps/checkin-admin/src/modules/auth/services/adminAuthApi.ts — I-108
 *
 * Server-side fetch wrapper cho /v1/admin/auth/* endpoints.
 * Dùng httpOnly cookies — không lưu token ở client storage.
 */
import "server-only";
import { cookies } from "next/headers";

const BFF_URL = process.env.BFF_URL ?? "http://localhost:3001";
const ACCESS_COOKIE = "sa_pa_session";
const REFRESH_COOKIE = "sa_pa_refresh";

interface AdminLoginResponse {
  userId: string;
  mfaRequired: boolean;
  setupToken?: string;
  accessToken?: string;
  accessExpiresAt?: string;
}

interface MfaSetupResponse {
  secretBase32: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

class AdminAuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = [ACCESS_COOKIE, REFRESH_COOKIE]
    .map((n) => `${n}=${cookieStore.get(n)?.value ?? ""}`)
    .filter((s) => !s.endsWith("="))
    .join("; ");

  const res = await fetch(`${BFF_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AdminAuthError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

export async function adminLogin(input: {
  email: string;
  password: string;
  totpCode?: string;
}): Promise<AdminLoginResponse> {
  return postJson<AdminLoginResponse>("/v1/admin/auth/login", input);
}

export async function adminMfaSetup(setupToken: string): Promise<MfaSetupResponse> {
  return postJson<MfaSetupResponse>("/v1/admin/auth/mfa/setup", { setupToken });
}

export async function adminMfaVerify(input: {
  setupToken: string;
  totpCode: string;
}): Promise<{ mfaEnabled: boolean }> {
  return postJson<{ mfaEnabled: boolean }>("/v1/admin/auth/mfa/verify", input);
}

export async function adminLogout(): Promise<void> {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      await postJson<void>("/v1/admin/auth/logout", { refreshToken: refresh });
    } catch {
      // best-effort
    }
  }
}

export { AdminAuthError };
