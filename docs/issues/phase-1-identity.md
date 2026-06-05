# Phase 1 — Identity & Tenancy (Tuần 2–3)

> **Mục tiêu:** User có thể đăng ký, tạo org, đăng nhập, chuyển org. JWT auth chạy end-to-end trên web.
> **Phụ thuộc:** Phase 0 hoàn thành.

## Backlog

### I-101 · [L] .NET Core 10 Identity context (bounded-context module)
- Aggregate (trong `src/SaasCheckin.Domain/Identity/Aggregates/`): `User`, `Organization`, `Membership`
- VO (record): `Email`, `OrgSlug`, `Role`
- Domain service: `IPasswordHasher` (BCrypt), `IJwtTokenService` (RS256, dùng `Microsoft.IdentityModel.JsonWebTokens`)
- Interface Repository ở `src/SaasCheckin.Domain/Identity/Repositories/`; impl ở `src/SaasCheckin.EntityFrameworkCore/Repositories/`
- Event: `OrgCreated`, `UserInvited`, `RoleChanged` (in-process) + `OrgCreatedIntegrationEvent` (publish qua MassTransit)
- Bounded-context module class `IdentityModule` (trong `src/SaasCheckin.Domain/Identity/`) tự đăng ký DI, permission, settings
- Bật RLS trên `users`, `memberships`, `organizations` qua EF Core migration; `TenantDbConnectionInterceptor` tự set `app.current_tenant`

### I-102 · [M] NestJS auth module
- `POST /v1/auth/login` — verify password, issue access + refresh
- `POST /v1/auth/refresh` — rotate refresh, issue access mới
- `POST /v1/auth/logout` — vô hiệu cả hai
- `JwtAuthGuard` (verify access token từ `Authorization: Bearer`, set `req.user = { sub, orgId, role, permissions[] }`)
- **KHÔNG có `RolesGuard` / `PermissionsGuard` ở BFF** — theo [ADR-0015](../adr/0015-rbac-hybrid-permissions.md) (single source of truth: .NET `PermissionBehavior`). BFF chỉ làm authn, không authz.
- `TenantContextMiddleware` — set `X-Tenant-Id` từ claim JWT (pass xuống gRPC metadata)
- gRPC client tới .NET Core 10 cho `SignInUser`, `RefreshUser`, `GetUser`

### I-103 · [M] Next.js auth pages
- `/login` — form email + password, gọi `/v1/auth/login`
- `/register` — tạo user + org đầu tiên
- `/forgot-password`, `/reset-password`
- Auth context provider (pattern RSC, không có token phía client)
- `middleware.ts` — redirect user chưa auth tới `/login`
- Org switcher trong sidebar dashboard

### I-104 · [S] DB migration
- Migration đầu tạo `organizations`, `users`, `memberships`
- Áp dụng RLS policy trong cùng migration
- Script seed tạo 1 org + 1 owner user (idempotent)

### I-105 · [M] Độ phủ test
- **xUnit + FluentAssertions** unit test cho Identity domain (aggregate, VO, password hasher, JWT signer)
- **xUnit + Testcontainers** integration test với Postgres cho repository
- **NetArchTest** architecture test: `Identity.Domain` không depend `Identity.Application` hay `Identity.EntityFrameworkCore`; `Identity.Application.Contracts` không depend `Identity.Application`
- **NestJS** unit test cho auth service + guard
- **NestJS** e2e test cho auth endpoint (dùng supertest)
- **Playwright** e2e cho web: register → login → thấy dashboard

### I-106 · [L] .NET Core 10 PlatformOperations context (D12, ADR-0014) — checkin-admin audience
- Aggregate (trong `src/SaasCheckin.Domain/PlatformOperations/Aggregates/`): `PlatformUser`, `PlatformSession`
- VO (record): `PlatformRole` enum (`PlatformOwner` | `PlatformSupport` | `PlatformEngineer`), `MfaSecret` (TOTP, RFC 6238), `IpAddress`
- Domain service: `ITotpCodeVerifier` (RFC 6238, ±1 step skew), `IPasswordHasher` (BCrypt, cost 12)
- Event: `PlatformUserInvited`, `PlatformUserLoggedIn`, `PlatformUserMfaEnabled`, `PlatformUserLockedOut`
- Bounded-context module class `PlatformOperationsModule` đăng ký DI, permission constants
- **Audit log tạm thời** (Phase 1 chưa có `PlatformAuditEntry` aggregate): mọi mutation ghi vào `outbox_messages` với topic `platform.audit.<action>`; Phase 6 thay bằng table riêng
- Bảng `platform_users`, `platform_sessions` KHÔNG có `tenant_id`, RLS bypass cho `app_platform_owner`; `app_runtime` không có grant SELECT
- **Postgres role `app_platform_owner` tạo ở migration này** (cùng migration đầu), với `BYPASSRLS`
- Migration tạo `platform_users`, `platform_sessions` + revoke UPDATE/DELETE trên `platform_audit_log` (chưa tồn tại, set up sẵn policy)

