# 02 · Tech Stack

## Web framework — Next.js 16.2.x

> Có **2 app Next.js** trong monorepo: `apps/web` (tenant-facing) và `apps/checkin-admin` (platform-facing). Cùng version, cùng pattern, nhưng tách project, tách domain, tách audience. ADR: [`0014-checkin-admin-app.md`](./adr/0014-checkin-admin-app.md).

### `apps/web` — Tenant-facing (Organizer + Public)

- App Router + React Server Components
- **Tổ chức code: feature module** (D10) — xem layout `apps/web/src/modules/<module>/` trong `03-monorepo.md`
- **UI: Tailwind 4 + shadcn/ui + Radix primitive** — mọi component shadcn cài qua `yarn dlx shadcn@latest add …` (D11)
- **Design system: custom palette "Aurora"** (D11) — primary Electric Indigo + accent Sunset Coral. Không dùng class palette Tailwind mặc định trong code; chỉ dùng semantic token. Xem `docs/design-system.md`.
- TanStack Query cho client-side server state; RSC cho initial load
- Socket.IO client cho dashboard realtime
- react-hook-form + zod (zod schema share với NestJS qua OpenAPI codegen)
- Zustand cho cross-component UI state (sidebar, theme); per-feature state nằm trong store của module
- next-intl cho i18n (EN/VI/JP ở MVP)
- framer-motion cho page transition / micro-interaction

### `apps/checkin-admin` — Platform-facing (SaaS owner / support / engineer)

- Cùng Next.js 16.2.x + App Router + RSC
- Cùng design system Aurora + shadcn CLI (`yarn dlx shadcn@latest add ...`) — chỉ token color copy từ `apps/web/src/app/globals.css`, **component UI duplicate** (không share `apps/web/src/components/ui/` qua TS path alias — 2 audience, 2 security boundary, 2 release cadence)
- **Không có** Socket.IO, không realtime dashboard
- **Không có** Socket.IO / i18n (MVP chỉ EN); không cần public pages
- **Auth bắt buộc MFA** (TOTP) — enforced ở login
- TanStack Query + react-hook-form + zod (giống `apps/web`)
- Zustand cho UI state local
- Module structure giống D10: `apps/checkin-admin/src/modules/<area>/` (vd `modules/tenants/`, `modules/billing-ops/`, `modules/audit/`)

**Lý do tách app:** Xem ADR-0014. Tóm tắt:
- **Security boundary rõ ràng:** nếu `apps/web` bị XSS, attacker không tự động có quyền checkin-admin. Hai cookie domain khác nhau, hai JWT signing key audience khác nhau (`aud: 'web'` vs `aud: 'checkin-admin'`), hai deployment riêng.
- **Release độc lập:** update UI tenant không ảnh hưởng checkin-admin (và ngược lại). Platform owner muốn ship audit log viewer gấp không cần chờ release tenant.
- **BFF module tách:** `apps/api-gateway/src/modules/checkin-admin/` có service-account `app_platform_owner` riêng, không trộn với tenant service-account. RLS bypass chỉ active trong scope này.
- **Scale độc lập:** traffic checkin-admin thấp (vài user), không cần scale chung với tenant traffic.
- **Audit forensic dễ:** mọi mutation từ checkin-admin đi qua module gRPC riêng, dễ alert + dashboard.

