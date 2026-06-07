/**
 * apps/api-gateway/src/modules/checkin-admin/impersonation/impersonation.types.ts
 *
 * I-906 — Platform admin impersonation types.
 *
 * Flow:
 *  1. Platform admin (MFA-verified) start session against tenantId.
 *  2. Service issues short-lived JWT (15 min) với `is_impersonated: true`
 *     claim + `impersonation_session_id`.
 *  3. Admin uses this JWT thay cho tenant JWT — mọi mutation ghi audit log
 *     với actor=platform_user_id, reason từ start request.
 *  4. Session auto-expire sau max 30 phút. Admin có thể revoke manually.
 *
 * Risk R-20 guardrails:
 *  - Max 30 phút/session
 *  - Single session per platform user (new session revokes old)
 *  - Reason bắt buộc (audit log)
 *  - Audit log: platform_audit_log + tenant audit_log (dual)
 */
export type ImpersonationState = "Active" | "Revoked" | "Expired";

export interface ImpersonationSession {
  id: string;
  platformUserId: string;
  tenantId: string;
  reason: string;
  state: ImpersonationState;
  /** ISO timestamp of start. */
  startedAt: string;
  /** ISO timestamp of expiry. */
  expiresAt: string;
  /** ISO timestamp of revocation (nếu có). */
  revokedAt?: string;
  /** Revoked by (platformUserId) nếu manual revoke. */
  revokedBy?: string;
  /** IP address at start (audit trail). */
  ipAddress?: string;
  /** User agent at start. */
  userAgent?: string;
}

export interface ImpersonationStartInput {
  platformUserId: string;
  tenantId: string;
  reason: string;
  /** Optional override duration (minutes). Default 15, max 30. */
  durationMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
}

export const IMPERSONATION_REASON_MIN_LENGTH = 10;
export const IMPERSONATION_REASON_MAX_LENGTH = 500;
export const IMPERSONATION_DEFAULT_DURATION_MINUTES = 15;
export const IMPERSONATION_MAX_DURATION_MINUTES = 30;
export const IMPERSONATION_SESSION_ID_PREFIX = "imp_";

/** JWT claims attached to impersonation session. */
export interface ImpersonationClaims {
  /** Subject: tenant user being impersonated (NOT platform user). */
  sub: string;
  tenantId: string;
  is_impersonated: true;
  impersonation_session_id: string;
  impersonated_by: string;
  /** Unix seconds expiry. */
  exp: number;
  /** Unix seconds issued at. */
  iat: number;
}
