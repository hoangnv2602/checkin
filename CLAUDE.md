# CLAUDE.md — Agent Context

> Auto-loaded by Claude Code on session start. Read first, then load specific docs as needed.

## What this is

Multi-tenant **SaaS event check-in** platform. Organizers create events → sell tickets → staff scan QR codes on a mobile app to check attendees in. Real-time dashboard on web.

**Status:** Phase 0 — Foundation (Week 1). 20 issues in `docs/issues/phase-0-foundation.md`.

## Critical rules (read before writing code)

1. **Business logic lives in `apps/core-api` (.NET Core 10, DDD layered, custom base class).** `apps/api-gateway` (NestJS) is I/O only — auth, WebSocket, BullMQ, proxy. Never put domain rules in NestJS. Layout chi tiết: [`docs/api/structure.md`](docs/api/structure.md); ADR: [`docs/adr/0013-dotnet-core-10-ddd.md`](docs/adr/0013-dotnet-core-10-ddd.md).
2. **Multi-tenant isolation is non-negotiable.** Every business table has `tenant_id` + Postgres RLS. Always `SET LOCAL app.tenant_id = '...'` at the start of any DB transaction.
3. **Use `PaymentProviderInterface` for payments.** Two adapters: `StripeAdapter` + `VnpayAdapter`. Never call provider SDKs directly from use cases.
4. **QR codes are Ed25519-signed, JTI single-use.** Server is the source of truth. Mobile can verify offline but cannot mint check-ins.
5. **Custom JWT only.** RS256 access token (15 min) + opaque refresh token (30 day, rotated). No NextAuth, no Passport-local.
6. **No GraphQL.** REST + OpenAPI 3.1. Code-gen TS for web, Dart for mobile.
7. **Never commit secrets.** Use `.env.example` for placeholders, real values via `direnv` + Ansible Vault or Doppler.
8. **Next.js code is organized by feature module** (D10). Each feature lives in `apps/web/src/modules/<module>/` and owns its components, hooks, schemas, services, and types. The `app/` directory contains only Next.js route shells that import from `src/modules/`. Do not put business code in `app/`.
   - **Structure (mandatory):** `components/{<Entity>Xxx,<Module>Xxx}.tsx` + `hooks/use<Entities>.ts` + `schemas/<entity>.schema.ts` + `services/<entities>Api.ts` + `types/<entity>.ts` + `index.ts` barrel at every level. Full spec: `docs/07-frontend.md` § Module structure.
   - **Pages:** composed page-level components live in `components/<Module>Page.tsx`.
   - **State:** Zustand stores exposed as hooks in `hooks/use<Entities>.ts` (no separate `store/` folder).
9. **Flutter state management is BLoC + Cubit** (D9). Use Cubit for simple state, full BLoC for event-driven flows (e.g. QR scan → verify → sync). No Riverpod, no Provider, no setState for shared state.
10. **No default shadcn / Tailwind palette classes** (D11). Use semantic tokens (`bg-primary`, `text-foreground`, `border-border`). Forbidden: `bg-indigo-500`, `bg-zinc-100`, `text-gray-900`, etc. The palette is the custom **Aurora** theme — see `docs/design-system.md`.
11. **All shadcn components are added via CLI** (D11): `cd apps/web && yarn dlx shadcn@latest add <name>`. Never copy-paste a shadcn component, never hand-roll a Radix-based component. To customize, wrap the CLI-managed file in `src/modules/<module>/components/`.
12. **Two Next.js apps, two different audiences.** `apps/web` is the **tenant-facing** app (organizer admin + public pages). `apps/checkin-admin` is the **platform owner** app (run-the-SaaS tooling: list tenants, suspend, refund, audit). They are **separate Next.js projects, separate deployments, separate domains** (`web.saas-checkin.com` vs `admin.saas-checkin.com`). The checkin-admin app uses a dedicated `app_platform_owner` Postgres role with `BYPASSRLS`; it never shares a JWT or BFF endpoint with the tenant app. Layout: [`docs/checkin-admin.md`](docs/checkin-admin.md). ADR: [`docs/adr/0014-checkin-admin-app.md`](docs/adr/0014-checkin-admin-app.md).

