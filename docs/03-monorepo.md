# 03 · Cấu trúc Monorepo

## Tooling

- **Node** 22 (quản lý qua `.nvmrc`)
- **pnpm** 9 + workspaces
- **Turborepo** cho task graph + caching
- **.NET** 10 SDK (quản lý qua `apps/core-api/global.json`)
- **Dart** 3.6
- **Melos** cho Dart monorepo
- **Docker** 24+ cho hạ tầng dev
- **Task** (go-task) cho dev script

## Cây thư mục

```
saas-checkin/
├── apps/
│   ├── web/                       # Next.js 16.2.x — TENANT (organizer + public, D10 + D11)
│   │   ├── src/                    # TOÀN BỘ source code nằm ở đây
│   │   │   ├── app/                # Route Next.js (shell mỏng, import từ src/modules/)
│   │   │   │   ├── globals.css     # Biến CSS Aurora
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── (marketing)/
│   │   │   │   │   ├── page.tsx    # → re-export <LandingPage /> từ src/modules/marketing
│   │   │   │   │   └── pricing/page.tsx
│   │   │   │   ├── (auth)/         # Login, register
│   │   │   │   ├── (dashboard)/    # Organizer admin
│   │   │   │   │   └── [orgSlug]/
│   │   │   │   │       ├── layout.tsx
│   │   │   │   │       ├── page.tsx
│   │   │   │   │       ├── events/[[...rest]]/page.tsx
│   │   │   │   │       ├── members/page.tsx
│   │   │   │   │       ├── billing/page.tsx
│   │   │   │   │       └── settings/page.tsx
│   │   │   │   ├── (public)/       # Trang event công khai
│   │   │   │   │   └── e/[slug]/
│   │   │   │   └── api/
│   │   │   │       └── webhook/
│   │   │   │           ├── stripe/route.ts
│   │   │   │           └── vnpay/route.ts
│   │   │   ├── components/         # UI primitive cross-module
│   │   │   │   └── ui/             # component shadcn (CLI install qua yarn dlx shadcn@latest add)
│   │   │   │       ├── button.tsx
│   │   │   │       ├── card.tsx
│   │   │   │       ├── dialog.tsx
│   │   │   │       ├── input.tsx
│   │   │   │       └── ...          # tất cả component shadcn
│   │   │   ├── lib/                # utility cross-module
│   │   │   │   ├── utils.ts        # shadcn cn() helper (CLI-managed)
│   │   │   │   ├── date.ts         # helper date-fns
│   │   │   │   ├── format.ts       # format number/currency
│   │   │   │   ├── validate.ts     # zod schema dùng chung
│   │   │   │   └── permissions.ts  # helper check role
│   │   │   └── modules/            # Feature module (D10)
│   │   │       ├── <module>/
│   │   │       │   ├── components/   # <Entity>Xxx.tsx, <Module>Xxx.tsx, index.ts
│   │   │       │   ├── hooks/        # use<Entities>.ts + index.ts
│   │   │       │   ├── schemas/      # <entity>.schema.ts + index.ts
│   │   │       │   ├── services/     # <entities>Api.ts + index.ts
│   │   │       │   ├── types/        # <entity>.ts + index.ts
│   │   │       │   └── index.ts      # barrel top-level (public API)
│   │   │       ├── marketing/      # Trang landing, pricing
│   │   │       ├── auth/           # Login, register, password reset
│   │   │       ├── events/         # CRUD event (phía organizer)
│   │   │       ├── checkin/        # Realtime dashboard
│   │   │       ├── registration/   # Trang event công khai + flow đăng ký
│   │   │       ├── billing/        # Subscription + invoice
│   │   │       ├── members/        # Quản lý member org
│   │   │       ├── settings/
│   │   │       ├── notifications/
│   │   │       └── _shared/        # primitive cross-module (KHÔNG có ui/ — cái đó ở src/components/ui)
│   │   │           ├── api/        # fetch client + query factory
│   │   │           ├── config/     # env, route
│   │   │           └── providers/  # provider cấp app
│   │   ├── public/                 # asset tĩnh (ở root, KHÔNG trong src/)
│   │   ├── components.json         # cấu hình shadcn (D11)
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json           # path alias: @/* → src/*
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── mobile/                    # App Flutter — BLoC + Cubit (D9)
│   │   ├── lib/
│   │   │   ├── main.dart
│   │   │   ├── app.dart           # MaterialApp.router + MultiBlocProvider
│   │   │   ├── core/              # hạ tầng cross-feature
│   │   │   │   ├── http/          # dio client, interceptor
│   │   │   │   ├── storage/       # secure_storage, drift
│   │   │   │   ├── auth/          # JWT in-memory, refresh interceptor
│   │   │   │   ├── realtime/      # socket.io client
│   │   │   │   ├── telemetry/     # sentry + posthog
│   │   │   │   ├── theme/
│   │   │   │   └── di/            # service_locator (get_it) — provider, bloc
│   │   │   ├── router.dart        # GoRouter
│   │   │   └── features/          # Feature-first, BLoC layer
│   │   │       ├── auth/
│   │   │       │   ├── data/
│   │   │       │   │   ├── datasources/      # AuthRemoteDataSource
│   │   │       │   │   ├── models/           # UserDto, AuthResponseDto
│   │   │       │   │   └── repositories/     # AuthRepositoryImpl
│   │   │       │   ├── domain/
│   │   │       │   │   ├── entities/         # User, Session
│   │   │       │   │   ├── repositories/     # AuthRepository (interface)
│   │   │       │   │   └── usecases/         # Login, Logout, RefreshToken
│   │   │       │   └── presentation/
│   │   │       │       ├── blocs/            # AuthBloc, SessionCubit
│   │   │       │       ├── screens/          # LoginScreen
│   │   │       │       └── widgets/
│   │   │       ├── checkin/        # scan + offline queue
│   │   │       │   ├── data/
│   │   │       │   │   ├── datasources/      # CheckInRemoteDataSource, PendingCheckInLocalDataSource (drift)
│   │   │       │   │   ├── models/
│   │   │       │   │   └── repositories/
│   │   │       │   ├── domain/
│   │   │       │   │   ├── entities/         # QrPayload, CheckInResult, PendingCheckIn
│   │   │       │   │   ├── repositories/     # CheckInRepository
│   │   │       │   │   └── usecases/         # ScanQr, ManualCheckIn, SyncPending
│   │   │       │   └── presentation/
│   │   │       │       ├── blocs/            # ScanBloc, SyncBloc, ScanResultCubit
│   │   │       │       ├── screens/          # ScanScreen, ManualCheckInScreen, HistoryScreen
│   │   │       │       └── widgets/          # ScanResultOverlay
│   │   │       ├── events/
│   │   │       └── profile/
│   │   ├── packages/              # local package Melos
│   │   │   ├── core_models/       # Dart model chia sẻ
│   │   │   └── design_system/
│   │   ├── test/
│   │   │   └── features/checkin/blocs/scan_bloc_test.dart   # bloc_test
│   │   ├── pubspec.yaml
│   │   └── melos.yaml             # cấu hình local
│   │
│   ├── api-gateway/               # NestJS (BFF)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/          # JWT, refresh rotation; authz ở core-api (D13)
│   │   │   │   ├── events/        # proxy + cache
│   │   │   │   ├── realtime/      # Socket.IO gateway
│   │   │   │   ├── billing/       # Adapter Stripe + VNPay
│   │   │   │   ├── jobs/          # BullMQ worker
│   │   │   │   ├── checkin-admin/   # Module riêng cho platform owner (D12, ADR-0014)
│   │   │   │   │   ├── admin-auth.guard.ts  # check role platform_*
│   │   │   │   │   ├── platform-tenant.controller.ts
│   │   │   │   │   ├── platform-subscription.controller.ts
│   │   │   │   │   ├── platform-audit.controller.ts
│   │   │   │   │   ├── platform-impersonation.service.ts
│   │   │   │   │   └── platform-grpc.client.ts # gRPC channel riêng dùng service-account app_platform_owner
│   │   │   │   └── health/
│   │   │   ├── infra/
│   │   │   │   ├── grpc/          # gRPC client tới core-api (tenant)
│   │   │   │   ├── redis/
│   │   │   │   ├── db/             # read-only DB nếu cần
│   │   │   │   └── logger/
│   │   │   └── common/
│   │   │       ├── filters/
│   │   │       ├── interceptors/
│   │   │       └── decorators/
│   │   ├── test/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── Dockerfile
│   │
│   ├── checkin-admin/               # Next.js — Platform Owner / Support / Engineer (D12)
│   │   ├── src/
│   │   │   ├── app/               # route Next.js (shell mỏng)
│   │   │   │   ├── globals.css    # copy Aurora tokens từ apps/web (KHÔNG share)
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   └── mfa-setup/page.tsx
│   │   │   │   ├── (dashboard)/   # sau khi login + MFA
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx                  # overview
│   │   │   │   │   ├── tenants/page.tsx
│   │   │   │   │   ├── tenants/[id]/page.tsx
│   │   │   │   │   ├── subscriptions/page.tsx
│   │   │   │   │   ├── plans/page.tsx
│   │   │   │   │   ├── audit/page.tsx
│   │   │   │   │   ├── impersonate/page.tsx
│   │   │   │   │   └── settings/page.tsx
│   │   │   │   └── api/
│   │   │   │       └── health/route.ts
│   │   │   ├── components/
│   │   │   │   └── ui/            # shadcn components (CLI install, duplicate từ apps/web)
│   │   │   │       ├── button.tsx
│   │   │   │       ├── card.tsx
│   │   │   │       ├── dialog.tsx
│   │   │   │       ├── input.tsx
│   │   │   │       ├── table.tsx
│   │   │   │       └── ...
│   │   │   ├── lib/               # utility cross-module
│   │   │   │   ├── utils.ts
│   │   │   │   ├── date.ts
│   │   │   │   └── permissions.ts # check role platform_*
│   │   │   └── modules/           # Feature module (D10, giống apps/web)
│   │   │       ├── tenants/       # list, view, suspend, impersonate
│   │   │       │   ├── components/
│   │   │       │   ├── hooks/
│   │   │       │   ├── schemas/
│   │   │       │   ├── services/tenantsApi.ts  # gọi api-gateway /v1/admin/tenants
│   │   │       │   ├── types/
│   │   │       │   └── index.ts
│   │   │       ├── subscriptions/ # view all subs, refund, cancel
│   │   │       ├── plans/         # CRUD plan, price
│   │   │       ├── audit/         # view platform_audit_log (filter by actor, tenant, action, range)
│   │   │       ├── impersonate/   # generate short-lived tenant JWT, log entry
│   │   │       ├── metrics/       # global: MAU, MRR, churn
│   │   │       ├── feature-flags/ # rollout flag
│   │   │       └── _shared/
│   │   │           ├── api/       # fetch client, retry, error mapping
│   │   │           ├── auth/      # MFA TOTP verify, session check
│   │   │           └── config/
│   │   ├── public/
│   │   ├── components.json        # cấu hình shadcn (D11) — KHÁC apps/web (riêng project)
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json          # path alias: @/* → src/*
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   │
│   └── core-api/                  # .NET Core 10 DDD (DDD layered layout, custom base class)
│       ├── SaasCheckin.sln
│       ├── Directory.Build.props              # MSBuild chung (nullable, warnings, lang 14)
│       ├── Directory.Packages.props           # Central Package Management
│       ├── global.json                        # pin .NET 10 SDK
│       ├── .editorconfig                      # code style
│       ├── Dockerfile                         # multi-stage Alpine
│       ├── shared/                            # Shared kernel
│       │   ├── Shared.Domain.Core/            # primitive thuần C# (Result<T>, Guard, Money base)
│       │   ├── Shared.Domain/                 # AggregateRoot, Entity, ValueObject, IDomainEvent, IMultiTenant, ICurrentTenant, Specification
│       │   ├── Shared.Application.Contracts/  # IApplicationService, PagedResultDto, ICurrentUser
│       │   ├── Shared.Application/            # IUnitOfWork, IRepository, IIntegrationEventBus, MediatR behaviors
│       │   ├── Shared.EntityFrameworkCore/    # EfRepository<,>, EfUnitOfWork, TenantDbConnectionInterceptor
│       │   └── Utility/                       # Slugify, JsonConverters, Polly, OTel helpers
│       └── src/                               # Service cụ thể
│           ├── SaasCheckin.Domain.Core/       # domain primitive riêng (Money, Email, TenantId)
│           ├── SaasCheckin.Domain/            # 6 bounded context như module con
│           │   ├── Identity/                  # User, Organization, Membership + module
│           │   ├── EventManagement/           # Event, Session, Venue + module
│           │   ├── Registration/              # TicketType, Order, Registration + module
│           │   ├── CheckIn/                   # CheckInRecord + module
│           │   ├── Billing/                   # Subscription, Invoice, Plan + module
│           │   ├── Notification/              # module (conformist)
│           │   └── Modules/                   # IModule + ModuleBase + SaasCheckinHostModule
│           ├── SaasCheckin.Application.Contracts/   # I*AppService + DTO + permissions
│           ├── SaasCheckin.Application/       # *AppService + validators + mapping
│           ├── SaasCheckin.EntityFrameworkCore/    # DbContext + IEntityTypeConfiguration + migrations
│           ├── SaasCheckin.Infrastructure/    # Resend, Twilio, Stripe, VNPay, MassTransit, gRPC services
│           ├── SaasCheckin.HttpApi.Host/      # Program.cs: REST + gRPC + Scalar + health + JWT
│           └── SaasCheckin.DbMigrator/        # console chạy migrations + seed
│
├── packages/
│   ├── contracts/                 # OpenAPI TS client được gen
│   │   ├── src/
│   │   ├── openapi.json
│   │   └── package.json
│   ├── proto/                     # định nghĩa .proto
│   │   ├── buf.yaml
│   │   ├── checkin/v1/checkin.proto
│   │   └── gen/                   # code đã gen
│   ├── ui/                        # React component chia sẻ
│   │   ├── src/
│   │   └── package.json
│   ├── dart-core/                 # Dart model (thủ công + gen)
│   │   ├── lib/
│   │   └── pubspec.yaml
│   ├── eslint-config/
│   └── tsconfig/
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.prod.yml
│   │   └── Dockerfile.*
│   ├── ansible/
│   │   ├── inventories/
│   │   │   ├── production/
│   │   │   └── staging/
│   │   ├── playbooks/
│   │   │   ├── common.yml
│   │   │   ├── app.yml
│   │   │   ├── db.yml
│   │   │   └── staging.yml
│   │   ├── group_vars/
│   │   └── ansible.cfg
│   ├── github-actions/            # workflow tái sử dụng
│   └── terraform/                 # tùy chọn, cho resource Hetzner
│
├── tools/
│   ├── seed/                      # data fixture
│   ├── loadtest/                  # script k6
│   └── proto/                     # script buf CLI
│
├── docs/                          # folder này
│
├── pnpm-workspace.yaml
├── turbo.json
├── melos.yaml
├── Taskfile.yml
├── Directory.Packages.props       # root (optional) — central NuGet version cho root .NET tool (vd CLI script)
├── package.json                   # root
├── .env.example
├── .editorconfig
├── .gitignore
├── .nvmrc
├── LICENSE
├── README.md
└── CLAUDE.md
```

