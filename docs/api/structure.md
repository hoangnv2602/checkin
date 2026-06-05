# Structure · apps/core-api (SaasCheckin, .NET Core 10, DDD layered)

Cây thư mục đầy đủ và trách nhiệm từng project trong `apps/core-api/`. Cấu trúc gồm **HTTP host / Application / Domain / Infrastructure tách lớp rõ**, mọi base class đều tự code trong `shared/`.

## Cây thư mục

```
apps/core-api/
├── SaasCheckin.sln
├── Directory.Build.props                  # MSBuild chung (lang version, nullable, warnings)
├── Directory.Packages.props               # Central Package Management (NuGet version pin)
├── global.json                            # pin .NET SDK 10
├── .editorconfig                          # code style
├── .gitignore
├── Dockerfile                             # multi-stage Alpine
├── README.md
│
├── shared/                                # Shared kernel — dùng chung cho mọi bounded context
│   ├── Shared.Domain/                     # Building block phụ thuộc EF Core + DI (AggregateRoot, Entity, IDomainEvent, IMultiTenant, ICurrentTenant, Specification, audit)
│   ├── Shared.Domain.Core/                # Primitive thuần C#, không phụ thuộc EF Core (Result<T>, Guard, BusinessRuleValidationException, Clock, Money VO base)
│   ├── Shared.Application/                # Application infrastructure (IUnitOfWork, IRepository<>, IIntegrationEventBus, MediatR pipeline behaviors)
│   ├── Shared.Application.Contracts/      # Public contracts (IApplicationService, PagedResultDto, ICurrentUser, ICurrentTenant, PagedAndSortedResultRequestDto, IHasTotalCount)
│   ├── Shared.EntityFrameworkCore/        # EF Core base (EfRepository<,>, EfUnitOfWork, DbContextBase, TenantDbConnectionInterceptor, AuditableEntitySaveChangesInterceptor)
│   └── Utility/                           # Helper chung (Slugify, JsonConverter, IdempotencyKey, Serilog enricher)
│
└── src/                                   # Service cụ thể SaasCheckin
    ├── SaasCheckin.Domain.Core/           # Domain exceptions riêng, primitives, Money/Email/TenantId VOs base
    ├── SaasCheckin.Domain/                # Aggregates + VOs + events + repository interfaces + IModule cho 6 context
    │   ├── Identity/                      # User, Organization, Membership + module
    │   ├── EventManagement/               # Event, Session, Venue + module
    │   ├── Registration/                  # TicketType, Order, Registration + module
    │   ├── CheckIn/                       # CheckInRecord + module
    │   ├── Billing/                       # Subscription, Invoice, Plan + module
    │   ├── Notification/                  # Module (không có aggregate riêng; chỉ consumer)
    │   └── Modules/                       # IModule interface + base ModuleBase + host SaasCheckinHostModule
    │
    ├── SaasCheckin.Application.Contracts/ # Public DTOs + I*AppService interfaces cho 6 context
    ├── SaasCheckin.Application/           # *AppService implementations, validators (FluentValidation), mapping (Mapster), MediatR handlers
    ├── SaasCheckin.EntityFrameworkCore/   # SaasCheckinDbContext, IEntityTypeConfiguration<> cho mọi aggregate, migrations, value converters
    ├── SaasCheckin.Infrastructure/        # Adapter bên ngoài: Redis cache, Resend email, Twilio SMS, Stripe/VNPay payment, MassTransit publisher, gRPC service implementations
    ├── SaasCheckin.HttpApi.Host/          # Entry point runnable: Program.cs, controllers auto-gen, gRPC endpoints, Scalar (OpenAPI 3.1 UI), Serilog, OpenTelemetry, JWT auth, multi-tenant resolver, CORS, Kestrel
    └── SaasCheckin.DbMigrator/            # Console app chạy EF Core migrations + seed data; gọi khi deploy
```

## Trách nhiệm từng project

### `shared/` — Shared kernel (6 project)

