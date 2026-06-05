# Phase 0 — Nền tảng (Tuần 1)

> **Mục tiêu:** Monorepo chạy local + staging stack trên Hetzner truy cập được qua HTTPS. 8 ADR đã viết. CI xanh.
> **Status:** Chưa bắt đầu.

## Effort key
- **S** ≤ 0.5 ngày
- **M** 1–2 ngày
- **L** 3–5 ngày

---

## 15.1 Khởi tạo repo

### I-001 · [M] Khởi tạo monorepo
Tạo layout thư mục và cấu hình tool:
- `apps/{web,checkin-admin,mobile,api-gateway,core-api}` — **5 app** (D12, ADR-0014)
- `packages/{contracts,proto,ui,dart-core,eslint-config,tsconfig}`
- `infra/{ansible,docker,github-actions}`
- `docs/adr/`, `docs/issues/`, `docs/checkin-admin.md`
- Cấu hình root: `pnpm-workspace.yaml`, `turbo.json`, `melos.yaml`, `global.json` (cho `apps/core-api` pin .NET 10 SDK)

**Done khi:** `pnpm install` thành công, `turbo run build` chạy xuyên tất cả app TS.

### I-002 · [S] Cấu hình root
- `package.json` (root, private)
- `.gitignore`
- `.editorconfig`
- `.nvmrc` (Node 22)
- `.tool-versions` không cần — .NET dùng `apps/core-api/global.json`; Dart dùng `apps/mobile/.fvmrc` hoặc pinned trong `pubspec.yaml`
- `LICENSE` (proprietary)
- `CODEOWNERS`
- `README.md` có quickstart
- `CLAUDE.md` cho agent

### I-003 · [S] Repo GitHub + branch protection
- Branch: `main` (protected), `develop`
- Rule: PR + 1 approval + CI pass, squash merge, không force push
- Default branch: `main`

### I-004 · [S] Template ADR
- `docs/adr/template.md` (Status / Context / Decision / Consequences)
- Tạo 9 file ADR (0001–0009) theo template
- Tất cả đánh `Accepted` với date 2026-06-04

---

## 15.2 CI / CD

### I-005 · [M] CI matrix trên GitHub Actions
`.github/workflows/ci.yml` với job song song:
- `web`: tsc, eslint, vitest, next build
- `api-gateway`: eslint, vitest, nest build, proto lint
- `core-api`: `dotnet restore` + `dotnet test` + `dotnet format --verify-no-changes` + NetArchTest architecture tests
- `mobile`: melos bootstrap, dart analyze, flutter test
- `contracts`: buf build, OpenAPI diff

### I-006 · [S] Workflow release
`.github/workflows/release.yml`:
- semantic-release cho web/api-gateway
- Tạo tag + push image lên GHCR khi release

### I-007 · [S] Dependabot + auto-merge minor
`.github/dependabot.yml` cho npm, composer, pub, github-actions.
Bật auto-merge cho minor/patch.

---

## 15.3 Môi trường dev

### I-008 · [M] docker-compose.dev
`infra/docker/docker-compose.dev.yml`:
- `postgres:16` với init script bật `pgcrypto`, `citext`, `pg_stat_statements`
- `redis:7`
- `mailhog`
- `minio`
- Healthcheck, volume mount, `.env.example` mỗi service

### I-009 · [S] Taskfile
`Taskfile.yml` với task:
- `dev:up`, `dev:down`, `dev:logs`
- `db:migrate`, `db:seed`
- `proto:gen`, `contracts:gen`
- `test`, `lint`, `format`

### I-010 · [S] Seed data
`tools/seed/`:
- 1 org mẫu + 1 owner user
- 1 event draft
- 100 registration giả
- Chạy qua `task db:seed`

---

## 15.4 Skeleton app

### I-011 · [M] Skeleton Next.js 16.2.x
- `apps/web` với App Router (toàn bộ source code nằm dưới `src/`)
- **Layout `src/`:**
  - `src/app/` — route Next.js, `globals.css` (biến CSS Aurora)
  - `src/components/ui/` — component shadcn (CLI-installed, đường dẫn mặc định shadcn)
  - `src/lib/` — utility generic (`utils.ts`, `date.ts`, `format.ts`, `validate.ts`, `permissions.ts`)
  - `src/modules/<module>/` — feature module (D10, xem dưới)
  - `src/modules/_shared/` — coordinator cross-module (api, config, providers)
- **Feature module** (D10) với layout bắt buộc:
  ```
  src/modules/<module>/
  ├── components/{<Entity>Xxx,<Module>Xxx}.tsx + index.ts
  ├── hooks/use<Entities>.ts + index.ts
  ├── schemas/<entity>.schema.ts + index.ts
  ├── services/<entities>Api.ts + index.ts
  ├── types/<entity>.ts + index.ts
  └── index.ts   (barrel top-level)
  ```
