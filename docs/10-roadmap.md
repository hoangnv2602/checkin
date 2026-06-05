# 10 · Lộ trình (16 tuần tới MVP)

> Timeline giả định 2–3 dev full-time. Điều chỉnh theo nguồn lực thực tế.

## Phase 0 — Nền tảng (Tuần 1)
Issues: [`phase-0-foundation.md`](./issues/phase-0-foundation.md)

- Khởi tạo monorepo (pnpm + turbo + melos + .NET SDK 10)
- CI matrix trên GH Actions
- docker-compose.dev
- Skeleton Next.js (tenant) / Next.js (checkin-admin) / NestJS / .NET Core 10 / Flutter — **5 app**
- Tạo 13 ADR (0001-0012 + 0013 .NET, 0014 checkin-admin)
- Hetzner project + 3 VPS đã provision
- Deploy đầu tiên lên staging, truy cập được qua HTTPS ở 3 domain: `web.*`, `admin.*`, `api.*`

**DoD:** `git clone` → `task dev:up` → 5 app chạy local. URL staging trả 200.

## Phase 1 — Identity & Tenancy (Tuần 2–3)
Issues: [`phase-1-identity.md`](./issues/phase-1-identity.md)

- .NET Core 10 Identity context (bounded-context module `IdentityModule`): `User`, `Organization`, `Membership`, `Role`
- .NET Core 10 **PlatformOperations context** (D12, ADR-0014): `PlatformUser`, `PlatformSession` (chưa cần `PlatformAuditEntry` ở Phase 1 — dùng `outbox_messages` tạm)
- NestJS auth module: issue/verify JWT, refresh rotation; authz ở core-api (D13)
- NestJS **checkin-admin auth module** (BFF): MFA TOTP, IP allowlist check
- `apps/checkin-admin` skeleton: login + MFA setup + 1 placeholder page
- Next.js (tenant): login, register, org switcher
- Postgres role `app_platform_owner` (BYPASSRLS) tạo ở migration đầu
- DB migrations qua `SaasCheckin.DbMigrator` + bật RLS + seed data
- Test pyramid: unit (xUnit) + e2e (Playwright) + architecture test (NetArchTest)

## Phase 2 — Event Management (Tuần 4–5)
Issues: [`phase-2-events.md`](./issues/phase-2-events.md)

- .NET Core 10 EventManagement context (`Event`, `Session`, `Venue`) + module `EventManagementModule`
- NestJS events module (proxy + cache)
- Next.js: dashboard CRUD event, form validate bằng zod
- Integration test gRPC cho event APIs

## Phase 3 — Ticketing & Đăng ký công khai (Tuần 6–7)
Issues: [`phase-3-ticketing.md`](./issues/phase-3-ticketing.md)

- .NET Core 10 Registration context (`TicketType`, `Order`, `Registration`) + module `RegistrationModule`
- `IPaymentProvider` + `StripePaymentAdapter` + `VnpayPaymentAdapter` (D4) trong `SaasCheckin.Infrastructure/Payments/`
- Stripe PaymentIntent + verify chữ ký webhook
- VNPay: verify IPN (`vnp_SecureHash` SHA512) + `dr` (refund)
- Next.js: trang event công khai + flow đăng ký với provider selector
- Worker sinh QR (BullMQ ở NestJS) → MinIO (dev) / S3 (prod)
- Gửi vé qua email (Resend) qua MassTransit consumer trong Notification context

## Phase 4 — Check-in Core (Tuần 8–10)  ← **Rủi ro cao**
Issues: [`phase-4-checkin.md`](./issues/phase-4-checkin.md)

- .NET Core 10 CheckIn context (`CheckInRecord` aggregate, `QrSignatureVerifier` service) + module `CheckInModule`
- NestJS realtime gateway (Socket.IO + Redis adapter)
- Flutter: UI scan + offline queue + sync
- Next.js: realtime dashboard
- Load test 1000 scan đồng thời / giây bằng k6
- Chaos test: redis down, db chậm

## Phase 5 — Billing & SaaS Layer (Tuần 11–12)
Issues: [`phase-5-billing.md`](./issues/phase-5-billing.md)

- .NET Core 10 Billing context (`Subscription`, `Plan`, `Invoice`) + module `BillingModule`
- Stripe subscription + webhook
- Tương đương VNPay subscription (nếu có ở VN)
- Plan enforcement (đếm event, đếm attendee)
- Next.js: trang billing, usage meter

## Phase 6 — Polish & Analytics (Tuần 13–14)
Issues: [`phase-6-polish.md`](./issues/phase-6-polish.md)

- Báo cáo: no-show, peak gate, time-to-checkin (qua read-model projection)
- Xuất CSV
- Audit log viewer (tenant scope ở `apps/web` settings; **platform scope ở `apps/checkin-admin` audit page**)
- **Super-admin full feature** (D12, ADR-0014): tenants list, suspend/refund, plan CRUD, impersonation, feature flags, global metrics dashboard, `PlatformAuditEntry` aggregate thay thế log tạm
- Rollout Sentry + OpenTelemetry cho tất cả service (5 service: web, checkin-admin, mobile, api-gateway, core-api)
- Docs: API reference (Scalar auto-gen), ops runbook

## Phase 7 — Beta & Hardening (Tuần 15–16)
Issues: [`phase-7-hardening.md`](./issues/phase-7-hardening.md)

- Security review (OWASP ASVS L2)
- Pen-test (cơ bản)
- Backup / restore drill
- Onboarding wizard cho org mới
- Submit App Store + Play Store

**Tổng: ~16 tuần để ra MVP production-ready.**

## Phụ thuộc giữa các phase

```
0 ─► 1 ─► 2 ─► 3 ─► 4 ─► 5 ─► 6 ─► 7
              │     │
              └──► 4 (Check-in có thể bắt đầu khi ticketing đã có registration)
```

Phase 4 là critical path. Phase 5 (billing) có thể chạy song song một phần với Phase 4 nếu có dev dành riêng.
