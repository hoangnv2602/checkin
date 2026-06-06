/**
 * apps/api-gateway/src/modules/checkin-admin/admin-auth.service.ts
 *
 * I-107 Phase 1 — Bridge giữa BFF (NestJS) và core-api PlatformOperations context.
 * Endpoints (core-api):
 *  - POST /v1/platform/login
 *  - POST /v1/platform/refresh
 *  - POST /v1/platform/logout
 *  - POST /v1/platform/mfa/setup
 *  - POST /v1/platform/mfa/verify
 *  - GET  /v1/platform/me
 */
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";

interface AdminLoginResponse {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  mfaRequired: boolean;
  mfaSetupRequired: boolean;
}

interface AdminRefreshResponse {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

interface MfaSetupResponse {
  secretBase32: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}
export type { MfaSetupResponse };

class CoreApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${CORE_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new UnauthorizedException(text || "Unauthorized");
    if (res.status === 404) {
      throw new ServiceUnavailableException(
        `core-api endpoint ${path} not implemented (Phase 2 PlatformOperations)`,
      );
    }
    throw new CoreApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  async login(email: string, password: string, totpCode?: string): Promise<AdminLoginResponse> {
    return postJson<AdminLoginResponse>("/v1/platform/login", { email, password, totpCode });
  }

  async refresh(refreshToken: string): Promise<AdminRefreshResponse> {
    return postJson<AdminRefreshResponse>("/v1/platform/refresh", { refreshToken });
  }

  async logout(refreshToken: string): Promise<void> {
    await postJson<void>("/v1/platform/logout", { refreshToken });
  }

  async setupMfa(setupToken: string): Promise<MfaSetupResponse> {
    return postJson<MfaSetupResponse>(
      "/v1/platform/mfa/setup",
      { setupToken },
      { "x-platform-setup": "true" },
    );
  }

  async verifyMfa(setupToken: string, totpCode: string): Promise<AdminLoginResponse> {
    return postJson<AdminLoginResponse>(
      "/v1/platform/mfa/verify",
      { setupToken, totpCode },
      { "x-platform-setup": "true" },
    );
  }
}
