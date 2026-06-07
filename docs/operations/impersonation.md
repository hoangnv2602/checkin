# Platform admin impersonation (I-906)

> **Phase 9 — Platform Maturity.** Platform owner (MFA-verified) tạm thời
> impersonate tenant user để debug / support. Risk R-20 guardrails enforced.

## Flow

```
1. Platform admin login MFA → POST /v1/admin/impersonation/start
   body: { tenantId, reason, durationMinutes? }
   → returns { session, claims } (session.id, claims.is_impersonated=true)
2. Admin use claims.token to access tenant API (apps/web, apps/api-gateway).
   - BFF middleware read JWT claim is_impersonated → attach req.impersonation
   - Mọi mutation log audit dual: platform_audit_log + tenant audit_log
3. Banner UI hiển thị: "Đang impersonate as tenant X, reason Y"
4. Auto-expire sau duration. POST /v1/admin/impersonation/:id/revoke để kết thúc sớm.
```

## Risk R-20 guardrails

| Guardrail | Implementation |
|-----------|----------------|
| Max 30 phút/session | `IMPERSONATION_MAX_DURATION_MINUTES = 30` |
| Single session per platform user | Store tự revoke session cũ khi start session mới |
| Reason bắt buộc | 10-500 chars, validated |
| Default 15 phút | `IMPERSONATION_DEFAULT_DURATION_MINUTES = 15` |
| Audit dual-log | platform_audit_log + tenant audit_log |
| IP + User agent capture | Start request log metadata |
| Auto-expire sweep | Service.sweep() — call mỗi 1 phút từ health check |

## Endpoints (auth: platform admin MFA)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/admin/impersonation/start` | Tạo session |
| `GET` | `/v1/admin/impersonation/active` | List active sessions cho current platform user |
| `GET` | `/v1/admin/impersonation/by-tenant/:tenantId` | List sessions for tenant (audit) |
| `POST` | `/v1/admin/impersonation/:id/revoke` | Manual revoke |

## JWT claims

```json
{
  "sub": "user_subject_placeholder",
  "tenantId": "tenant_1",
  "is_impersonated": true,
  "impersonation_session_id": "imp_mq3ix...",
  "impersonated_by": "plat_user_id",
  "exp": 1749321600,
  "iat": 1749320700
}
```

`is_impersonated: true` triggers banner UI + dual audit log.

## Audit log entries

**`platform_audit_log`:**
```
actor_id: plat_user_id
action: impersonation.start
metadata: { sessionId, tenantId, reason, durationMinutes, ipAddress, userAgent }
```

**`tenant audit_log`:**
```
actor_id: plat_user_id (NOT tenant user)
metadata: { impersonation_session_id, reason }
```

## Out of scope (Phase 10+)

- Postgres `impersonation_sessions` table (retention 2 năm cho SOC 2)
- BFF middleware attach `req.impersonation` (chưa wire — Phase 9 chỉ có service + endpoints)
- UI banner (apps/checkin-admin — Phase 10)
- Recording session activity (every API call tracked)
