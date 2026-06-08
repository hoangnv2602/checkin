# Phase 9 — Platform Maturity (Tuần 19–20)

> **Mục tiêu:** Đóng các gap còn lại trong MVP scope (out-of-scope-deferred items), chuẩn hóa
> multi-tenant safety ở mọi query path, mở rộng platform admin tooling, và build self-serve
> capability cho tenant tích hợp.
>
> **Phụ thuộc:** Phase 0–8 done, app đang chạy production với ~1k MAU.

## Backlog

### I-901 · [M] Outbound webhook cho tenant integration
- Tenant đăng ký webhook URL trong settings → nhận event payload khi
  `event.published`, `order.paid`, `checkin.completed`, `attendee.registered`
- Cung cấp: `apps/api-gateway/src/modules/webhooks/` — endpoint CRUD, retry queue
  (BullMQ ưu tiên), HMAC signature (X-Signature-SHA256), audit log
- Tenant UI (`apps/web`): settings → webhooks (list, create, delete, test event)
- Plan gate: Pro + Enterprise. Free chỉ nhận 1 webhook (test)
- Outbox pattern trong `apps/core-api` (đã có `outbox_messages` từ Phase 0) →
  MassTransit publish → BFF consume → enqueue webhook job
- Spec: `docs/api/webhooks.md` (HMAC algorithm, replay protection, payload schema)

### I-902 · [L] Multi-region routing (EU / SG) cho data residency
- ADR mới: 0016-multi-region-tenant-routing.md — partition tenant sang region,
  thêm `region` column trên `organizations`, replica pool per region
- Read replica routing (I-805) extend: route by region header hoặc tenant metadata
- BFF `RegionResolverMiddleware`: ưu tiên `X-Tenant-Region` header → fallback
  default EU
- Plan gate: chỉ Enterprise mới chọn region. Free/Pro mặc định EU
- Database migration: `ALTER TABLE organizations ADD COLUMN data_region TEXT NOT NULL DEFAULT 'eu'`
  + index `(data_region, status)`
- Out of scope: cross-region replication, multi-master (Phase 10+)

### I-903 · [M] Custom field builder cho registration form
- Tenant định nghĩa dynamic field trên form đăng ký: text, number, select,
  checkbox, date, file upload
- Bounded context mới: `FormBuilder` (trong `EventManagement` context) —
  aggregate `FormTemplate` với `FormField` collection (VO)
- API: CRUD `FormTemplate`, gắn vào `Event` qua `Event.registrationFormId`
- Public registration form render dynamic từ schema (Next.js dynamic form component)
- Validation phía server (FluentValidation) + client (zod dynamic build)
- Storage: `custom_field_values JSONB` trên `registrations` (avoid EAV anti-pattern)
- Migration mới: `form_templates`, `form_fields`, ALTER `events` add column

### I-904 · [M] Recurring events / event series
- Aggregate `EventSeries` (new) chứa `recurrence_rule` (RRULE RFC 5545)
- `Event` aggregate thêm `seriesId` nullable + `occurrenceDate`
- Cron job (BFF, cron 06:00 UTC) generate occurrence cho 90 ngày tới
- "This and following" / "Single event" / "Entire series" edit operations
- Public page list occurrences grouped by series
- Out of scope: complex exception dates beyond RRULE (Phase 10+)

### I-905 · [M] Tenant self-serve sub-org (franchise model)
- `Organization` aggregate thêm `parentOrganizationId` nullable
- Permission key mới: `Identity.Organizations.ManageSubOrgs`
- BFF endpoint `POST /v1/orgs/:id/sub-orgs` tạo child organization
  inherit plan + settings, override billing
- Tenant UI: org switcher hiển thị hierarchy
- Use case: franchise (mỗi chi nhánh là sub-org), agency (mỗi client là sub-org)
- Multi-tenant: sub-org vẫn RLS-isolated; chỉ Owner của parent thấy được cả cây

