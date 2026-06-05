# apps/core-api — .NET 10 DDD Core API (ADR-0013)

> .NET Core 10, DDD layered (custom base class trong `shared/Shared.Domain/`).
> Chứa **TẤT CẢ business logic** (CLAUDE.md rule #1). NestJS BFF (`apps/api-gateway`)
> chỉ là I/O — gọi sang đây qua gRPC.

## Layout

```
apps/core-api/
├── shared/                              # Cross-cutting base classes (6 projects)
│   ├── Shared.Domain.Core/              # AggregateRoot, ValueObject, IDomainEvent, IClock
│   ├── Shared.Domain/                   # IBoundedContextModule
│   ├── Shared.Application.Contracts/    # Marker interfaces (ICommand, IQuery)
│   ├── Shared.Application/              # MediatR behaviors, validation pipeline
│   ├── Shared.EntityFrameworkCore/      # SharedDbContext + interceptors (tenant, soft delete)
│   └── Utility/                         # BCrypt, helper utilities
├── src/                                 # Domain code (8 projects)
│   ├── SaasCheckin.Domain.Core/         # No deps — pure DDD primitives
│   ├── SaasCheckin.Domain/              # Aggregate + VO + Event + Repo interface
│   │   └── Identity/                    # Bounded context: User, Organization, Membership
│   ├── SaasCheckin.Application.Contracts/  # Use case interfaces, DTOs
│   ├── SaasCheckin.Application/         # Use case handlers (MediatR)
│   ├── SaasCheckin.EntityFrameworkCore/ # DbContext, EF Configurations, Migrations
│   ├── SaasCheckin.Infrastructure/      # External adapters (email, payment, ...)
│   ├── SaasCheckin.HttpApi.Host/        # gRPC + minimal HTTP for health
│   └── SaasCheckin.DbMigrator/          # Standalone migration runner
├── tests/                               # 3 test projects
│   ├── Shared.Domain.Tests/
│   ├── SaasCheckin.Domain.Tests/        # Aggregate unit tests + xUnit
│   └── SaasCheckin.ArchitectureTests/   # NetArchTest: enforce layer boundaries
├── Directory.Build.props                # Nullable, warnings-as-errors, C# 14
├── Directory.Packages.props             # Central Package Management
├── global.json                          # Pin .NET 10 SDK
├── SaasCheckin.sln                      # 14 projects + 3 test projects
└── Dockerfile                           # multi-stage Alpine
```

## Phase 0 status

- ✅ 14 projects (6 shared + 8 src) + 3 test projects scaffolded
- ✅ Base classes: `AggregateRoot<TKey>`, `ValueObject`, `IDomainEvent`, `IClock`
- ✅ Identity bounded context mẫu: `User` aggregate + 3 VOs + 3 events + `IUserRepository`
- ✅ `Program.cs` HttpApi.Host chạy được (cần `dotnet restore` + DB)
- ✅ EF Core DbContext + User entity config
- ✅ gRPC CheckInService stub
- ✅ DbMigrator standalone
- ⏳ Phase 1+ mới có: `EfUserRepository`, `BCryptPasswordHasher`, `IUserAppService`, real migrations, JWT issuance

## Quick start (dev)

```bash
# 1. Start DB
task dev:up

# 2. Run migrations
dotnet run --project apps/core-api/src/SaasCheckin.DbMigrator

# 3. Run API
dotnet run --project apps/core-api/src/SaasCheckin.HttpApi.Host
# → http://localhost:5000/scalar/v1 (OpenAPI UI)
# → http://localhost:5000/health/live
# → http://localhost:5000/health/ready
# → gRPC: localhost:50051
```

## Tests

```bash
dotnet test apps/core-api
```

## Conventions

- **C# 14, nullable on, warnings as errors** (`Directory.Build.props`).
- **Aggregate root**: extend `AggregateRoot<TKey>`. KHÔNG expose setter cho state.
- **Value object**: extend `ValueObject`, override `GetEqualityComponents()`.
- **Repository**: interface ở `SaasCheckin.Domain/<Context>/Repositories/I<Name>Repository.cs`,
  implementation ở `SaasCheckin.EntityFrameworkCore/<Context>/`.
- **Domain event**: `sealed record` implement `IDomainEvent`.
- **Business rule violation**: throw `BusinessRuleViolationException` (mapped ở HTTP layer).

## Multi-tenant (D1, ADR-0003)

- Mọi business table có `tenant_id` + RLS policy.
- `TenantDbConnectionInterceptor` (Phase 1) sẽ `SET LOCAL app.current_tenant = '<id>'`
  mỗi connection open.
- `users` table là GLOBAL (không RLS) — tenant context đến qua `memberships` aggregate.

## Permission (D13, ADR-0015)

- 5 roles: owner, admin, organizer, staff, viewer.
- Permission keys khai báo ở `SaasCheckin.Domain/<Context>/Authorization/Permissions.cs`.
- Role → Permission map ở `RolePermissionMap.cs` (BFF resolve ở JWT issue-time).
- `.NET PermissionBehavior` (Phase 1) sẽ enforce MediatR pipeline.
