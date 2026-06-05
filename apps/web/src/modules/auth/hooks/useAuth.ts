/**
 * apps/web/src/modules/auth/hooks/useAuth.ts
 *
 * Server-side helper — RSC thay vì React hook. Tên `useAuth` cho khớp
 * với convention trong docs/07-frontend.md nhưng thực chất là async function
 * (vì RSC không có hook lifecycle). KHÔNG dùng Zustand — auth state lưu trong
 * httpOnly cookies, page reload = re-fetch /whoami.
 */
import "server-only";
import { whoami } from "../services/auth.server";
import type { Session } from "../types/auth";

export async function useAuth(): Promise<Session | null> {
  return await whoami();
}