### I-107 · [M] NestJS checkin-admin auth module (BFF)
- File: `apps/api-gateway/src/modules/checkin-admin/admin-auth.controller.ts` + `admin-auth.service.ts` + `admin-auth.guard.ts`
- `POST /v1/admin/auth/login` — verify password + TOTP code; issue JWT `aud: 'checkin-admin'` + refresh token
- `POST /v1/admin/auth/refresh` — rotate, issue access mới
- `POST /v1/admin/auth/logout` — vô hiệu session
- `POST /v1/admin/auth/mfa/setup` — generate TOTP secret + QR code (data URL), chưa kích hoạt cho đến khi verify code đầu tiên
- `POST /v1/admin/auth/mfa/verify` — confirm TOTP secret; set `mfa_enabled = true`
- `PlatformAdminAuthGuard` (verify `aud: 'checkin-admin'`, `mfa: true`, `role` ∈ {`platform_owner`, `platform_support`, `platform_engineer`})
- `IpAllowlistGuard` (config `PLATFORM_ADMIN_IP_ALLOWLIST` env, comma-separated CIDR)
- gRPC channel riêng `PlatformGrpcClient` với service-account `app_platform_owner`, set metadata `x-platform-role: true`
- **Refresh token TTL 8 giờ** (so với tenant 30 ngày) — config qua `PLATFORM_ADMIN_REFRESH_TTL_HOURS`
- Session lưu Redis với key prefix `sess:pa:{tokenId}` (so với tenant `sess:rt:*`)

### I-108 · [M] Next.js (checkin-admin) auth pages
- File: `apps/checkin-admin/src/app/(auth)/login/page.tsx` — form email + password + TOTP code (3 field 1 form)
- File: `apps/checkin-admin/src/app/(auth)/mfa-setup/page.tsx` — hiện QR code, yêu cầu nhập 1 TOTP code để confirm
- File: `apps/checkin-admin/src/middleware.ts` — check JWT cookie `sa_pa_session`; nếu thiếu redirect `/login`; nếu có nhưng `mfa: false` redirect `/mfa-setup`; nếu đủ mới cho vào `(dashboard)`
- Service: `apps/checkin-admin/src/modules/_shared/auth/adminAuthApi.ts` — gọi `/v1/admin/auth/*`
- Layout: `apps/checkin-admin/src/app/(dashboard)/layout.tsx` với sidebar (Tenants / Subscriptions / Plans / Audit / Feature Flags / Settings) + topbar (user avatar, logout)
- Component: `MfaOtpInput.tsx` (6 ô input, tự focus next, paste support)
- **Mock data Phase 1:** seed 1 platform user `owner@saas-checkin.com` / password trong `.env.example`; bắt buộc đổi password + setup MFA ở lần login đầu

---

## Definition of Done

- [ ] User mới register → nhận email xác nhận → đăng nhập
- [ ] User có sẵn đăng nhập, lấy JWT, truy cập route được bảo vệ
- [ ] Refresh rotation hoạt động; refresh token bị thu hồi trả 401
- [ ] Org switcher đổi header `X-Tenant-Id`; backend tôn trọng
- [ ] Test RLS: query chéo tenant trả 0 dòng
- [ ] Mọi test Phase 1 xanh trên CI
- [ ] **Super-admin user invite đầu tiên (seed) → login bằng password → setup MFA → vào được `/tenants` (page trống, chưa list gì)**
- [ ] **Test PlatformOperations context:** aggregate unit test, repository integration test với Postgres role `app_platform_owner` (xác nhận BYPASSRLS hoạt động), NetArchTest verify PlatformOperations.Domain không depend Identity.Domain (chỉ giao tiếp qua ID + integration event)
- [ ] **Test audit log tạm:** integration test gọi mutation qua checkin-admin gRPC channel, verify `outbox_messages` có row với topic `platform.audit.*`
- [ ] **Test IP allowlist:** request từ IP ngoài allowlist trả 403; request trong allowlist pass
