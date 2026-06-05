# 06 · Thiết kế API

Ba bề mặt API:

1. **REST tenant công khai** — NestJS expose cho `apps/web` + Flutter. Path prefix `/v1/...`. Auto-gen OpenAPI 3.1.
2. **REST checkin-admin** — NestJS expose cho `apps/checkin-admin`. Path prefix `/v1/admin/...`. Audience `platform_owner|platform_support|platform_engineer`. JWT có `aud: 'checkin-admin'`. KHÔNG dùng chung middleware auth với tenant; KHÔNG có rate-limit per-IP (chỉ per-user).
3. **gRPC nội bộ** — giữa NestJS (api-gateway) và .NET Core 10 Core API (`SaasCheckin.HttpApi.Host`). mTLS. Hai service-account riêng: `app_runtime` (cho tenant) và `app_platform_owner` (cho checkin-admin, BYPASSRLS).

Không dùng GraphQL. (D7)

---

## 1. REST công khai (NestJS)

Mọi endpoint yêu cầu:
- `Authorization: Bearer <jwt>` (trừ endpoint public + auth)
- `X-Request-Id: <uuid>` (tự sinh nếu thiếu)
- `X-Tenant-Id: <uuid>` (gateway set từ JWT claim, không trust từ client)

Version ở path: `/v1/...`

### Auth

```
POST   /v1/auth/login                 -- {email, password, orgSlug} → {accessToken, refreshToken}
POST   /v1/auth/refresh               -- {refreshToken} → {accessToken, refreshToken}
POST   /v1/auth/logout                -- {refreshToken} → 204
POST   /v1/auth/forgot-password
POST   /v1/auth/reset-password
```

### Organizations (chỉ Owner)

```
POST   /v1/orgs                                  -- tạo tenant + owner đầu tiên
GET    /v1/orgs                                  -- list org user là member
GET    /v1/orgs/{orgId}
PATCH  /v1/orgs/{orgId}
GET    /v1/orgs/{orgId}/members
POST   /v1/orgs/{orgId}/invitations
DELETE /v1/orgs/{orgId}/members/{userId}
```

### Events

```
GET    /v1/orgs/{orgId}/events                  -- ?status=&page=&limit=
POST   /v1/orgs/{orgId}/events
GET    /v1/events/{eventId}
PATCH  /v1/events/{eventId}
DELETE /v1/events/{eventId}
POST   /v1/events/{eventId}/publish
POST   /v1/events/{eventId}/cancel
GET    /v1/events/{eventId}/stats
```

### Ticket types

```
GET    /v1/events/{eventId}/ticket-types
POST   /v1/events/{eventId}/ticket-types
PATCH  /v1/ticket-types/{id}
DELETE /v1/ticket-types/{id}
```

### Public (không cần auth)

```
GET    /v1/public/events/{slug}                 -- landing event
POST   /v1/public/events/{slug}/register        -- tạo registration, trả về order
POST   /v1/public/orders/{orderId}/pay          -- {provider: "stripe"|"vnpay"} → checkoutUrl
GET    /v1/public/payment/{orderId}/return      -- landing redirect trình duyệt (VNPay)
GET    /v1/public/registrations/{regId}/ticket  -- hiện QR cho attendee
```

### Check-in

```
POST   /v1/checkin/scan              -- {qrPayload, gateId, deviceMeta}
POST   /v1/checkin/manual            -- {registrationId, gateId, reason}
POST   /v1/checkin/{id}/undo         -- chỉ owner, có audit log
GET    /v1/events/{eventId}/checkin  -- list phân trang
```

### Realtime

```
WS     /v1/realtime?eventId=...      -- namespace Socket.IO; emit event checkin
```

### Billing

```
POST   /v1/billing/checkout                  -- {orderId, provider}
POST   /v1/billing/webhook/stripe            -- Stripe → mình
POST   /v1/billing/webhook/vnpay             -- VNPay IPN → mình
GET    /v1/billing/subscription
GET    /v1/billing/invoices
```

### Health

```
GET    /healthz          -- liveness
GET    /readyz           -- readiness (check DB + Redis)
```

### Super-admin (audience `apps/checkin-admin` qua `apps/checkin-admin` cookie domain)

