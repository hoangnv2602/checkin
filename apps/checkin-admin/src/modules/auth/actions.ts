"use server";

/**
 * apps/checkin-admin/src/modules/auth/actions.ts — I-108
 *
 * Server Actions cho admin auth flow — gọi từ client forms.
 */
import { cookies } from "next/headers";
import { adminLogin, adminMfaSetup, adminMfaVerify, adminLogout } from "./services/adminAuthApi";
import type { AdminLoginInput, AdminMfaVerifyInput } from "./schemas/admin-auth.schema";

const ACCESS_COOKIE = "sa_pa_session";
const REFRESH_COOKIE = "sa_pa_refresh";

export async function adminLoginAction(
  input: AdminLoginInput,
): Promise<{ mfaRequired: boolean; setupToken?: string; redirect?: string }> {
  const result = await adminLogin(input);
  if (!result.mfaRequired && result.accessToken) {
    const store = await cookies();
    store.set(ACCESS_COOKIE, result.accessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60,
      path: "/",
    });
  }
  return {
    mfaRequired: result.mfaRequired,
    setupToken: result.setupToken,
    redirect: result.mfaRequired ? "/mfa-setup" : "/tenants",
  };
}

export async function adminMfaSetupAction(setupToken: string) {
  return adminMfaSetup(setupToken);
}

export async function adminMfaVerifyAction(
  input: AdminMfaVerifyInput & { setupToken: string },
): Promise<{ mfaEnabled: boolean }> {
  const result = await adminMfaVerify({
    setupToken: input.setupToken,
    totpCode: input.totpCode,
  });
  return result;
}

export async function adminLogoutAction(): Promise<void> {
  await adminLogout();
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
