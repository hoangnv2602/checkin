# apps/api-gateway — NestJS BFF (D12)

> NestJS 11 — REST + Socket.IO + BullMQ + gRPC client tới core-api.
> **I/O only** (CLAUDE.md rule #1): auth, WebSocket, queue, proxy. KHÔNG chứa
> domain rules (chúng sống ở `apps/core-api` qua gRPC + events).

## Modules

| Module | Phase | Mục đích |
|---|---|---|
| `health` | 0 | `/health/live`, `/health/ready` (K8s probe) |
| `auth` | 1 | stub issue/verify JWT |
| `events` | 2 | stub proxy → core-api |
| `realtime` | 0 | Socket.IO + Redis adapter (scale horizontal) |
| `jobs` | 1 | BullMQ init (email, webhook, ...) |
| `core-api` | 1 | gRPC client skeleton tới `core-api:50051` |

## Quick start (dev)

```bash
# Từ repo root
task dev:up
pnpm --filter @saas-checkin/api-gateway dev
# → http://localhost:3001
# → http://localhost:3001/v1/docs (Swagger UI)
```

## Ports

- `3001` — HTTP (REST + Swagger)
- `3001` — Socket.IO (cùng port, WebSocket upgrade)

## Boundaries

- **No business logic** — chỉ I/O. Tất cả domain rules qua gRPC tới core-api.
- **No RLS bypass** — gọi core-api với `app.current_tenant` đã set, KHÔNG tự query DB.
- **JWT verification** — `JwtAuthGuard` verify token từ `Authorization: Bearer <token>`.
  Authorization check chi tiết (D13) chạy ở core-api (`.NET PermissionBehavior`).