| Project | Trách nhiệm | Phụ thuộc chính |
|---|---|---|
| **`Shared.Domain.Core`** | Primitive thuần C#, **không** phụ thuộc EF Core / DI. `Result<T>`, `Guard.AgainstNull(...)`, `BusinessRuleValidationException`, `DomainException`, `IClock` + `SystemClock`, `Money` base record. Có thể dùng trong test thuần + share cho client nếu cần. | `Microsoft.Extensions.Logging.Abstractions` |
| **`Shared.Application.Contracts`** | Public API surface: `IApplicationService` marker, `IQueryService<T>`, `ICrudAppService<TEntity, TDto, TCreateDto, TUpdateDto>`, DTOs (`PagedResultDto<T>`, `PagedAndSortedResultRequestDto`, `ListResultDto<T>`, `EntityDto<TKey>`), `ICurrentUser`, `IPermissionChecker`, `ILogger`. **Không có implementation** — chỉ contract để client reference. | `Microsoft.Extensions.DependencyInjection.Abstractions` |
| **`Shared.Application`** | Application infrastructure: `IUnitOfWork`, `IRepository<T, TKey>`, `IIntegrationEventBus`, `IIntegrationEventHandler<T>`, MediatR `IPipelineBehavior` (validation, logging, transaction, multi-tenant). Có base class `ApplicationService` cho `IApplicationService`. | `Shared.Application.Contracts`, `MediatR`, `FluentValidation` |
| **`Shared.Domain`** | Building block domain có DI: `AggregateRoot<TKey>`, `Entity<TKey>`, `ValueObject`, `IDomainEvent`, `IDomainEventHandler<T>`, `IMultiTenant`, `ICurrentTenant` (ambient scope), `ITenantResolver`, audit interfaces (`IHasCreationTime`, `IHasModificationTime`, `IHasDeletionTime`, `IHasCreator`), `Specification<T>`, `ISoftDelete`. | `Shared.Domain.Core`, `Microsoft.Extensions.DependencyInjection.Abstractions` |
| **`Shared.EntityFrameworkCore`** | EF Core implementation: `DbContextBase` (override `OnModelCreating`, register conventions), `EfRepository<T, TKey>` (generic CRUD), `EfUnitOfWork`, `TenantDbConnectionInterceptor` (set `app.current_tenant` qua `SET LOCAL`), `AuditableEntitySaveChangesInterceptor` (auto-fill `CreationTime`, `CreatorId`, ...), value converter cho `ValueObject` ↔ primitive, snake_case naming convention. | `Shared.Domain`, `Shared.Application`, `Microsoft.EntityFrameworkCore`, `Pomelo.EntityFrameworkCore.PostgreSQL` |
| **`Utility`** | Helper không business: `Slugify`, `JsonConverters` (Money, TenantId, Uuid), `IdempotencyKeyGenerator`, `SerilogTenantEnricher`, `PollyResiliencePipelineFactory`, `OpenTelemetryExtensions`. | `Serilog`, `Polly`, `OpenTelemetry.Extensions.Hosting` |

### `src/` — Service SaasCheckin (8 project)

