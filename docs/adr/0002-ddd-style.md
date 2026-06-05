# 0002. DDD tactical style

- **Status:** Superseded by [0013-dotnet-core-10-ddd.md](./0013-dotnet-core-10-ddd.md)
- **Date:** 2026-06-04

> **Lưu ý:** ADR này đã được supersede bởi ADR-0013 (chuyển từ Symfony sang .NET Core 10). Decision high-level (tactical DDD Vernon + shared kernel) vẫn còn; layout thay đổi từ `src/<Context>/{Domain,Application,Infrastructure,UI}` (Symfony) sang `src/SaasCheckin.Domain/<Context>/` (.NET DDD layered).

## Context

Team cần từ vựng chung và cấu trúc code cho .NET Core 10 core. Nếu không có, code sẽ trôi thành anemic model + service béo trong vòng một sprint.

## Decision

Áp dụng **tactical DDD kiểu Vernon** cho mọi bounded context trong `apps/core-api/src/SaasCheckin.Domain/<Context>/`:

```
<Context>/
├── <Context>Module.cs                    # IModule implementation
├── Aggregates/                           # root entities (FullAuditedAggregateRoot<Guid>, IMultiTenant)
│   ├── <Aggregate>.cs
│   └── ...
├── ValueObjects/                         # record bất biến (kế thừa ValueObject)
├── Events/                               # domain event (in-process) + integration event (cross-service)
│   ├── <Event>DomainEvent.cs
│   └── <Event>IntegrationEvent.cs
├── Exceptions/                           # context-specific exceptions
├── Repositories/                         # IRepository<> interfaces
├── Specifications/                       # predicate objects
└── Services/                             # domain service (hiếm, khi logic span nhiều aggregate)
```

Mỗi context còn có file tương ứng trong `SaasCheckin.Application/`, `SaasCheckin.Application.Contracts/`, `SaasCheckin.EntityFrameworkCore/Configurations/<Context>/`, `SaasCheckin.Infrastructure/`.

**Building block** dùng chung nằm ở `apps/core-api/shared/Shared.*` (xem chi tiết trong [`docs/api/structure.md`](../api/structure.md) và [`docs/api/building-blocks.md`](../api/building-blocks.md)):

| Project | Chứa |
|---|---|
| `Shared.Domain.Core` | `Result<T>`, `Guard`, `BusinessRuleViolationException`, `IClock` + `SystemClock` |
| `Shared.Domain` | `AggregateRoot<TKey>`, `Entity<TKey>`, `ValueObject` (record), `IDomainEvent`, `IDomainEventHandler<T>`, `IMultiTenant`, `ICurrentTenant`, audit interfaces, `Specification<T>`, `IModule` |
| `Shared.Application.Contracts` | `IApplicationService`, `IQueryService<T>`, `ICrudAppService`, DTOs (`PagedResultDto<T>`, ...), `ICurrentUser`, `IPermissionChecker` |
| `Shared.Application` | `IUnitOfWork`, `IRepository<T, TKey>`, `IIntegrationEventBus`, MediatR pipeline behaviors (validation, logging, transaction, multi-tenant) |
| `Shared.EntityFrameworkCore` | `DbContextBase`, `EfRepository<T, TKey>`, `EfUnitOfWork`, `TenantDbConnectionInterceptor`, `AuditableEntitySaveChangesInterceptor`, value converter cho `ValueObject` |
| `Utility` | `Slugify`, `JsonConverters`, `IdempotencyKeyGenerator`, `SerilogTenantEnricher`, `PollyResiliencePipelineFactory`, `OpenTelemetryExtensions` |

**Code skeleton** (xem chi tiết trong [`docs/api/building-blocks.md`](../api/building-blocks.md)):

```csharp
// Aggregate
public class Event : FullAuditedAggregateRoot<Guid>, IMultiTenant
{
    public Guid? TenantId { get; set; }
    public string Title { get; private set; } = default!;
    public DateTime StartAt { get; private set; }
    public DateTime EndAt { get; private set; }
    public EventStatus Status { get; private set; }

    public void Publish()
    {
        if (Status != EventStatus.Draft)
            throw new BusinessRuleViolationException("Only draft events can be published.");
        Status = EventStatus.Published;
        AddDomainEvent(new EventPublishedDomainEvent(Id, TenantId, Title));
        AddIntegrationEvent(new EventPublishedIntegrationEvent(Id, TenantId!.Value, Title, StartAt));
    }
}

// Value Object (record)
public sealed record Money(decimal Amount, string Currency) : ValueObject
{
    public static Money Zero(string currency = "VND") => new(0m, currency);
    public Money Add(Money other) => /* ... */;
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

## Consequences

### Positive
- Dev mới tìm code theo layout thư mục, không cần tribal knowledge.
- Aggregate giữ tinh khiết: không có reference EF Core / MassTransit / MediatR bên trong layer Domain; mọi mapping nằm ở `SaasCheckin.EntityFrameworkCore/Configurations/`.
- Pattern Outbox + Domain Event + Integration Event được enforce qua `IUnitOfWork` + `OutboxRelayService` + `IIntegrationEventBus` (MassTransit).
- Reviewer check invariant ở một nơi.
- NetArchTest trong CI enforce: Domain không depend Application/Infrastructure; Application.Contracts không depend Application; Repositories chỉ ở Domain.

### Negative
- Nhiều file hơn cho mỗi feature (thường 8–12 cho một use case). Đánh đổi để rõ ràng.
- Dev mới chưa quen DDD cần onboarding (recommend sách Vernon + đọc `docs/api/building-blocks.md`).
- Phải tự maintain base class (so với dùng framework DDD đầy đủ — sẽ tiết kiệm thời gian đầu nhưng lock-in).

### Neutral
- Một ít trùng lặp giữa các context là OK — đừng abstract sớm.
- Tách `*.Domain` vs `*.Domain.Core` giúp test thuần (không cần DI container) cho VO / exception / Result.

## Anti-pattern (enforce qua review + NetArchTest)

- ❌ Inject `DbContext` hoặc `IRepository<>` (của context khác) vào constructor aggregate
- ❌ Inject aggregate root của context khác vào aggregate của context này (dùng ID + IIntegrationEvent)
- ❌ Public setter trên entity (dùng method hành vi như `Cancel()`, `Reschedule()`, `Publish()`)
- ❌ Tham chiếu trực tiếp chéo aggregate (dùng ID + repository)
- ❌ Anemic model (logic ở controller, entity chỉ là data bag)
- ❌ Lazy loading quan hệ bên trong method aggregate (gây N+1 + coupling DB)
- ❌ Layer Domain phụ thuộc namespace `Microsoft.EntityFrameworkCore.*`, `MassTransit.*`, `MediatR.*`
- ❌ Application service reference trực tiếp `DbContext` (phải qua `IRepository<>`)

## References

- [`docs/api/structure.md`](../api/structure.md) — cây thư mục + trách nhiệm từng project
- [`docs/api/building-blocks.md`](../api/building-blocks.md) — catalog từng base class với code skeleton
- [`docs/api/bounded-contexts.md`](../api/bounded-contexts.md) — module hóa 6 context
- Vaughn Vernon — *Implementing Domain-Driven Design* (chương 5–8)
- [Microsoft eShopOnContainers](https://github.com/dotnet-architecture/eShopOnContainers) — tham khảo layout .NET layered microservice
- [NetArchTest](https://github.com/BenMorris/NetArchTest) — architecture unit test