- Module khởi đầu: `marketing`, `auth`, `events`, `checkin`, `registration`, `billing`, `members`, `settings`, `notifications`
- `src/app/` chỉ chứa shell route: `(marketing)`, `(auth)`, `(dashboard)`, `(public)`, `api/`
- Mỗi `page.tsx` là wrapper mỏng import page-level component (`<Module>Page.tsx`) từ module
- Path alias trong `tsconfig.json`: `@/*` → `src/*`
- ESLint: `no-restricted-paths` enforce boundary module (không deep import chéo module)
- **Setup design system (D11):**
  ```bash
  cd apps/web
  yarn dlx shadcn@latest init           # tạo components.json — giữ đường dẫn mặc định
  # Mặc định cho đúng thứ mình muốn:
  #   - components: src/components/ui (shadcn mặc định)
  #   - utils: src/lib/utils
  #   - css: src/app/globals.css
  # Override src/app/globals.css với giá trị token Aurora (xem docs/design-system.md)
  yarn dlx shadcn@latest add button input label    # UI tối thiểu cho Phase 0
  ```
- **Verify** không còn token `baseColor: neutral` trong `globals.css` (thay bằng token Aurora theo `docs/design-system.md`)
- TanStack Query, Zustand (store mỗi module expose dạng hook trong `hooks/use<Entities>.ts`), next-intl
- Health route `/api/health`

### I-012 · [M] Skeleton NestJS BFF
Module `apps/api-gateway` (skeleton):
- `health` (live/ready)
- `auth` (stub issue/verify JWT)
- `events` (stub proxy)
- `realtime` (Socket.IO + Redis adapter)
- `jobs` (BullMQ init)
- Pino logger
- OpenAPI auto-gen ở `/v1/docs`
- gRPC client skeleton tới `core-api:50051`

### I-013 · [M] Skeleton .NET Core 10 DDD (DDD layered layout)
- `apps/core-api/SaasCheckin.sln` chứa **14 project** theo layout DDD layered (xem [`docs/api/structure.md`](../api/structure.md)):
  - `shared/Shared.Domain.Core`, `Shared.Domain`, `Shared.Application.Contracts`, `Shared.Application`, `Shared.EntityFrameworkCore`, `Utility` (6 shared project, NuGet reference lẫn nhau theo dependency direction)
  - `src/SaasCheckin.Domain.Core`, `SaasCheckin.Domain`, `SaasCheckin.Application.Contracts`, `SaasCheckin.Application`, `SaasCheckin.EntityFrameworkCore`, `SaasCheckin.Infrastructure`, `SaasCheckin.HttpApi.Host`, `SaasCheckin.DbMigrator` (8 project)
- `Directory.Build.props` (nullable, warnings-as-errors, lang 14, ImplicitUsings)
- `Directory.Packages.props` (Central Package Management: EF Core, MediatR, MassTransit, Grpc.AspNetCore, Scalar, Serilog, ...)
- `global.json` pin .NET 10 SDK
- `.editorconfig` + StyleCop
- 1 bounded context mẫu: `Identity` (aggregate `User` + `IUserRepository` + `IUserAppService` + 1 use case `CreateUserAsync`)
- `SaasCheckin.EntityFrameworkCore/Migrations/` (EF Core migrations)
- `SaasCheckin.HttpApi.Host/Program.cs` chạy được — `dotnet run` → `http://localhost:5000/scalar/v1` (OpenAPI UI) + `http://localhost:5000/health/live`
- `SaasCheckin.DbMigrator` chạy được: `dotnet run --project src/SaasCheckin.DbMigrator`
- EF Core `TenantDbConnectionInterceptor` set `app.current_tenant` tự động mỗi connection open
- gRPC service mẫu `CheckInService` implement từ `packages/proto/checkin/v1/checkin.proto`; `MapGrpcService<CheckInGrpcService>()` trong Program.cs
- Dockerfile multi-stage Alpine: `mcr.microsoft.com/dotnet/sdk:10.0-alpine` (build) + `mcr.microsoft.com/dotnet/aspnet:10.0-alpine` (runtime, non-root user)
- `appsettings.json` + `appsettings.Development.json` config (không `.env`)

### I-013b · [M] Skeleton Next.js 16.2.x — `apps/checkin-admin` (D12, ADR-0014)
- `apps/checkin-admin` là **Next.js project tách biệt**, không share `apps/web/` source (xem [`docs/checkin-admin.md`](../checkin-admin.md))
- **Layout `src/`** giống `apps/web` (App Router + feature module), chỉ khác:
  - `src/app/(auth)/login/page.tsx` + `mfa-setup/page.tsx` (MFA TOTP flow)
  - `src/app/(dashboard)/` với route `tenants/`, `subscriptions/`, `plans/`, `audit/`, `impersonate/`, `metrics/`, `feature-flags/`, `settings/`
  - **Module khởi đầu** (chỉ skeleton, logic đầy đủ ở Phase 1 + 5): `tenants`, `subscriptions`, `plans`, `audit`, `impersonate`, `metrics`, `feature-flags`
  - **KHÔNG có** Socket.IO, **KHÔNG có** i18n (MVP chỉ EN)