| Project | Trách nhiệm | Phụ thuộc chính |
|---|---|---|
| **`SaasCheckin.Domain.Core`** | Domain primitive riêng SaasCheckin: `Money` record (currency-aware, operator overload), `Email` VO (RFC 5322 validate), `TenantId` VO, `StronglyTypedGuid` base, custom domain exceptions (`BusinessRuleViolationException`, `EntityNotFoundException`, `ConcurrencyException`). | `Shared.Domain.Core` |
| **`SaasCheckin.Domain`** | Domain layer SaasCheckin: aggregates + VOs + domain events + repository interfaces + **6 module class** (`IdentityModule`, `EventManagementModule`, `RegistrationModule`, `CheckInModule`, `BillingModule`, `NotificationModule`) + `SaasCheckinHostModule` load tất cả. | `Shared.Domain`, `SaasCheckin.Domain.Core` |
| **`SaasCheckin.Application.Contracts`** | Public DTO + `I*AppService` interface cho mỗi bounded context: `IEventAppService`, `ITicketTypeAppService`, `IRegistrationAppService`, `ICheckInAppService`, `ISubscriptionAppService`, `IOrganizationAppService`, ... Permission constants: `EventManagementPermissions.Events.Create`. | `Shared.Application.Contracts` |
| **`SaasCheckin.Application`** | Application service implementations, FluentValidation validators, Mapster mapping profile, MediatR command/query handlers, transaction handling, `IBusinessRuleValidator` wrapper. | `SaasCheckin.Application.Contracts`, `Shared.Application`, `FluentValidation`, `Mapster` |
| **`SaasCheckin.EntityFrameworkCore`** | `SaasCheckinDbContext : DbContextBase`, `IEntityTypeConfiguration<>` cho mọi aggregate, value converters, migrations folder, `IDesignTimeDbContextFactory<SaasCheckinDbContext>` cho `dotnet ef`. | `Shared.EntityFrameworkCore`, `SaasCheckin.Domain`, `Microsoft.EntityFrameworkCore.Design` |
| **`SaasCheckin.Infrastructure`** | Adapter bên ngoài: `RedisCacheAdapter`, `ResendEmailAdapter : IEmailSender`, `TwilioSmsAdapter : ISmsSender`, `StripePaymentAdapter : IPaymentProvider`, `VnpayPaymentAdapter : IPaymentProvider`, `MassTransitIntegrationEventBus : IIntegrationEventBus`, gRPC service implementations (`CheckInGrpcService`, `EventGrpcService`, ...). | `SaasCheckin.Application.Contracts`, `Shared.Application`, `StackExchange.Redis`, `Resend`, `Twilio`, `Stripe.net`, `MassTransit` + `MassTransit.RabbitMQ` |
| **`SaasCheckin.HttpApi.Host`** | Entry point runnable: `Program.cs` (minimal hosting + bounded-context module loader), gRPC service registration (`AddGrpc()`, `MapGrpcService<CheckInGrpcService>()`), controllers auto-gen từ `I*AppService`, Scalar (OpenAPI 3.1 UI), JWT authentication, multi-tenant resolver middleware, CORS, Serilog request logging, OpenTelemetry tracing/metrics/logs → OTLP, health checks (`/health/live`, `/health/ready`), gRPC health (`/grpc.health.v1.Health/Check`). | Tất cả project khác |
| **`SaasCheckin.DbMigrator`** | Console app EF Core: chạy `dbContext.Database.MigrateAsync()` cho tất cả DbContext + seed data (default plans, roles, permissions). Gọi qua `dotnet run --project src/SaasCheckin.DbMigrator` trong CI/CD. **Không** chạy trong runtime container. | `SaasCheckin.EntityFrameworkCore` |

## Phân biệt các cặp thường nhầm

### `*.Application` vs `*.Application.Contracts`

| Tiêu chí | `*.Application.Contracts` | `*.Application` |
|---|---|---|
| Vai trò | **What** — khai báo | **How** — triển khai |
| Chứa | `I*AppService` interface, DTO, permission constant | `*AppService` implementation, validator, mapping |
| Reference | Client (Blazor, MAUI), test, microservice khác | Chỉ trong service + Host |
| Phụ thuộc | `Shared.Application.Contracts` | `*.Application.Contracts` + `Shared.Application` + third-party (FluentValidation, Mapster) |
| Quy tắc | Không được reference EF Core, Infrastructure | Được reference cả hai |

### `*.Domain` vs `*.Domain.Core`

| Tiêu chí | `*.Domain.Core` | `*.Domain` |
|---|---|---|
| Vai trò | Domain primitive, không DI | Domain layer với DI |
| Chứa | VO base, exceptions, `Result<T>`, `Guard`, `IClock` | Aggregate, Entity, Domain Event, Repository interface, Module class |
| Phụ thuộc | Không | `*.Domain.Core` + `Shared.Domain` |
| Quy tắc | Test thuần được, không cần DI container | Cần DI container để wire up |

### `HttpApi.Host` vs `Application.Contracts`

