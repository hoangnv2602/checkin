# 0013. Core API: .NET Core 10 + DDD layered (custom base class)

- **Status:** Accepted (D3 — supersedes [0001](./0001-stack-and-bff.md), [0002](./0002-ddd-style.md))
- **Date:** 2026-06-04
- **Deciders:** @team/tech-leads
- **Related:** [D3 in decisions.md](../decisions.md), [docs/api/](../api/README.md)

## Context

ADR-0001 chốt backend core dùng **Symfony 8.x** (PHP 8.4, Doctrine, Messenger, FrankenPHP) với lý do: pattern DDD trưởng thành nhất trong cộng đồng PHP, Doctrine tách persistence khỏi domain, Messenger là outbox/event bus sạch nhất.

Sau khi bắt đầu implement, các yếu tố sau đã thay đổi:

1. **Team composition thực tế:** 2/3 dev có kinh nghiệm C# enterprise (.NET 6/7/8) mạnh hơn PHP. Chỉ 1 dev thành thạo Symfony.
2. **Stack đồng nhất về type safety:** Next.js + Flutter + NestJS đều dùng TypeScript/Dart. Backend Symfony bằng PHP làm gãy "end-to-end type-safe contract" — bug runtime do serialize mismatch giữa 2 ngôn ngữ.
3. **Ecosystem enterprise 2026:** .NET 10 có MassTransit, MediatR, EF Core 10, Stateless, Scalar, Serilog, OpenTelemetry — đây là bộ DDD/outbox/event-bus trưởng thành ngang hoặc hơn Symfony Messenger + Doctrine.
4. **Hiring:** tuyển C# engineer dễ hơn PHP engineer ở thị trường Việt Nam; dev onboard quen pattern DDD + Clean Architecture.
5. **Hiệu năng runtime:** Kestrel benchmark ngang NGINX + FrankenPHP, type system C# phát hiện mismatch ở compile-time (DTO ↔ gRPC message ↔ EF entity).
6. **Một số pattern cần tái sử dụng:** Billing cần state machine cho subscription, multi-tenant resolver, outbox pattern — tất cả đều có sẵn pattern DDD trong .NET (Stateless, EF Core Interceptor, MassTransit).

Tuy nhiên, **không phụ thuộc framework DDD third-party**:
- Tránh vendor lock-in vào thư viện third-party.
- Kiểm soát hoàn toàn pattern: mọi base class (`AggregateRoot`, `ValueObject`, `IRepository`, `IBoundedContextModule`, `ICurrentTenant`) đều tự code trong `shared/`.
- Debug dễ, không cần navigate framework internal.
- Layout tự thiết kế theo Clean Architecture + Vernon DDD tactical, không qua NuGet package.

## Decision