## Tech stack (one-liner each)

| Layer | Choice | Version |
|-------|--------|---------|
| Web (tenant) | Next.js (App Router, RSC) + **feature modules** + **Aurora design system** | 16.2.x |
| Web (check-in admin) | Next.js (App Router, RSC) + **feature modules** + Aurora tokens; deploy subdomain riêng | 16.2.x |
| Mobile | Flutter + **BLoC + Cubit** (iOS + Android) | 3.6.x |
| BFF / Gateway | NestJS (REST + Socket.IO + BullMQ + gRPC client; tách module `checkin-admin/` riêng) | 11.x |
| Core domain | .NET Core 10 (DDD layered, custom base class; EF Core 10 + MassTransit + MediatR + Stateless) | 10.x |
| Database | PostgreSQL + RLS (2 role: `app_runtime` enforce RLS, `app_platform_owner` BYPASSRLS) | 16 |
| Cache / Queue / PubSub | Redis | 7 |
| Contracts | gRPC proto + OpenAPI 3.1 | — |
| UI primitives | Tailwind 4 + shadcn/ui (CLI-installed) + Radix | latest |
| Infra | Docker Compose + Ansible | — |
| Hosting | Hetzner VPS (Ubuntu 24.04) | — |

Full rationale: `docs/02-tech-stack.md`.

## Repo map (where to put new code)

| Want to… | Go to |
|----------|-------|
| Add a Next.js page / route shell (tenant) | `apps/web/src/app/(group)/<route>/page.tsx` (thin) |
| Add a Next.js page / route shell (check-in admin) | `apps/checkin-admin/src/app/(group)/<route>/page.tsx` (thin) |
| Add a Next.js feature module (tenant) | `apps/web/src/modules/<module>/` with `components/`, `hooks/`, `schemas/`, `services/`, `types/` + `index.ts` barrel |
| Add a Next.js feature module (check-in admin) | `apps/checkin-admin/src/modules/<module>/` cùng layout, dùng Aurora tokens + shadcn CLI riêng |
| Add an entity component (Form/Table/Card/DeleteDialog) | `apps/web/src/modules/<module>/components/<Entity>Xxx.tsx` |
| Add a module-level widget (Filters, Stats, Page) | `apps/web/src/modules/<module>/components/<Module>Xxx.tsx` |
| Add a React Query hook | `apps/web/src/modules/<module>/hooks/use<Entities>.ts` |
| Add a Zustand store (as hook) | `apps/web/src/modules/<module>/hooks/use<Entities>Store.ts` |
| Add a zod schema | `apps/web/src/modules/<module>/schemas/<entity>.schema.ts` |
| Add an API service | `apps/web/src/modules/<module>/services/<entities>Api.ts` |
| Add a domain type | `apps/web/src/modules/<module>/types/<entity>.ts` |
| Add a shadcn UI component | `cd apps/web && yarn dlx shadcn@latest add <name>` → lands in `apps/web/src/components/ui/` (shadcn default) |
| Customize a shadcn component for a feature | `apps/web/src/modules/<module>/components/<name>-brand.tsx` wrapping the shared one |
| Edit color tokens / typography | `apps/web/src/app/globals.css` (Aurora palette — see `docs/design-system.md`) |
| Add a generic utility (date/format/validate) | `apps/web/src/lib/<name>.ts` |
| Add a cross-module coordinator (API client, env, providers) | `apps/web/src/modules/_shared/<area>/` |
| Add a Flutter screen | `apps/mobile/lib/features/<name>/presentation/screens/` |
| Add a BLoC / Cubit | `apps/mobile/lib/features/<name>/presentation/blocs/` |
| Add a Flutter feature data layer | `apps/mobile/lib/features/<name>/data/{datasources,repositories,models}/` |
| Add a Flutter feature domain layer | `apps/mobile/lib/features/<name>/domain/{entities,usecases,repositories}/` |
| Add a BFF endpoint (REST) | `apps/api-gateway/src/modules/<name>/` |
| Add a WebSocket gateway | `apps/api-gateway/src/modules/realtime/` |
| Add a background job | `apps/api-gateway/src/modules/jobs/` |
| Add a bounded context | `apps/core-api/src/SaasCheckin.Domain/<Context>/` (aggregate + VO + events + IRepository + bounded-context registration class) |
| Add a shared TS type | `packages/contracts/src/` |
| Add a proto RPC | `packages/proto/<service>/v1/*.proto` |
| Add an ADR | `docs/adr/<next-number>-<kebab-title>.md` |
| Add infra config | `infra/{ansible,docker}/` |