| Tiêu chí | `Application.Contracts` | `HttpApi.Host` |
|---|---|---|
| Vai trò | Khai báo public API | Composition root chạy được |
| Chứa | `IEventAppService`, `CreateEventDto` | `Program.cs`, controllers, gRPC services, middleware |
| Output | `.dll` (NuGet) | `.exe` runnable |
| Quy tắc | Không chạy được | Phải chạy được `dotnet run` |

### `DbMigrator` vs `EntityFrameworkCore`

| Tiêu chí | `EntityFrameworkCore` | `DbMigrator` |
|---|---|---|
| Vai trò | Định nghĩa DbContext, mapping, migrations | Áp dụng migrations + seed |
| Output | `.dll` (EF Core tool generate migration vào đây) | `.exe` console chạy 1 lần |
| Quy tắc | Tất cả `IEntityTypeConfiguration<>` ở đây | Chỉ gọi `MigrateAsync()` + seed code; không có entity config |
| Khi nào chạy | Runtime + test (qua DI) | Deploy time (CI/CD step) |

## Code skeleton minh họa

### `SaasCheckin.Domain/Modules/IModule.cs`

```csharp
namespace SaasCheckin.Domain.Modules;

/// <summary>
/// Mỗi bounded context implement IModule để tự đăng ký DI, DbContext config, permission, settings.
/// Tự code bounded-context module loader. Mỗi bounded context tự đăng ký DI qua module class của riêng nó.
/// </summary>
public interface IModule
{
    string Name { get; }

    /// <summary>Đăng ký service vào DI container. Chạy theo thứ tự phụ thuộc.</summary>
    void ConfigureServices(IServiceCollection services, IConfiguration configuration);

    /// <summary>Hook chạy sau khi tất cả module ConfigureServices xong (DI final wiring).</summary>
    void OnApplicationInitialization(ApplicationInitializationContext context);

    /// <summary>Hook chạy trước khi shutdown (graceful close queue, dispose).</summary>
    void OnApplicationShutdown(ApplicationShutdownContext context);
}
```

### `SaasCheckin.Domain/Modules/ModuleBase.cs`

```csharp
public abstract class ModuleBase : IModule
{
    public abstract string Name { get; }

    public virtual void ConfigureServices(IServiceCollection services, IConfiguration configuration) { }
    public virtual void OnApplicationInitialization(ApplicationInitializationContext context) { }
    public virtual void OnApplicationShutdown(ApplicationShutdownContext context) { }
}
```

### `SaasCheckin.HttpApi.Host/Program.cs` (rút gọn)

```csharp
using SaasCheckin.Domain.Modules;
using SaasCheckin.Domain.Identity;
using SaasCheckin.Domain.EventManagement;
using SaasCheckin.Domain.Registration;
using SaasCheckin.Domain.CheckIn;
using SaasCheckin.Domain.Billing;
using SaasCheckin.Domain.Notification;

var builder = WebApplication.CreateBuilder(args);

// 1) Load modules theo thứ tự
var modules = new IModule[]
{
    new IdentityModule(),
    new EventManagementModule(),
    new RegistrationModule(),
    new CheckInModule(),
    new BillingModule(),
    new NotificationModule(),
    new SaasCheckinHostModule(modules: null!) // host module depend tất cả
};

foreach (var module in modules)
    module.ConfigureServices(builder.Services, builder.Configuration);

builder.Host.UseSerilog((ctx, lc) => lc.ReadFrom.Configuration(ctx.Configuration));

var app = builder.Build();

// 2) Pipeline
foreach (var module in modules)
    module.OnApplicationInitialization(new ApplicationInitializationContext(app.Services, app.Configuration));

// 3) Middleware
app.UseSerilogRequestLogging();
app.UseAuthentication();
app.UseMultiTenant();                    // resolve tenant từ JWT claim → ICurrentTenant
app.UseAuthorization();
app.MapControllers();
app.MapGrpcService<CheckInGrpcService>(); // gRPC từ api-gateway
app.MapHealthChecks("/health/live", new() { Predicate = c => c.Tags.Contains("live") });
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("ready") });
app.MapScalarApiReference();             // OpenAPI 3.1 UI thay Swagger UI

app.Run();
```

