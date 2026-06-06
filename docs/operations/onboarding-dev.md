# Dev onboarding

Hướng dẫn dev mới onboard vào repo. Đọc trước buổi 1:1 với tech lead.

## Day 1: Setup local

### Tooling

- Node 22 (`nvm install 22 && nvm use 22`)
- pnpm 9 (`npm i -g pnpm`)
- .NET 10 SDK (download từ dot.net)
- Docker + Docker Compose
- Dart 3.6 (`brew tap dart-lang/dart && brew install dart`)
- Flutter 3.6 (https://flutter.dev/docs/get-started/install)
- buf (protobuf generator)
- k6 (load test)

### Clone + bootstrap

```bash
git clone git@github.com:saas-checkin/platform.git
cd platform
pnpm install
./tools/scripts/install-skills.sh  # install Claude skills
cp .env.example .env
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### Verify

```bash
# All 4 services healthy
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3001/health/live
curl -fsS http://localhost:5050/health/live

# Web + mobile build
pnpm --filter @saas-checkin/web build
cd apps/mobile && flutter analyze
cd ../..
```

## Day 2: Architecture tour

Đọc theo thứ tự:
1. `docs/01-architecture.md` — high-level
2. `docs/03-monorepo.md` — repo layout
3. `docs/04-bounded-contexts.md` — DDD map
4. `docs/06-api.md` — REST + gRPC contract
5. `docs/07-frontend.md` — web module structure (D10)
6. `docs/08-mobile.md` — Flutter BLoC pattern (D9)
9. `docs/decisions.md` — 13 ADRs

## Day 3: First PR

- Đọc `docs/issues/phase-N-*.md`, chọn issue M ưu tiên cao
- Tạo branch `feature/issue-N-short-desc` từ `develop`
- Implement + tests + commit (xem CLAUDE.md)
- Mở PR, reference issue

## Patterns quan trọng

### Multi-tenant isolation (D1)

- Mọi table có `tenant_id`
- RLS enforced ở Postgres role `app_runtime`
- Checkin-admin dùng role `BYPASSRLS` riêng
- `SET LOCAL app.tenant_id = '...'` đầu mỗi transaction

### Custom JWT (D5)

- RS256 access token 15 min
- Opaque refresh 30 day, rotated
- `aud: 'tenant-web'` | `'checkin-admin'` | `'mobile'`

### DDD aggregate (ADR-0013)

- Domain ở `apps/core-api/src/SaasCheckin.Domain/{Context}/Aggregates/`
- Repository interface trong Domain, impl trong EntityFrameworkCore
- Domain events ở Domain/Events; integration events qua IIntegrationEventBus
- Application handlers dùng MediatR

### Feature modules (D10)

- Web: `apps/web/src/modules/<module>/{components,hooks,schemas,services,types}/`
- `app/` chỉ làm route shells
- Mỗi module có barrel `index.ts`

### BLoC + Cubit (D9)

- Cubit cho simple state
- BLoC cho event-driven (scan → verify → sync)
- Không Riverpod, không Provider

## On-call

- Rotation: 1 tuần / người, list trong PagerDuty
- Escalation path: IC → tech lead → CTO
- Mọi alert phải có runbook (xem `docs/runbooks/`)