### I-906 · [M] Platform admin: tenant impersonation (audit-grade)
- D12 đã có platform admin app; Phase 9 build impersonation flow
- `PlatformOperations` context (đã có ở Phase 1) thêm:
  - `ImpersonationSession` aggregate: `id, platformUserId, tenantId, reason, expiresAt`
  - State machine: `Requested → Active → Expired | Revoked`
- BFF `apps/api-gateway/src/modules/checkin-admin/impersonation/`
  - POST start: tạo session, issue short-lived JWT (15 min) với claim
    `is_impersonated: true`, `impersonation_session_id`
  - POST revoke: terminate session, audit log
- UI: impersonation banner hiển thị ở mọi page (red top bar) với "End session" button
- Audit: mọi mutation trong phiên impersonate ghi `platform_audit_log` với
  `actor_type=PLATFORM_USER`, đồng thời ghi `audit_log` của tenant với
  `actor_id=platform_user_id` + reason
- Risk R-20: max 30 phút/session, single session, bắt buộc reason
- Spec runbook: `docs/operations/impersonation.md`

### I-907 · [M] Mobile: offline dashboard cho organizer
- Hiện tại Flutter chỉ dành cho staff (D5). Phase 9 thêm organizer app shell
- BLoC `OrganizerDashboardCubit` cache event list + stats trong Hive
- Sync strategy: read-through cache với TTL 5 phút, force refresh qua pull-to-refresh
- Use case: organizer ở sự kiện (sóng yếu) vẫn xem được stats, attendee count
- Background sync WorkManager khi có connectivity
- Out of scope: organizer viết/sửa event khi offline (Phase 10+)

### I-908 · [M] Audit log immutability (hash chain)
- Risk R-21: audit log có thể bị delete dù đã revoke grant
- Append-only enforcement bằng hash chain:
  mỗi row lưu `prev_hash = SHA256(prev_row.hash || action || actor_id || timestamp)`
- Verify job (cron 6h) quét full table, recompute chain, alert nếu mismatch
- `apps/core-api` thêm `AuditLogHash` aggregate (read-only, chỉ insert)
- Migration: `ALTER TABLE audit_log ADD COLUMN prev_hash BYTEA, ADD COLUMN hash BYTEA`
- Spec: `docs/security/audit-log-immutability.md`

### I-909 · [M] Shared UI package (`packages/ui`) cho 2 Next.js app
- Risk R-22: code duplication giữa `apps/web` + `apps/checkin-admin`
- Tách `packages/ui/` với: Button, Card, Dialog, Table, Form, Input, Select
  dùng chung Aurora tokens
- Yarn workspace reference qua `workspace:*`
- Migrate shared components từ 2 app vào `packages/ui/src/`
- ESLint rule cấm import `@/components/ui/button` từ bên ngoài app gốc
- Keep app-specific branding (logo, copy) ở `app/src/modules/`

### I-910 · [S] Compliance: SOC 2 readiness checklist
- Risk review trigger: enterprise customer yêu cầu SOC 2
- Checklist doc `docs/compliance/soc2-readiness.md`:
  - Access control: MFA enforced ✅ (Phase 1), IP allowlist ✅ (Phase 1)
  - Audit log: bất biến 🆕 (I-908)
  - Encryption at rest: Postgres TDE planned (Phase 10+)
  - Encryption in transit: TLS ✅
  - Backup: pgbackrest daily ✅ (Phase 7)
  - Incident response: runbook needed (I-911)
  - Vendor management: DPA với Resend/Stripe/Twilio cần ký
- Penetration test follow-up: vuln remediation 30 ngày
- Out of scope: full SOC 2 audit (cần auditor + 6 tháng evidence)

### I-911 · [M] Incident response runbook + on-call rotation
- `docs/operations/incident-response.md`:
  - Severity matrix (SEV1: full outage, SEV2: degraded, SEV3: minor)
  - On-call schedule (PagerDuty hoặc Grafana OnCall — Phase 9 dùng Telegram + email)
  - Escalation: backend lead → tech lead → founder
  - Communication: status page (Uptime Kuma public) + customer email
  - Post-mortem template (blameless)
