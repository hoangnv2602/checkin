# 01 · Kiến trúc

## Sơ đồ hệ thống

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│   ┌──────────────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│   │  Next.js 16.2        │ │ Next.js 16.2   │ │ Flutter (Mobile) │  │
│   │  apps/web            │ │ apps/checkin-admin│ │  - Gate Scan     │  │
│   │  - Organizer Admin   │ │ - Platform Owner│ │  - Offline-first │  │
│   │  - Public Pages      │ │ - Platform     │ │                  │  │
│   │  web.saas-checkin    │ │   Support      │ │                  │  │
│   │                      │ │ admin.saas-... │ │                  │  │
│   └──────────┬───────────┘ └───────┬────────┘ └────────┬─────────┘  │
└──────────────┼──────────────────────┼──────────────────┼────────────┘
               │ HTTPS / WSS          │ HTTPS            │ HTTPS / WSS
               │ (tenant JWT)         │ (checkin-admin JWT,│ (staff JWT)
               │                      │  no tenant claim)│
               ▼                      ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API GATEWAY (NestJS BFF)                        │
│   ┌────────────────────────┐    ┌─────────────────────────────┐     │
│   │ Tenant module          │    │ Super-admin module (NEW)    │     │
│   │ - JWT + RLS enforced   │    │ - JWT verify role           │     │
│   │ - gRPC client          │    │   `platform_owner/support/  │     │
│   │   service-account      │    │   engineer`                 │     │
│   │   `app_runtime`        │    │ - gRPC client               │     │
│   │ - Socket.IO + Redis    │    │   service-account           │     │
│   │ - BullMQ               │    │   `app_platform_owner`      │     │
│   │                        │    │   (BYPASSRLS, audit)        │     │
│   │  Port 3000             │    │  Cùng process, port 3000,   │     │
│   │                        │    │  namespace prefix /admin/   │     │
│   └────────────┬───────────┘    └──────────────┬──────────────┘     │
│                │ gRPC mTLS                      │ gRPC mTLS          │
│                │ (runtime sa)                   │ (platform sa)     │
└────────────────┼─────────────────────────────────┼──────────────────┘
                 ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  CORE DOMAIN (.NET Core 10, DDD layered)            │
│   Bounded Contexts:                                                │
│   • Identity & Tenancy      • Event Management                     │
│   • Registration & Ticketing• Check-in                             │
│   • Billing                 • Notification                         │
│   • PlatformOperations (NEW — aggregate cho checkin-admin workflow)  │
│   Expose: Application Services (Use Cases) + Domain Events          │
│   Switch connection string theo role:                              │
│     - app_runtime:    RLS enforced                                 │
│     - app_platform_owner: BYPASSRLS + ghi audit log row            │
└──────────────┬──────────────────────┬───────────────────────────────┘
               │                      │
        ┌──────▼──────┐        ┌──────▼──────┐
        │ PostgreSQL  │        │   Redis     │
        │ (2 roles)   │        │ cache+queue │
        │ app_runtime │        │ +pubsub     │
        │   RLS       │        │             │
        │ app_        │        │             │
        │  platform_  │        │             │
        │  owner      │        │             │
        │   BYPASSRLS │        │             │
        └─────────────┘        └─────────────┘
