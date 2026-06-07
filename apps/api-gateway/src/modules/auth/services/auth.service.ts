/**
 * apps/api-gateway/src/modules/auth/services/auth.service.ts
 *
 * Bridge giữa BFF (NestJS) và Core API.
 *
 * Phase 1: dùng REST endpoints của core-api IdentityController (mirror của
 * gRPC service). gRPC service vẫn bind (BindService()) nhưng grpc-dnet's
 * MapGrpcService<T> yêu cầu T extend generated abstract base có static `Service`
 * field — chờ `buf generate` chạy (I-105) để có generated base.
 *
 * Endpoints (core-api):
 *  - POST /v1/identity/login
 *  - POST /v1/identity/refresh
 *  - POST /v1/identity/logout
 *  - POST /v1/identity/register
 *  - GET  /v1/identity/users/{userId}
 */
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { TrialProvisioner } from "../../billing/trial/trial-provisioner.service";

const CORE_API_BASE = process.env.CORE_API_BASE ?? "http://localhost:5050";
const PRO_PLAN_ID = process.env.PRO_PLAN_ID ?? "";

interface SignInResponse {
  userId: string;
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

interface RefreshResponse {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

interface RegisterResponse {
  userId: string;
  organizationId: string;
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
}

interface GetUserResponse {
  id: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
}

class CoreApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown, tenantId?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  const res = await fetch(`${CORE_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new UnauthorizedException(text || "Unauthorized");
    throw new CoreApiError(res.status, text);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function getJson<T>(path: string, tenantId?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (tenantId) headers["X-Tenant-Id"] = tenantId;
  const res = await fetch(`${CORE_API_BASE}${path}`, { method: "GET", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new CoreApiError(res.status, text);
  }
  return (await res.json()) as T;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly trial: TrialProvisioner) {}

  async login(email: string, password: string): Promise<SignInResponse> {
    return postJson<SignInResponse>("/v1/identity/login", { email, password });
  }

  async refresh(refreshToken: string): Promise<RefreshResponse> {
    return postJson<RefreshResponse>("/v1/identity/refresh", { refreshToken });
  }

  async logout(refreshToken: string): Promise<void> {
    await postJson<void>("/v1/identity/logout", { refreshToken });
  }

  async register(input: {
    email: string;
    fullName: string;
    password: string;
    organizationName: string;
    organizationSlug: string;
  }): Promise<RegisterResponse> {
    const result = await postJson<RegisterResponse>("/v1/identity/register", {
      ...input,
      defaultLocale: "vi",
      defaultCurrency: "VND",
      timezone: "Asia/Ho_Chi_Minh",
    });
    // I-504: auto-provision 14-day Pro trial ngay sau khi org tạo xong.
    // Best-effort: nếu fail, vẫn return user có thể dùng Free tier.
    if (PRO_PLAN_ID && result.organizationId) {
      try {
        await this.trial.provisionTrial({
          organizationId: result.organizationId,
          proPlanId: PRO_PLAN_ID,
        });
      } catch (err) {
        this.logger.warn(`trial provision failed for org=${result.organizationId}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return result;
  }

  async getUser(userId: string, tenantId?: string): Promise<GetUserResponse> {
    return getJson<GetUserResponse>(`/v1/identity/users/${userId}`, tenantId);
  }
}