Full layout: `docs/03-monorepo.md`.

## Architecture in 1 paragraph

Clients: **tenant web** (Next.js, `apps/web`), **checkin-admin web** (Next.js riêng, `apps/checkin-admin`), **mobile** (Flutter). Tenant + mobile → API Gateway (NestJS, BFF) via HTTPS + WSS → Core API (.NET Core 10, DDD layered) qua gRPC + domain events trên Redis Streams / RabbitMQ → Postgres + Redis. Super-admin web → BFF (module `checkin-admin/` riêng trong api-gateway, service-account có `BYPASSRLS`) → Core API. All multi-tenant data isolated bằng RLS ở role `app_runtime`; role `app_platform_owner` BYPASSRLS chỉ dùng cho checkin-admin workflow có audit log. See `docs/01-architecture.md` for diagram.

## Bounded contexts (high level)

`Identity & Tenancy` → `Event Management` → `Registration & Ticketing` → `Check-in` (downstream) → `Billing` + `Notification` (conformist). Full map: `docs/04-bounded-contexts.md`.

## Current focus: Phase 0 (Week 1)

20 issues (I-001 → I-020) in `docs/issues/phase-0-foundation.md`. Definition of done: monorepo runs locally + staging stack reachable via HTTPS on Hetzner. Do these in order; do not start Phase 1 until Phase 0 is signed off.

## Conventions

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). English only.
- **Branches:** `main` (protected), `develop`, `feature/issue-N-short-desc`.
- **PRs:** 1 approval + green CI (lint, typecheck, test, build). Squash merge.
- **TypeScript:** strict mode, no `any` in committed code.
- **C#:** Nullable reference types + Roslyn analyzers + StyleCop + `dotnet format --verify-no-changes`.
- **Dart:** `dart analyze` clean, prefer `final` over `var`.
- **File naming:** kebab-case for files, PascalCase for React/Dart components, camelCase for vars.

## How to work on an issue

1. Create branch `feature/issue-N-short-desc` from `develop`.
2. Read the issue fully. Read the docs it links to.
3. Use `EnterPlanMode` if the change is non-trivial (touches ≥ 3 files, new pattern, architectural).
4. Implement, write tests (unit + at least one integration).
5. Run local checks: `task lint && task test`.
6. Open PR. Reference the issue: `Closes #N`.
7. After merge, move to the next issue.

## Tools / skills to use

- `TaskCreate` for multi-step work in a session
- `EnterPlanMode` for non-trivial implementations
- Reference code as `file_path:line_number` in chat
- `WebSearch` / `WebFetch` for verifying API/SDK current behavior — APIs change between versions
- Don't run `git commit` or `git push` unless explicitly asked

## Don't

- Don't put ORM (EF Core DbContext) inside aggregates — repository interface only
- Don't bypass RLS with `BYPASSRLS` role in tenant code paths — chỉ checkin-admin workflow mới dùng `app_platform_owner`, mọi call phải có audit log
- Don't hardcode payment provider SDK calls outside `*Adapter` classes
- Don't add `console.log` / `var_dump` to committed code
- Don't write tests that mock everything — integration tests against Postgres/Redis are mandatory for domain logic
- Don't merge with failing CI
- Don't share JWT, session, hoặc cookie domain giữa `apps/web` và `apps/checkin-admin` — chúng là 2 audience khác nhau, tách biệt hoàn toàn

## Quick reference