```

## Tại sao tách 2 backend

| Thành phần | Vai trò | Lý do tách |
|------------|---------|------------|
| **.NET Core 10 (DDD layered)** | Core domain, aggregate, invariant, domain event | Type-safe end-to-end (entity → EF Core → gRPC → TS client). Ecosystem DDD mạnh (MassTransit, MediatR, EF Core, Stateless). Base class tự code theo Vernon DDD + Clean Architecture. |
| **NestJS** | BFF/Gateway: tác vụ I/O (auth, websocket, job queue, bên thứ ba) | Node.js + TypeScript chia sẻ type với Next.js. Hệ sinh thái realtime (Socket.IO, BullMQ) mạnh nhất trong nhóm Node-based. |

> **Lưu ý về team size:** Nếu team < 3 dev, gộp lại — chỉ giữ .NET, NestJS trở thành gateway mỏng (chỉ auth + WS). Kế hoạch giả định scale production.

## Hợp đồng giao tiếp

- **Sync (request/response):** gRPC proto (ưu tiên) hoặc internal REST, mTLS giữa các service. Định nghĩa một lần ở `packages/proto/`, code-gen cho cả hai phía.
- **Async (event):** Domain event từ Core API publish lên **Redis Streams** (qua MassTransit transport) + **RabbitMQ** (cho cross-service integration event). NestJS subscribe và fanout cho worker notification/email.
- **Pattern Outbox:** Domain event được ghi vào bảng `outbox_messages` trong cùng transaction DB; `OutboxRelayService` (IHostedService trong `SaasCheckin.Infrastructure`) poll và publish lên broker. Đảm bảo at-least-once delivery kể cả khi broker chết tạm thời.

## Cross-cutting concern

- **Auth:** Custom JWT (RS256). Cùng library / keypair cho cả NestJS và .NET Core 10. Xem ADR-0004.
  - **Tenant audience** (`apps/web` + mobile): claim `{ sub, orgId, role, permissions[] }` — BFF map `orgId` → `app.current_tenant` qua interceptor, gRPC tới core-api bằng service-account `app_runtime`.
  - **Super-admin audience** (`apps/checkin-admin`): claim `{ sub, role: 'platform_owner'|'platform_support'|'platform_engineer', mfa: true }` — KHÔNG có `orgId`. BFF module `checkin-admin/` verify role + MFA, dùng service-account `app_platform_owner` (BYPASSRLS) gọi core-api qua gRPC channel riêng; mỗi mutation ghi `platform_audit_log` row.
- **Tenant context:** Mỗi request đến Core API được resolve tenant từ JWT claim → middleware set `ICurrentTenant` ambient scope → EF Core `TenantDbConnectionInterceptor` tự `set_config('app.current_tenant', ...)` mỗi connection open. RLS policy enforce cô lập. Request từ checkin-admin BFF bypass middleware, dùng `IPlatformContext` (chỉ set cho module PlatformOperations).
- **Logging:** `request_id` lan truyền end-to-end. Log bằng pino (NestJS) và Serilog (.NET), đẩy về Loki qua OpenTelemetry OTLP. Mọi checkin-admin mutation log thêm `actor_platform_user_id`, `target_tenant_id`, `action` cho forensic.
- **Tracing:** OpenTelemetry OTLP → Tempo/Jaeger.
- **Audit log bất biệt:** bảng `platform_audit_log` (append-only) ghi mọi checkin-admin action — không ai được xoá, không ai được update. RLS bypass chỉ áp dụng SELECT, không áp dụng DELETE/UPDATE.

## Topology triển khai

Xem [`09-devops.md`](./09-devops.md). Tóm tắt:

- 1 VPS `htz-app-1` (CCX23, 4 vCPU / 16GB): web, api-gateway, core-api, worker, reverse proxy, monitoring
- 1 VPS `htz-db-1` (CCX13, 2 vCPU / 8GB): postgres + redis
- 1 VPS `htz-staging-1` (CX22, 2 vCPU / 4GB): staging stack

## Vòng đời request (check-in điển hình)

```
1. Staff quét QR trong app Flutter
2. Flutter verify chữ ký Ed25519 offline (JWKS đã cache)
3. Flutter POST /v1/checkin/scan lên NestJS gateway
4. NestJS validate JWT, set tenant_id, gọi Core API qua gRPC: CheckInService.Scan
5. .NET Core 10 (CheckIn bounded context):
   - Re-verify chữ ký QR
   - Load Registration aggregate
   - Áp CanCheckInSpecification
   - Ghi CheckInRecord (unique constraint trên (registration_id) WHERE status='success')
   - Ghi outbox event AttendeeCheckedIn
6. Outbox relay publish event lên Redis Stream
7. NestJS subscriber broadcast tới WebSocket namespace event:{eventId}:checkin
8. Web dashboard (Next.js) cập nhật biểu đồ realtime
9. Trả 200 cho Flutter; mobile xoá khỏi offline queue
```