- **Setup design system (D11):** copy Aurora tokens từ `apps/web/src/app/globals.css` sang `apps/checkin-admin/src/app/globals.css` (KHÔNG share file — 2 app, 2 release cadence)
  ```bash
  cd apps/checkin-admin
  yarn dlx shadcn@latest init           # components.json riêng (KHÁC apps/web)
  #   - components: src/components/ui
  #   - utils: src/lib/utils
  #   - css: src/app/globals.css
  # Copy token Aurora từ apps/web/src/app/globals.css
  yarn dlx shadcn@latest add button input label card dialog table  # UI cần cho data table
  ```
- TanStack Query + react-hook-form + zod
- **Auth check ở layout:** middleware Next.js verify JWT (cookie `sa_pa_session`, secure, httpOnly, sameSite=strict, domain `.admin.saas-checkin.com`), check `aud: 'checkin-admin'` + `mfa: true`, redirect về login nếu thiếu
- **Mock data ở Phase 0:** placeholder pages trả hard-coded "OK, chưa gọi API" — Phase 1 mới wire thật
- Health route `/api/health`
- Dockerfile multi-stage Alpine: `node:22-alpine` (build) + `node:22-alpine` (runner standalone)
- **CODEOWNERS:** `/apps/checkin-admin/` thuộc `@team/platform-eng`

### I-014 · [M] Skeleton Flutter
- `apps/mobile` với `flutter create` + **BLoC + Cubit** (D9) + go_router
- Layout feature-first: `lib/features/auth/`, `lib/features/checkin/` với `data/`, `domain/`, `presentation/blocs/`
- Dep `flutter_bloc`, `equatable`, `bloc_test`
- `MultiBlocProvider` trong `app.dart` cho `SessionCubit`, `AuthBloc`, `ScanBloc`
- dio + retrofit với OpenAPI codegen
- drift schema + migration runner
- mobile_scanner init
- sentry init
- Màn hình Login + Scan placeholder

---

## 15.5 Contract & codegen

### I-015 · [S] Setup proto
- `packages/proto/checkin/v1/checkin.proto` với 3 RPC: `Scan`, `GetEventStats`, `UndoCheckIn`
- `buf.yaml`, `buf.gen.yaml`
- Gen target TS + Dart

### I-016 · [S] Pipeline OpenAPI
- NestJS export spec sang `packages/contracts/openapi.json`
- `openapi-typescript` → TS client cho web
- `openapi-generator-cli` → Dart client cho mobile
- CI fail khi breaking change trừ khi bump version

---

## 15.6 Provisioning (D6)

### I-017 · [M] Hetzner project + 3 VPS
- Hetzner Cloud project
- API token trong GH Actions secret
- Tạo `htz-app-1` (CCX23), `htz-db-1` (CCX13), `htz-staging-1` (CX22)
- Dùng Terraform hoặc Ansible (ưu tiên Ansible để nhất quán với I-018)

### I-018 · [M] Ansible playbook
`infra/ansible/`:
- `playbooks/common.yml` — docker, ufw, fail2ban, users, SSH key
- `playbooks/app.yml` — docker-compose, caddy
- `playbooks/db.yml` — postgres, redis, pgbouncer, pgbackrest
- `playbooks/staging.yml`
- `inventories/{production,staging}/`

### I-019 · [S] Setup Cloudflare
- Thêm domain
- DNS record (proxied)
- SSL: Full (Strict)
- Bật rule WAF free

### I-020 · [S] Deploy đầu tiên
- `docker compose up -d` trên htz-staging-1
- Verify health check pass
- Viết runbook `docs/runbooks/initial-deploy.md`

---

## Definition of Done

- [ ] `git clone` → `task dev:up` → 5 app chạy local (`web`, `checkin-admin`, `mobile`, `api-gateway`, `core-api`)
- [ ] `pnpm test` + `dotnet test` + `flutter test` xanh trên CI
- [ ] Image `ghcr.io/<org>/<service>:dev` build OK cho cả 5 service
- [ ] Hetzner VPS provisioned, staging stack truy cập được qua HTTPS ở 3 domain: `web.*`, `admin.*`, `api.*`
- [ ] Cloudflare proxy pass, HTTPS xanh; `admin.*` có IP allowlist ở WAF
- [ ] 14 file ADR (0001–0014, bao gồm ADR-0013 .NET Core 10, ADR-0014 checkin-admin) đã review trong PR
- [ ] README có quickstart cho dev mới (cả 2 app Next.js)

**Output cuối Tuần 1:** monorepo chạy local + staging stack trên Hetzner qua HTTPS + skeleton 4 app ping lẫn nhau trên health endpoint.