```
POST   /v1/admin/auth/login                  -- {email, password, totp} → {accessToken, refreshToken, mfaRequired: false}
POST   /v1/admin/auth/refresh                -- {refreshToken} → {accessToken, refreshToken}
POST   /v1/admin/auth/logout
GET    /v1/admin/me                          -- profile platform user

# Tenants (cross-tenant query — KHÔNG enforce tenant filter)
GET    /v1/admin/tenants                     -- ?status=&plan=&q=&page=&limit=
GET    /v1/admin/tenants/{tenantId}          -- chi tiết
POST   /v1/admin/tenants/{tenantId}/suspend  -- {reason} — ghi platform_audit_log
POST   /v1/admin/tenants/{tenantId}/reactivate
GET    /v1/admin/tenants/{tenantId}/events
GET    /v1/admin/tenants/{tenantId}/members
GET    /v1/admin/tenants/{tenantId}/billing
GET    /v1/admin/tenants/{tenantId}/usage    -- events, registrations, MAU trong kỳ

# Subscriptions (cross-tenant)
GET    /v1/admin/subscriptions               -- ?status=&plan=&page=
GET    /v1/admin/subscriptions/{id}
POST   /v1/admin/subscriptions/{id}/refund   -- {amount, reason} — gọi Stripe refund
POST   /v1/admin/subscriptions/{id}/cancel
POST   /v1/admin/subscriptions/{id}/extend-trial -- {days}

# Plans
GET    /v1/admin/plans
POST   /v1/admin/plans
PATCH  /v1/admin/plans/{id}

# Impersonation (audit bắt buộc, max 30 phút, single session)
POST   /v1/admin/impersonate                 -- {tenantId, userId, reason} → trả URL redirect kèm short-lived tenant JWT
GET    /v1/admin/impersonate/active          -- session impersonation hiện tại
DELETE /v1/admin/impersonate                 -- kết thúc sớm

# Audit
GET    /v1/admin/audit                       -- ?actor=&tenant=&action=&from=&to= — paginated
GET    /v1/admin/audit/{id}                  -- chi tiết payload

# Feature flags
GET    /v1/admin/feature-flags
PATCH  /v1/admin/feature-flags/{key}         -- {enabled, rolloutPercent, allowlistTenantIds[]}

# Global metrics
GET    /v1/admin/metrics/overview            -- {mau, mrr, arr, churn, activeEvents}
GET    /v1/admin/metrics/timeseries          -- ?metric=mau&from=&to=&granularity=day
```

> **Auth khác tenant:**
> - JWT claim `{ sub, role: 'platform_owner'|'platform_support'|'platform_engineer', aud: 'checkin-admin', mfa: true, exp }`
> - **KHÔNG có** `orgId` claim
> - **MFA TOTP bắt buộc** (`mfa: true` claim chỉ set sau khi verify TOTP). Session mà thiếu MFA bị reject ở mọi endpoint ngoài `/v1/admin/auth/*`
> - Refresh token 8h (so với tenant 30 ngày)
> - IP allowlist optional (config trong env)
>
> **Audit policy:**
> - Mọi `POST/PATCH/DELETE` qua `/v1/admin/*` ghi 1 row `platform_audit_log` (trigger Postgres + middleware .NET). Không có exempt.
> - `app_platform_owner` không có grant UPDATE/DELETE trên `platform_audit_log` (kể cả role có BYPASSRLS).

### Abstraction payment provider

```ts
// apps/api-gateway/src/modules/billing/payments/payment-provider.interface.ts
export interface PaymentProvider {
  readonly name: 'stripe' | 'vnpay';
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyWebhook(headers: Record<string,string>, body: unknown): Promise<WebhookEvent>;
  cancelOrder(orderId: string): Promise<void>;
  refund(paymentId: string, amount: Money): Promise<RefundResult>;
}
```

Hai adapter: `StripeAdapter` (PaymentIntent + Webhook) và `VnpayAdapter` (VNPay API + IPN verify). Bảng `payments` lưu `provider` enum; webhook router dispatch theo provider. Mỗi tenant cấu hình default + enabled providers trong `org_settings`.

