# SaaS Event Check-in

Multi-tenant event check-in platform: organizers create events → sell tickets → staff check-in attendees via QR scan on mobile, with real-time dashboard.

> **Status:** Phase 0 — Foundation (Week 1)
> **Stack:** 2× Next.js 16.2 (tenant `apps/web` + checkin-admin `apps/checkin-admin`; feature modules + Aurora design system) · NestJS 11 · .NET Core 10 (DDD layered, custom base class) · PostgreSQL 16 · Redis 7 · Flutter (BLoC + Cubit)
> **Hosting:** On-prem / VPS (Hetzner + Docker Compose + Ansible)
> **Domains (prod):** `web.saas-checkin.com` (tenant) · `admin.saas-checkin.com` (checkin-admin) · `api.saas-checkin.com` (BFF)

---

## Quickstart (dev)

```bash
# Prereqs: Node 22, pnpm 9, .NET 10 SDK, Dart 3.6, Docker 24+
git clone <repo>
cd saas-checkin
cp .env.example .env

# Spin up infra + 5 apps
task dev:up

# Open
open http://localhost:3000      # Next.js — tenant (web)
open http://localhost:3002      # Next.js — checkin-admin (apps/checkin-admin)
open http://localhost:3001      # NestJS API Gateway + Swagger
open http://localhost:8080      # .NET Core 10 Core API + Scalar
```

> All `task` commands come from `Taskfile.yml`. Run `task` to list them.

---

## Documentation

Read **[`CLAUDE.md`](./CLAUDE.md)** first if you're an AI coding agent.

Full documentation is in **[`docs/`](./docs)**:

| Topic | File |
|-------|------|
| Product overview & features | [`docs/00-overview.md`](./docs/00-overview.md) |
| Architecture diagram | [`docs/01-architecture.md`](./docs/01-architecture.md) |
| Tech stack with rationale | [`docs/02-tech-stack.md`](./docs/02-tech-stack.md) |
| Monorepo structure | [`docs/03-monorepo.md`](./docs/03-monorepo.md) |
| Bounded contexts (DDD) | [`docs/04-bounded-contexts.md`](./docs/04-bounded-contexts.md) |
| Database & RLS | [`docs/05-database.md`](./docs/05-database.md) |
| REST + gRPC API | [`docs/06-api.md`](./docs/06-api.md) |
| Next.js frontend (tenant) | [`docs/07-frontend.md`](./docs/07-frontend.md) |
| Flutter mobile | [`docs/08-mobile.md`](./docs/08-mobile.md) |
| On-prem / Hetzner deploy | [`docs/09-devops.md`](./docs/09-devops.md) |
| 16-week roadmap | [`docs/10-roadmap.md`](./docs/10-roadmap.md) |
| Risk register | [`docs/11-risks.md`](./docs/11-risks.md) |
| Out of scope | [`docs/12-out-of-scope.md`](./docs/12-out-of-scope.md) |
| **Check-in admin app (D12, ADR-0014)** | [`docs/checkin-admin.md`](./docs/checkin-admin.md) |
| **Design system (Aurora + shadcn CLI)** | [`docs/design-system.md`](./docs/design-system.md) |
| 12 finalized decisions (D1–D12) | [`docs/decisions.md`](./docs/decisions.md) |
| Architecture Decision Records | [`docs/adr/`](./docs/adr/) |
| Phase issues (1 file per phase) | [`docs/issues/`](./docs/issues/) |

---

## Repository layout

```
apps/
  web/              # Next.js 16.2.x — tenant (organizer + public, D10)
  checkin-admin/      # Next.js 16.2.x — platform owner / support (D12, ADR-0014)
  mobile/           # Flutter (iOS + Android) — BLoC + Cubit (D9), offline-first
  api-gateway/      # NestJS (BFF: tenant module + checkin-admin module riêng, REST, WebSocket, BullMQ workers)
  core-api/         # .NET Core 10 (DDD layered core: SaasCheckin.sln + 14 project, custom base class; 2 Postgres role: app_runtime + app_platform_owner)
packages/
  contracts/        # Generated TS + Dart from OpenAPI/proto
  proto/            # .proto files (gRPC NestJS ↔ .NET Core 10)
  ui/               # React component library (Tailwind + shadcn) — cross-app only
  dart-core/        # Dart models shared across Flutter
infra/
  ansible/          # Playbooks for VPS provisioning
  docker/           # docker-compose files (dev + prod)
  github-actions/   # CI workflows
docs/               # All planning & decision docs (you are here)
tools/
  seed/             # Data fixtures
  loadtest/         # k6 scripts
```

---

## License

Proprietary. © 2026.