- 13 architectural decisions (D1–D13): `docs/decisions.md`
- Design system (Aurora palette, shadcn CLI workflow): `docs/design-system.md`
- ADRs: `docs/adr/`
- Risk register: `docs/11-risks.md`
- Out of scope (don't propose): `docs/12-out-of-scope.md`

## Available skills (project-scoped — đã commit vào `.claude/skills/`)

> Cập nhật 2026-06-05: 17 skills committed vào `.claude/skills/` (project scope). Mỗi skill tự trigger khi prompt / file path match. Có thể invoke thủ công qua `Skill <tên>` khi cần explicit. **Không cài global** (`~/.agents/skills/`) — git sẽ track giúp, team mới clone repo có sẵn.

### Tier 1 — Core stack (1K+ installs, nguồn uy tín)

| Skill | Áp dụng khi |
|---|---|
| `vercel-react-best-practices` | Viết/sửa React + Next.js code (component, page, data fetching, bundle) |
| `web-design-guidelines` | Layout web, design discipline, accessibility |
| `frontend-design` | Build UI production-grade với design quality cao (Aurora palette) |
| `tailwind-v4-shadcn` | Add/config shadcn component, Tailwind 4 tokens, custom palette |
| `nestjs-best-practices` | Code NestJS controller / service / guard / module |
| `playwright-best-practices` | Viết E2E test cho Next.js apps (I-105) |
| `architecture-decision-records` | Viết/sửa ADR (đã có 15 file ADR theo pattern) |
| `stripe-best-practices` | Code Billing context, tích hợp Stripe |
| `ansible-automation` | Viết playbook cho Hetzner provisioning (I-018) |
| `efcore-patterns` | EF Core 10 query, migration, tracking |
| `flutter-bloc` | Tạo BLoC/Cubit mới trong `apps/mobile/lib/features/<name>/presentation/blocs/` |
| `flutter-testing` | Viết test cho mobile (bloc_test, mock) |

### Tier 2 — Domain-specific (D13 + DDD + multi-tenant)

| Skill | Áp dụng khi |
|---|---|
| `ddd-aggregate` | Scaffold aggregate root + VO + repo interface + event + test stub (I-101, I-201, I-301, I-401) |
| `ddd-context` | Tạo bounded context module mới (7 context: Identity, Event, Ticketing, CheckIn, Billing, Notification, PlatformOps) |
| `multi-tenant-safety-checker` | Review RLS bypass, tenant isolation, query filter (code path dùng `app.current_tenant`) |
| `rbac-policy-tester` | Test policy theo D13 (hybrid permission), verify Owner/Admin/Organizer/Staff/Viewer permission set |
| `postgres-rls` | Review policy RLS, viết `CREATE POLICY` mới, debug query bị filter nhầm |

### Built-in (Claude Code)

`find-skills`, `deep-research`, `update-config`, `keybindings-help`, `verify`, `code-review`, `simplify`, `fewer-permission-prompts`, `loop`, `claude-api`, `run`, `init`, `review`, `security-review`.

### Cài thêm / cập nhật (project scope)

```bash
# Cài skill mới vào project (KHÔNG dùng -g)
npx skills add <owner>/<repo>@<skill> -y

# Check updates cho skill trong project
npx skills check

# Update tất cả
npx skills update

# Search theo keyword
npx skills find <query>
```

**Lưu ý:**
- **Không dùng `-g`** — flag này cài global vào `~/.agents/skills/`, project khác sẽ thấy và ngược lại khi wipe project sẽ mất.
- Sau khi `npx skills add`, kiểm tra folder mới xuất hiện trong `.claude/skills/<name>/` rồi commit lên git.
- Nếu fresh clone mà `.claude/skills/` rỗng (do git LFS hoặc .gitignore nhầm), chạy restore command bên dưới.

### Restore sau fresh clone

Nếu clone repo mà `.claude/skills/` không có (hiếm, nhưng phòng case wipe), dùng script restore:

```bash
bash tools/scripts/install-skills.sh          # cài 17 skills theo manifest
bash tools/scripts/install-skills.sh --dry-run  # xem sẽ cài gì, không chạy thật
```

Source of truth: `tools/scripts/skills-manifest.json` (cùng folder). Update manifest khi cần pin version mới hoặc thêm skill mới — đừng hard-code spec trong docs.

Danh sách đầy đủ: https://skills.sh/