Chuyển `apps/core-api` từ **Symfony 8.x (PHP)** sang **.NET Core 10 (C# 14)** theo **layout DDD layered** (HttpApi.Host / Application / Domain / Infrastructure tách lớp rõ) mà team đã chốt. Cụ thể:

```
apps/core-api/
├── SaasCheckin.sln
├── Directory.Build.props             # MSBuild chung: nullable, warnings-as-errors, lang 14
├── Directory.Packages.props          # Central Package Management
├── global.json                       # pin .NET 10 SDK
├── Dockerfile                        # multi-stage mcr.microsoft.com/dotnet/{sdk,aspnet}:10.0-alpine
├── shared/                           # Shared kernel — 6 project
│   ├── Shared.Domain.Core/           # primitive thuần C# (Result<T>, Guard, Money base)
│   ├── Shared.Domain/                # AggregateRoot, Entity, ValueObject, IDomainEvent, IMultiTenant, ICurrentTenant, Specification
│   ├── Shared.Application.Contracts/ # IApplicationService, PagedResultDto, ICurrentUser
│   ├── Shared.Application/           # IUnitOfWork, IRepository, IIntegrationEventBus, MediatR behaviors
│   ├── Shared.EntityFrameworkCore/   # EfRepository<,>, EfUnitOfWork, TenantDbConnectionInterceptor
│   └── Utility/                      # Slugify, JsonConverters, Polly, OTel helpers
└── src/                              # Service cụ thể — 8 project
    ├── SaasCheckin.Domain.Core/      # domain primitive riêng (Money, Email, TenantId)
    ├── SaasCheckin.Domain/           # 6 bounded context như module con
    ├── SaasCheckin.Application.Contracts/  # I*AppService + DTO
    ├── SaasCheckin.Application/      # *AppService + FluentValidation + Mapster
    ├── SaasCheckin.EntityFrameworkCore/   # DbContext + IEntityTypeConfiguration + migrations
    ├── SaasCheckin.Infrastructure/   # Resend, Twilio, Stripe, VNPay, MassTransit, gRPC services
    ├── SaasCheckin.HttpApi.Host/     # Composition root: REST + gRPC + WSS + Scalar + health
    └── SaasCheckin.DbMigrator/       # Console chạy migrations + seed
```

**Topology:** Monolith-modular — 1 solution duy nhất, 6 bounded context (Identity, EventManagement, Registration, CheckIn, Billing, Notification) được tổ chức như các **module** (folder + bounded-context registration class) trong `SaasCheckin.Domain/`. Có thể tách `CheckIn` thành microservice riêng trong tương lai nếu throughput yêu cầu (boundary đã rõ).

**Stack runtime chính:**

| Concern | Công nghệ |
|---|---|
| HTTP host | ASP.NET Core 10 (Kestrel) |
| ORM | EF Core 10 + `Pomelo.EntityFrameworkCore.PostgreSQL` |
| DI | `Microsoft.Extensions.DependencyInjection` + `Microsoft.Extensions.Hosting` |
| Validation | FluentValidation 11 |
| Mapping | Mapster 7 |
| In-process messaging | MediatR 12 |
| Distributed messaging | MassTransit 8 + RabbitMQ |
| State machine | Stateless 5 |
| gRPC | `Grpc.AspNetCore` + `Grpc.Tools` |
| OpenAPI UI | Scalar (thay Swagger UI) |
| Logging | Serilog → OpenTelemetry OTLP → Loki |
| Tracing/Metrics | OpenTelemetry .NET SDK |
| Health checks | `AspNetCore.HealthChecks.*` |
| Testing | xUnit + FluentAssertions + Testcontainers + NetArchTest |
| Caching | `StackExchange.Redis` + `Microsoft.Extensions.Caching` |

**BFF giữ nguyên NestJS** (`apps/api-gateway`) — chỉ gọi `SaasCheckin.HttpApi.Host` qua gRPC. Quy tắc "BFF chỉ làm I/O" trong CLAUDE.md rule 1 vẫn còn.

## Consequences

### Positive

- **Type-safe end-to-end:** từ Postgres entity → EF Core → Application service → gRPC message → TS client. Compile-time bắt mismatch.
- **Ecosystem DDD mạnh ngang PHP:** MassTransit outbox, MediatR pipeline, Stateless, EF Core, Scalar — tất cả first-class trong .NET 10.
- **Hiệu năng runtime:** Kestrel xử lý 10k+ req/s trên 1 instance; EF Core 10 có `ExecuteUpdate`/`ExecuteDelete` giảm round-trip; gRPC binary nhanh hơn JSON REST 5–10x.
- **Refactor tự tin:** Roslyn analyzers + nullable reference types + NetArchTest enforce pattern tầng build/test, không cần code review thủ công.
- **Hiring dễ:** thị trường Việt Nam có nhiều C# engineer (outsource + product).
- **Tooling trưởng thành:** JetBrains Rider, Visual Studio, `dotnet` CLI, GitHub Actions cho .NET đều best-in-class.
- **Giữ dependency nhẹ:** không framework DDD third-party, tự code base class nên dễ customize, dễ migrate nếu cần.

### Negative

- **Learning curve cho team PHP:** C# record, EF Core tracking, async/await, LINQ — cần 1-2 sprint để prod-ready.
- **Tự maintain base class:** `AggregateRoot`, `IModule`, outbox infrastructure — tự code có nghĩa tự fix bug. NetArchTest bù đắp phần lớn.
- **Phải migrate schema:** dùng `Pomelo.EntityFrameworkCore.PostgreSQL` tương thích cú pháp SQL cũ, nhưng tên bảng convention snake_case cần `EFCore.NamingConventions` package.
- **Một số pattern .NET có nhiều cách làm (MediatR vs MassTransit vs Wolverine):** đã chốt stack ở trên, cần discipline để không drift.

### Neutral

- **Monolith-modular giữ đơn giản Phase 0–5:** 1 deploy unit, 1 DbContext, 1 connection pool. Phase 6+ cân nhắc tách `CheckIn` nếu throughput vượt 5000 scan/giây.
- **Migrate proto file không đổi:** gRPC proto là language-agnostic; `CheckInService` proto từ `packages/proto/checkin/v1/checkin.proto` giữ nguyên, chỉ đổi implementation từ `roadrunner-grpc` sang `Grpc.AspNetCore`.
- **BFF proto client từ NestJS không đổi:** `apps/api-gateway/src/infra/grpc/` dùng `@grpc/grpc-js` vẫn hoạt động với server .NET.

## Alternatives considered

- **Dùng framework DDD third-party đầy đủ** (vd các framework DDD thương mại / open-source trưởng thành) — từ chối:
  - Vendor lock-in sâu: pattern mọi nơi theo convention framework; migrate sang framework khác rất tốn.
  - Overkill cho MVP: framework thêm abstraction (permission, setting, feature management) mà SaasCheckin tự code nhẹ hơn.
  - Custom base class cho phép team hiểu sâu pattern DDD, không phải "magic" từ framework.

- **Giữ Symfony 8.x** — từ chối:
  - Team strength lệch về C#.
  - Type system PHP 8.4 yếu hơn C# 14 (no compile-time contract check giữa domain ↔ DTO).
  - Dev onboarding từ Next.js/Flutter sang Symfony khó hơn sang ASP.NET Core.

- **Spring Boot (Java)** — từ chối:
  - Team thiếu kinh nghiệm Spring gần đây; start chậm.
  - JVM memory footprint cao hơn Kestrel cho cùng throughput ở scale MVP.

- **Go + gRPC thuần** — từ chối:
  - Thiếu ecosystem DDD tactical (không có AggregateRoot base, không có MediatR tương đương).
  - Web framework (Gin/Echo) yếu hơn ASP.NET Core cho REST + gRPC cùng host.

- **NestJS làm cả backend (bỏ core-api)** — từ chối:
  - DDD pattern TypeScript chưa trưởng bằng C# (`class-validator` + TypeORM dễ bị anti-pattern anemic model).
  - Khó enforce multi-tenant với RLS ở TypeORM so với EF Core interceptor.

## Pattern tham khảo

Layout và tên project lấy cảm thức từ:
- (Đã tham khảo tổng hợp từ eShopOnContainers + Clean Architecture template; xem chi tiết ở "Pattern tham khảo" bên dưới)
- [Microsoft eShopOnContainers](https://github.com/dotnet-architecture/eShopOnContainers) — pattern gRPC, CQRS, EventBus.
- [MassTransit documentation](https://masstransit.io/documentation/concepts) — outbox, saga, consumer.

## Anti-pattern enforce qua NetArchTest

```csharp
[Fact]
public void Domain_Should_Not_Depend_On_Application_Or_Infrastructure() { /* ... */ }

[Fact]
public void Application_Contracts_Should_Not_Depend_On_Application() { /* ... */ }

[Fact]
public void Repositories_Should_Only_Implement_Interface_In_Domain() { /* ... */ }
```

Test trong `tests/SaasCheckin.Architecture.Tests/`, chạy ở CI step riêng.

## Migration từ Symfony (nếu đã viết code)

Xem bảng mapping chi tiết trong [`docs/api/structure.md` § Mapping Symfony cũ → .NET mới](../api/structure.md). Tóm tắt:

| Symfony | .NET |
|---|---|
| `src/Kernel.php` | `src/SaasCheckin.HttpApi.Host/Program.cs` + `Domain/Modules/` |
| `src/<Context>/Domain/Model/<Aggregate>.php` | `src/SaasCheckin.Domain/<Context>/Aggregates/<Aggregate>.cs` |
| `src/<Context>/Domain/Repository/<Aggregate>Repository.php` (interface) | `src/SaasCheckin.Domain/<Context>/Repositories/I<Aggregate>Repository.cs` |
| `src/<Context>/Infrastructure/Doctrine/<Aggregate>RepositoryImpl.php` | `src/SaasCheckin.EntityFrameworkCore/Repositories/<Aggregate>Repository.cs` |
| `migrations/Version*.php` | `src/SaasCheckin.EntityFrameworkCore/Migrations/<timestamp>_<name>.cs` |
| `bin/console doctrine:migrations:migrate` | `dotnet run --project src/SaasCheckin.DbMigrator` |
| `composer.json` | `*.csproj` + `Directory.Packages.props` |

Project hiện đang ở **Phase 0 — chưa có code**, nên migration chỉ áp dụng cho tài liệu (file `.md`) và `IaC` skeleton.

## Revisit if

- Qua Phase 3 mà CheckIn vượt 5k scan/giây → tách CheckIn thành service riêng.
- Custom base class trở thành gánh nặng maintain (nhiều bug tái diễn) → tham khảo base class từ open-source DDD template trưởng thành (vd ardalis/CleanArchitecture, vkhorikov/DddTemplate).
- Cộng đồng .NET phát hành base class DDD open-source trưởng thành hơn (vd ardalis/CleanArchitecture) → cân nhắc tham khảo hoặc dùng trực tiếp.
- Cần thêm bounded context (vd Audit, Reporting) mà conflict với layout hiện tại → refactor sang vertical-slice.

## References

- [`docs/api/README.md`](../api/README.md) — index tài liệu API
- [`docs/api/structure.md`](../api/structure.md) — chi tiết layout từng project
- [`docs/api/building-blocks.md`](../api/building-blocks.md) — catalog DDD base class với code skeleton
- [`docs/api/bounded-contexts.md`](../api/bounded-contexts.md) — module hóa 6 context
- [`docs/02-tech-stack.md`](../02-tech-stack.md) § Core domain — tech stack rationale
- [`docs/01-architecture.md`](../01-architecture.md) — architecture overview
- [Microsoft eShopOnContainers](https://github.com/dotnet-architecture/eShopOnContainers) — tham khảo .NET layered microservice
- [Clean Architecture — Jason Taylor](https://github.com/jasontaylordev/CleanArchitecture) — template tham khảo
- [MassTransit outbox](https://masstransit.io/documentation/patterns/transactional-publishing) — pattern at-least-once
- [EF Core docs](https://learn.microsoft.com/en-us/ef/core/) — ORM
