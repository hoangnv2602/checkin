# API · SaasCheckin (.NET Core 10, DDD layered)

Tài liệu chi tiết cho phần **API core** (apps/core-api) của SaasCheckin, viết bằng **.NET Core 10** theo **layout DDD layered** (HTTP host / Application / Domain / Infrastructure tách lớp rõ). Mọi base class đều tự code trong `shared/`.

## Cấu trúc thư mục

| File | Nội dung |
|---|---|
| [`structure.md`](./structure.md) | Cây thư mục đầy đủ, trách nhiệm từng project, mapping `src/` ↔ `shared/` |
| [`building-blocks.md`](./building-blocks.md) | Catalog các building block DDD: `AggregateRoot`, `ValueObject`, `IRepository`, `IUnitOfWork`, `ICurrentTenant`, `IModule`, outbox, ... kèm code skeleton C# |
| [`bounded-contexts.md`](./bounded-contexts.md) | Cách tổ chức 6 bounded context (Identity, EventManagement, Registration, CheckIn, Billing, Notification) như module con trong 1 monolith-modular |

## Liên quan

- **Tech stack rationale:** [`../02-tech-stack.md`](../02-tech-stack.md) § Core domain
- **Architecture overview:** [`../01-architecture.md`](../01-architecture.md)
- **Monorepo layout:** [`../03-monorepo.md`](../03-monorepo.md) § apps/core-api
- **Bounded context overview:** [`../04-bounded-contexts.md`](../04-bounded-contexts.md)
- **Database / RLS:** [`../05-database.md`](../05-database.md)
- **REST + gRPC API surface:** [`../06-api.md`](../06-api.md)
- **ADR:** [`../adr/0013-dotnet-core-10-ddd.md`](../adr/0013-dotnet-core-10-ddd.md) — supersede ADR-0001, ADR-0002

## Nguyên tắc cốt lõi

1. **Monolith-modular, 1 service:** `apps/core-api/SaasCheckin.sln` chứa 14 project (.csproj). 6 bounded context là **module** con trong `SaasCheckin.Domain/`.
2. **Layered architecture (DDD Vernon):** `Domain` ← `Application.Contracts` ← `Application` → `Infrastructure` / `EntityFrameworkCore` / `HttpApi.Host`.
3. **Shared kernel** ở `shared/Shared.*` (6 project) — dùng chung cho mọi service tiềm năng trong tương lai.
4. **Custom base class, không framework third-party**: tự viết `AggregateRoot`, `ValueObject`, `IRepository`, `IUnitOfWork`, `IBoundedContextModule`, `ICurrentTenant`, outbox infrastructure. Lý do: tránh vendor-lock-in, kiểm soát pattern, dễ debug.
5. **Multi-tenant 2 lớp:** Postgres RLS (defense in depth) + EF Core `TenantDbConnectionInterceptor` set `app.current_tenant` mỗi connection.
6. **Domain event + Outbox:** local event qua MediatR (in-process) + distributed event qua MassTransit + RabbitMQ (cross-service) + outbox table đảm bảo at-least-once.
7. **Multi-protocol host:** `SaasCheckin.HttpApi.Host` expose **REST + gRPC + WebSocket + Health checks** trên cùng Kestrel. BFF NestJS chỉ gọi gRPC.
