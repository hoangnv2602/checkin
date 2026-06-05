/**
 * packages/contracts/src/auth.ts
 *
 * Hand-written types mirror BFF auth contracts (apps/api-gateway/src/modules/auth).
 * Phase 1: viết tay vì openapi-typescript generate chưa wire.
 * Phase 2: sẽ generate từ /v1/docs-json → replace file này.
 */
export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  userId: string;
  accessToken: string;
  accessExpiresAt: string; // ISO
};

export type RegisterRequest = {
  email: string;
  fullName: string;
  password: string;
  organizationName: string;
  organizationSlug: string;
};

export type RegisterResponse = {
  userId: string;
  organizationId: string;
  accessToken: string;
  accessExpiresAt: string;
};

export type RefreshRequest = {
  refreshToken: string;
};

export type RefreshResponse = {
  accessToken: string;
  accessExpiresAt: string;
};

export type WhoAmIResponse = {
  authenticated: true;
  user: {
    id: string;
    email: string;
    fullName: string;
    emailVerified?: boolean;
    lastLoginAt?: string | null;
  };
  tenant: { id: string | null; role: string | null };
  permissions: string[];
};

// Cookie names — phải khớp với BFF auth.controller.ts:32-36.
export const ACCESS_COOKIE = "sa_access_token";
export const REFRESH_COOKIE = "sa_refresh_token";