### Format response lỗi chuẩn

```json
{
  "error": {
    "code": "registration_already_checked_in",
    "message": "This QR code has already been used for check-in.",
    "details": { "checkInId": "uuid", "at": "2026-06-04T08:30:00Z" },
    "requestId": "uuid"
  }
}
```

Mapping HTTP status:
- 400 validation
- 401 missing/expired token
- 403 sai role / tenant
- 404 not found
- 409 conflict (duplicate, already used)
- 422 vi phạm business rule
- 429 rate limited
- 5xx internal

### Luồng auth

- **Access token:** JWT RS256, 15 phút, claims: `sub`, `orgId`, `role`, `permissions[]`
- **Refresh token:** opaque, lưu Redis (`rt:{tokenId}`), 30 ngày, xoay mỗi lần dùng
- **Mobile (Flutter):** secure storage + biometric reauth
- **mTLS nội bộ:** gRPC NestJS ↔ .NET Core 10 dùng service-account JWT, không có user context

### Chống giả mạo QR

- Payload: `{regId, eventId, issuedAt, exp, jti}`
- Ký bằng **Ed25519**, key theo tenant, xoay mỗi 6 tháng
- Mobile verify offline bằng JWKS cache
- Server re-verify + check JTI uniqueness mỗi lần scan

---

## 2. gRPC nội bộ (NestJS ↔ .NET Core 10)

> Service host: `SaasCheckin.HttpApi.Host` (Kestrel + Grpc.AspNetCore). File proto ở `packages/proto/`. .NET sinh code tự động qua `Grpc.Tools` từ `.csproj` (vd `<Protobuf Include="Protos\checkin.proto" GrpcServices="Server" />`). NestJS dùng `@grpc/grpc-js` với proto file shared, không thay đổi.
>
> **Hai gRPC channel** (cùng server, hai service-account khác nhau):
> - **Tenant channel** (`apps/api-gateway/src/infra/grpc/tenant-client.ts`) — dùng service-account JWT `aud: 'core-api'`, scope `app_runtime`. Set gRPC metadata `x-tenant-id`, `x-user-id`, `x-request-id`. .NET middleware resolve → `ICurrentTenant` → RLS.
> - **Platform channel** (`apps/api-gateway/src/modules/checkin-admin/platform-grpc.client.ts`) — dùng service-account JWT `aud: 'core-api-platform'`, scope `app_platform_owner`. Set metadata `x-platform-role: true`, `x-platform-user-id`, `x-request-id`, `x-platform-action`. .NET middleware bypass RLS, ghi `platform_audit_log` qua trigger.

```proto
syntax = "proto3";
package checkin.core.v1;

service CheckInService {
  rpc Scan(ScanRequest) returns (ScanResponse);
  rpc GetEventStats(GetEventStatsRequest) returns (EventStats);
  rpc UndoCheckIn(UndoRequest) returns (UndoResponse);
  rpc ListCheckIns(ListRequest) returns (ListResponse);
}

message ScanRequest {
  string tenant_id = 1;
  string event_id = 2;
  string gate_id = 3;
  bytes  qr_signature = 4;
  string qr_payload_json = 5;
  DeviceMeta device = 6;
  string actor_user_id = 7;       // từ JWT
}

message ScanResponse {
  enum Outcome { SUCCESS DUPLICATE REJECTED }
  Outcome outcome = 1;
  string registration_id = 2;
  string attendee_name = 3;
  string reason = 4;             // cho REJECTED
  google.protobuf.Timestamp scanned_at = 5;
}

message DeviceMeta {
  string device_id = 1;
  string platform = 2;           // ios|android
  string app_version = 3;
  optional string geo_lat = 4;
  optional string geo_lng = 5;
}
```

Proto file ở `packages/proto/`. CI chạy `buf lint` + `buf generate`.

---

## 3. Contract testing

- Với REST: NestJS OpenAPI diff trên mỗi PR (không breaking change trừ khi bump version)
- Với gRPC: **Buf breaking** change detection trong CI
- Consumer test trong NestJS cho mỗi RPC dùng .NET Core 10 server fake (chạy `SaasCheckin.HttpApi.Host` ở Testcontainer)