## Cấu hình workspace

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":   { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint":    { "outputs": [] },
    "test":    { "outputs": ["coverage/**"] },
    "dev":     { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

### `melos.yaml`
```yaml
name: saas_checkin_mobile
packages:
  - apps/mobile
  - apps/mobile/packages/*
scripts:
  analyze: melos exec -c 1 -- "dart analyze"
  test:    melos exec -c 1 -- "flutter test"
  format:  melos exec -c 1 -- "dart format ."
```

## Code ownership

`.github/CODEOWNERS`:
```
/apps/web/                @team/frontend
/apps/checkin-admin/        @team/platform-eng          # owner riêng (D12)
/apps/mobile/             @team/mobile
/apps/api-gateway/        @team/backend
/apps/api-gateway/src/modules/checkin-admin/  @team/platform-eng
/apps/core-api/           @team/backend
/packages/contracts/      @team/backend
/packages/proto/          @team/backend
/infra/                   @team/devops
/docs/                    @team/tech-leads
```

## Quy ước đặt tên

- **File:** kebab-case (`check-in.service.ts`, không tồn tại `user_repository.go`)
- **React component:** PascalCase (`EventCard.tsx`)
- **Dart class:** PascalCase (`event_card.dart`)
- **Biến:** camelCase (TS/Dart/C#) — C# dùng PascalCase cho class/record/property, camelCase cho biến local và parameter
- **Cột DB:** snake_case
- **Env var:** SCREAMING_SNAKE_CASE
- **Branch:** `feature/issue-N-short-desc`