**Trade-off chấp nhận:** duplicate `components/ui/` (~30 file shadcn), duplicate Aurora tokens CSS. Giảm thiểu bằng cách có thể share qua `packages/ui/` ở Phase 6+ nếu duplication trở thành gánh nặng (revisit tại risk #18).

**Lý do chọn Next.js chung (không Remix / Nuxt):** Hệ sinh thái lớn nhất cho dashboard React; RSC giảm bundle JS cho trang marketing/public; Tailwind 4 + shadcn unblock iteration nhanh. **Feature module** giữ codebase dễ navigate khi vượt 5 feature và cho dev mới own trọn một module. **Palette Aurora tùy chỉnh** giữ brand nhất quán và sẵn sàng cho dark mode; **shadcn CLI** giữ component dễ upgrade.

## Mobile — Flutter 3.6.x

- **State management: BLoC + Cubit** (D9) — Cubit cho state đơn giản (vd: form state, toggle), full BLoC cho flow event-driven (vd: `ScanBloc`: `QrDetected` → `Verifying` → `Accepted` | `Rejected`)
- go_router cho navigation
- dio + retrofit (codegen từ OpenAPI)
- drift (SQLite) cho offline queue
- mobile_scanner cho QR
- flutter_secure_storage cho token
- workmanager + connectivity_plus cho background sync
- sentry_flutter cho crash reporting
- posthog_flutter cho product analytics
- equatable cho BLoC state equality
- bloc_test cho unit test

**Lý do:** Một codebase ship cả iOS + Android. drift + workmanager là combo đáng tin cậy nhất cho mobile offline-first. BLoC là pattern Flutter de-facto cho app event-driven: tách rõ intent (event) khỏi state, test ergonomics tốt với `bloc_test`, xử lý async tường minh. Cubit là biến thể nhẹ cho case không cần full event stream.

## BFF / API Gateway — NestJS 11.x

- Module: auth, events, realtime, billing, jobs
- REST controller + OpenAPI decorator → auto-gen spec
- Socket.IO với Redis adapter cho horizontal scale
- BullMQ (Redis-backed) cho background job (email, QR pdf, webhook)
- gRPC client (proto ở `packages/proto/`) để gọi Core API
- Custom JWT verify (RS256, keypair với .NET, xem [ADR-0004](./adr/0004-auth-custom-jwt.md)) — **không dùng Passport, không dùng NextAuth** (CLAUDE.md rule #5)
- Pino logger
- class-validator + class-transformer cho DTO validation

**Lý do:** TypeScript end-to-end với web (không có impedance mismatch). Hệ sinh thái realtime + queue tốt nhất. Authz ủy quyền hoàn toàn cho core-api (xem [ADR-0015](./adr/0015-rbac-hybrid-permissions.md) — BFF chỉ làm authn).

## Core domain — .NET Core 10 (DDD layered, custom base class)

> Chi tiết layout + building block: [`docs/api/`](./api/README.md). ADR chính: [`adr/0013-dotnet-core-10-ddd.md`](./adr/0013-dotnet-core-10-ddd.md).

- **.NET 10** (C# 14), nullable reference types, Roslyn analyzers
- **EF Core 10** + `Pomelo.EntityFrameworkCore.PostgreSQL` provider
- **Custom DDD base class** (AggregateRoot, ValueObject, IRepository, IUnitOfWork, IBoundedContextModule, ICurrentTenant) trong `shared/Shared.*`
- **MediatR 12** (in-process CQRS / domain event handler)
- **MassTransit 8** + **RabbitMQ** (distributed event bus + outbox relay)
- **FluentValidation 11** + **Mapster 7**
- **Stateless 5** (state machine cho event status, registration status, subscription state)
- **ASP.NET Core Authentication** + custom JWT handler (`Microsoft.IdentityModel.JsonWebTokens`, RS256)
- **gRPC server** qua `Grpc.AspNetCore.Server` + `Grpc.Tools` (build-time codegen từ `packages/proto/`)
- **Serilog** + **OpenTelemetry .NET SDK** → OTLP → Loki/Tempo
- **Scalar** (OpenAPI 3.1 UI; thay Swagger UI)
- **AspNetCore.HealthChecks** (DB, Redis, RabbitMQ, gRPC)
- **xUnit + FluentAssertions + Testcontainers + NetArchTest** (architecture test enforce layering)
- **Docker multi-stage** với `mcr.microsoft.com/dotnet/{sdk,aspnet}:10.0-alpine`

**Lý do:** Type-safe end-to-end (entity → EF Core → gRPC → TS client). Ecosystem DDD mạnh (MassTransit outbox, MediatR pipeline, EF Core, Stateless). Base class tự code theo Vernon DDD tactical + Clean Architecture (HTTP host / Application / Domain / Infrastructure tách lớp rõ). BFF NestJS vẫn gọi core qua gRPC — pattern BFF + core tách rõ không thay đổi.

**Hai Postgres role cho hai audience:**
- `app_runtime` — role cho tenant request, RLS bật, `app.current_tenant` set qua `TenantDbConnectionInterceptor` (D1).
- `app_platform_owner` — role cho checkin-admin request, `BYPASSRLS`, không qua tenant interceptor. Mọi mutation ghi `platform_audit_log` (append-only, RLS vẫn bật cho role này trên table này). `SaasCheckin.HttpApi.Host` chọn connection string dựa trên gRPC credential metadata `x-platform-role: true`.

## Database — PostgreSQL 16

- **Row-Level Security (RLS)** cho cô lập tenant — mỗi request set `app.tenant_id` qua `SET LOCAL`
- UUID primary key (`gen_random_uuid()` từ pgcrypto)
- `CITEXT` cho email không phân biệt hoa/thường
- `JSONB` cho payload linh hoạt (QR payload, client_meta)
- Partial unique index (vd: một check-in `success` cho mỗi registration)
- Extension: `pgcrypto`, `citext`, `pg_stat_statements`

**Lý do:** RDBMS trưởng thành nhất cho OLTP. RLS được enforce ở DB level — kể cả bug trong app code cũng không leak chéo tenant.

## Cache / Queue / PubSub — Redis 7

Dùng cho:
- JWT refresh token + blacklist (`sess:{tokenId}`)
- Counter rate limit (`rl:{ip}:{route}:{window}`)
- BullMQ job queue
- Domain event stream (Streams API, không phải Pub/Sub — Streams có replay)
- Socket.IO adapter (cross-instance fanout)
- Hot read cache (`event:{id}:summary`, TTL 5m)
- Chống replay QR (`qr:{sig}:{gateId}` SETNX, TTL 2s)

**Lý do:** Một công nghệ cho nhiều nhu cầu I/O; giảm bề mặt vận hành so với Kafka/RabbitMQ ở tải MVP.

## Contracts — gRPC + OpenAPI 3.1

- `packages/proto/` — file `.proto`; buf CLI cho lint + gen
- `packages/contracts/openapi.json` — auto-gen từ NestJS
- `openapi-typescript` → TS client cho Next.js
- `openapi-generator-cli` → Dart client cho Flutter
- CI fail khi OpenAPI diff breaking change trừ khi bump version

**Lý do:** Hợp đồng strongly-typed bắt mismatch tại build time. Code-gen loại bỏ lỗi dịch thủ công.

## Hạ tầng — On-prem / VPS (Hetzner)

- **App node** Hetzner CCX23 (4 vCPU / 16GB / NVMe)
- **DB node** Hetzner CCX13 (2 vCPU / 8GB / NVMe) — Postgres + Redis
- **Staging** Hetzner CX22 (2 vCPU / 4GB)
- **Backup** Hetzner Storage Box (1TB)
- **Reverse proxy** Caddy (auto HTTPS qua Let's Encrypt)
- **Orchestration** Docker Compose (không Kubernetes ở MVP)
- **Provisioning** Ansible playbook
- **CI/CD** GitHub Actions → image GHCR → deploy qua SSH
- **Monitoring** self-hosted: Uptime Kuma + Grafana + Loki + Promtail
- **CDN/WAF** Cloudflare (free tier ban đầu)

**Lý do:** Chi phí thấp nhất (~120 USD/tháng so với ~290 USD cho managed cloud). Data residency ở EU. Dễ migrate AWS/GCP sau — container portable. Đánh đổi: nhiều công sức vận hành hơn, một region.

Kế hoạch deploy đầy đủ: [`09-devops.md`](./09-devops.md).

## Observability

- **Logs:** pino (NestJS) + Serilog (.NET Core 10) → OpenTelemetry OTLP → Loki
- **Metrics:** Prometheus + Grafana
- **Tracing:** OpenTelemetry OTLP → Tempo
- **Errors:** Sentry (web, mobile, api-gateway, core-api)
- **Alert:** Alertmanager → Telegram/Discord

## Chính sách version

- Pin minor version trong `package.json` / `pubspec.yaml` / `Directory.Packages.props` (.NET Central Package Management)
- Dùng Renovate hoặc Dependabot để bump hàng tuần
- LTS-first: ưu tiên version còn ≥ 6 tháng hỗ trợ