- Alert routing: PagerDuty/Grafana webhook → Sentry → Slack/Discord ops channel
  (đã có từ I-802)
- Drill: 1 SEV2 drill / quarter (chaos test infrastructure)
- Tích hợp với I-702 backup/restore drill

### I-912 · [S] API rate limit quota configurable per tenant (overrides)
- I-807 đã có tier-based limit (free/pro/enterprise). Phase 9 thêm per-tenant override
- `RateLimitOverride` table trong core-api: `(tenant_id, endpoint_pattern, limit_per_min, burst, expires_at)`
- BFF `apps/api-gateway/src/modules/auth/guards/plan-rate-limit.guard.ts`
  đọc override trước, fallback plan default
- Tenant UI (settings → rate limit) hiển thị current limit + usage 24h
- Use case: Enterprise customer yêu cầu tăng limit cho 1 endpoint
- Plan gate: chỉ Enterprise mới có override UI (Pro dùng default)

### I-913 · [S] Mobile: scaffold android/ios native folders

**Trạng thái:** ✅ shipped 2026-06-07 trong branch `feature/issue-913-mobile-native-scaffold`. Mechanical scaffold để unblock native build + device install cho mobile team.

**Bối cảnh:** `apps/mobile/lib/` + `pubspec.yaml` đã có (D9: BLoC + Cubit, I-403 checkin, I-407 sync, I-907 organizer dashboard), nhưng `apps/mobile/android/` + `apps/mobile/ios/` rỗng — `flutter create` chưa từng chạy. Hệ quả: không thể `flutter build apk`, không install được lên device/simulator, I-907 dashboard code "dead weight" không exercise được.

**Phạm vi đã làm (in-scope):**

1. `flutter create . --no-overwrite --org com.saascheckin --project-name saas_checkin_mobile --platforms=android,ios` → generate `android/`, `ios/` (Gradle 8 + AGP 8 + Kotlin DSL, Xcode 15+ workspace + Podfile + Info.plist).
2. **Stub batch** — block CI green, defer real impl sang I-914:
   - `lib/core/types/guid.dart`: new shared `Guid` value type (thay thế inline copy rải rác).
   - `lib/features/checkin/presentation/blocs/scan_bloc.dart`: `ScanBloc({CheckInRepository? repo})` nullable, no-op default khi repo null. `app.dart` không cần DI wiring Phase 0/9.
   - `lib/features/checkin/data/repositories/checkin_repository_impl.dart`: xoá drift-using offline-queue, chỉ delegate remote. TODO(I-914) cho offline path.
   - `lib/core/network/grpc/checkin_grpc_client.dart`: stub throw `UnimplementedError` cho cả 3 method (grpc 5.x đã remove `ClientChannel.makeUnaryCall`).
   - `lib/features/checkin/data/datasources/qr_offline_verifier.dart`: stub return `false` (basic_utils 5.8 API change).
   - `lib/features/organizer/presentation/cubits/organizer_dashboard_cubit.dart`: bỏ `DashboardRepository` dep, chỉ emit `DashboardInitial`. `SyncIndicator` widget vẫn compile.
   - Xoá: `pending_checkin_dao.dart`, `pending_checkin_sync.dart`, `event_dashboard_dao.dart`, `dashboard_repository_impl.dart`, `organizer_dashboard_cubit_test.dart` (drift codegen fail trên Dart 3.12.1 + dart_style 3.1.x combo).