### `SaasCheckin.EntityFrameworkCore/SaasCheckinDbContext.cs`

```csharp
public class SaasCheckinDbContext : DbContextBase
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<TicketType> TicketTypes => Set<TicketType>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Registration> Registrations => Set<Registration>();
    public DbSet<CheckInRecord> CheckInRecords => Set<CheckInRecord>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public SaasCheckinDbContext(DbContextOptions<SaasCheckinDbContext> options, ICurrentTenant currentTenant)
        : base(options, currentTenant) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Áp dụng tất cả IEntityTypeConfiguration<> trong assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SaasCheckinDbContext).Assembly);
    }
}
```

### `Shared.EntityFrameworkCore/TenantDbConnectionInterceptor.cs`

```csharp
/// <summary>
/// EF Core interceptor: tự động set Postgres session var `app.current_tenant` mỗi lần connection open.
/// Kết hợp với RLS policy ở DB để enforce tenant isolation ở tầng defense-in-depth.
/// </summary>
public class TenantDbConnectionInterceptor : DbConnectionInterceptor
{
    private readonly ICurrentTenant _currentTenant;

    public TenantDbConnectionInterceptor(ICurrentTenant currentTenant) => _currentTenant = currentTenant;

    public override async Task ConnectionOpenedAsync(
        DbConnection connection, ConnectionEventData eventData, CancellationToken cancellationToken = default)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT set_config('app.current_tenant', @t, false)";
        var p = cmd.CreateParameter();
        p.ParameterName = "@t";
        p.Value = (object?)_currentTenant.Id?.ToString() ?? DBNull.Value;
        cmd.Parameters.Add(p);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }
}
```

### `Directory.Build.props` (snippet)

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <LangVersion>14.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  </PropertyGroup>
</Project>
```

### `Directory.Packages.props` (Central Package Management)

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="10.0.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.0" />
    <PackageVersion Include="Pomelo.EntityFrameworkCore.PostgreSQL" Version="10.0.0" />
    <PackageVersion Include="MediatR" Version="12.4.0" />
    <PackageVersion Include="MassTransit" Version="8.3.0" />
    <PackageVersion Include="MassTransit.RabbitMQ" Version="8.3.0" />
    <PackageVersion Include="Grpc.AspNetCore" Version="2.65.0" />
    <PackageVersion Include="Grpc.Tools" Version="2.65.0" />
    <PackageVersion Include="FluentValidation" Version="11.10.0" />
    <PackageVersion Include="Mapster" Version="7.4.0" />
    <PackageVersion Include="Serilog.AspNetCore" Version="8.0.3" />
    <PackageVersion Include="Scalar.AspNetCore" Version="2.0.0" />
    <PackageVersion Include="OpenTelemetry.Extensions.Hosting" Version="1.10.0" />
    <PackageVersion Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.10.0" />
    <PackageVersion Include="xunit" Version="2.9.2" />
    <PackageVersion Include="FluentAssertions" Version="7.0.0" />
    <PackageVersion Include="Testcontainers.PostgreSql" Version="4.0.0" />
    <PackageVersion Include="NetArchTest.Rules" Version="1.3.2" />
    <PackageVersion Include="AspNetCore.HealthChecks.NpgSql" Version="9.0.0" />
    <PackageVersion Include="AspNetCore.HealthChecks.Redis" Version="9.0.0" />
    <PackageVersion Include="Stateless" Version="5.16.0" />
  </ItemGroup>
</Project>
```

### `global.json`

```json
{
  "sdk": {
    "version": "10.0.100",
    "rollForward": "latestFeature"
  }
}
```

## Lịch sử quyết định backend

Backend core dùng .NET Core 10 — chi tiết tại [ADR-0013](../adr/0013-dotnet-core-10-ddd.md) (supersedes [ADR-0001](../adr/0001-stack-and-bff.md) và [ADR-0002](../adr/0002-ddd-style.md), đã từng chọn Symfony 8.x trước khi chuyển sang .NET). Project chưa từng có code Symfony — quyết định Symfony bị supersede cùng ngày (2026-06-04), không cần mapping table cho dev migrate.