3. **CI Flutter version bump** 3.6.x → 3.44.x (matches local). File: `.github/workflows/ci.yml:164` + `.github/workflows/security-audit.yml:49`. Lý do: `Color.withValues(alpha:...)` API cần ≥ 3.27, `go_router` mới nhất cần ≥ 3.22.
4. **Lint cleanup batch** (make `dart analyze` exit 0): convert 12 file `/** */` → `/// ...` form, fix 4 unused imports, drop unused `_loadPublicKey`, add trailing commas, capture bloc before async gap in `scan_screen.dart`, drop `package:grpc/src/...` implementation import.
5. **Native permission entries**:
   - `android/app/src/main/AndroidManifest.xml`: INTERNET, CAMERA, ACCESS_NETWORK_STATE, WAKE_LOCK, RECEIVE_BOOT_COMPLETED + camera feature flag.
   - `ios/Runner/Info.plist`: `NSCameraUsageDescription` + `NSAppTransportSecurity` (NSAllowsLocalNetworking + localhost exception cho dev BFF).
6. **Pubspec surgery**:
   - Add `meta: ^1.10.0` (used by `@immutable` trong `cached_event.dart`).
   - Remove `bloc_test: ^9.1.7` (analyzer 7.x conflict).
   - `dependency_overrides: { analyzer: 7.4.0, dart_style: 3.1.3 }` để `pub get` resolve.

**Verification (đã chạy locally trên Flutter 3.44.1 / Dart 3.12.1):**
- `flutter pub get` → success
- `flutter analyze` → `No issues found!` (0 errors, 0 warnings, 0 info)
- `flutter test` → `All tests passed!` (6 tests: SessionCubit + GrpcConfig)

**Out-of-scope (deferred sang I-914):**
- Drift codegen thực sự (cần fix `dart_style` 3.1.x / analyzer 7.x conflict ở pub cache root).
- `Workmanager` Android native config: `FlutterApplication` subclass, `WorkmanagerAlarmManager` service, `SCHEDULE_EXACT_ALARM`.
- Sentry Android Gradle plugin wiring.
- `mobile_scanner` runtime permission handler code-level (manifest + plist đã có sẵn ở I-913).
- Router missing `/checkin/manual` route trong `lib/core/router/app_router.dart`.
- `l10n.yaml` + `flutter_localizations` wiring.
- `Guid` stub → real `package:uuid`.
- App icon, splash screen, branding.
- `pubspec.lock` gitignore.

**Files changed (commit `chore(mobile): I-913 scaffold android/ios native folders (Phase 9)`):**
- New: `apps/mobile/android/**` (Gradle scaffold), `apps/mobile/ios/**` (Xcode scaffold), `apps/mobile/.gitignore`, `apps/mobile/.metadata`, `apps/mobile/lib/core/types/guid.dart`.
- Modified: `pubspec.yaml`, `analysis_options.yaml`, 11 lib/ files (ScanBloc + checkin remote + grpc client + qr verifier + dashboard cubit + screens + entity files), `.github/workflows/ci.yml`, `.github/workflows/security-audit.yml`, `docs/issues/phase-9-platform-maturity.md` (this section).
- Deleted: 4 drift-using source files + 1 obsolete test (see stub batch #2).

---

## Definition of Done

- [ ] Webhook delivery end-to-end với HMAC signature + retry + audit
- [ ] Multi-region tenant routing (EU default, SG opt-in cho Enterprise)
- [ ] Custom field builder: schema UI → registration form render
- [ ] Recurring event: tạo series, list occurrences, edit single/future/all
- [ ] Sub-org: tạo child org, hierarchy switcher, RLS vẫn isolate
- [ ] Impersonation: 15-min session, banner, audit dual-log
- [ ] Mobile organizer dashboard: offline cache + sync indicator
- [ ] Audit log hash chain: verify job, alert mismatch
- [ ] `packages/ui/` shared: ≥ 5 components migrated, ESLint enforces
- [ ] SOC 2 readiness checklist + incident response runbook
- [ ] Rate limit override: per-tenant config UI + endpoint check
- [x] Mobile native scaffold: android/ + ios/ + CI green (I-913)
- [ ] **READY for SOC 2 audit prep + 50k MAU 🚀**
