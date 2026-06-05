# Building Blocks · DDD + Cross-cutting (.NET)

Catalog các building block DDD và cross-cutting concern. Tất cả code dưới đây là **skeleton tham khảo** — project thực tế sẽ tinh chỉnh khi implement. Mục tiêu: dev mới mở repo là hiểu ngay pattern, không cần tribal knowledge.

> **Quy ước:** tất cả base class nằm trong `shared/Shared.Domain/` (có DI) hoặc `shared/Shared.Domain.Core/` (không DI). Mọi code dưới đây đặt namespace theo project tương ứng.

---

## 1. Aggregate Root + Entity

```csharp
// shared/Shared.Domain/Abstractions/Entity.cs
namespace Shared.Domain.Abstractions;

public abstract class Entity<TKey>
    where TKey : notnull
{
    public TKey Id { get; protected set; } = default!;

    public override bool Equals(object? obj) =>
        obj is Entity<TKey> other && GetType() == other.GetType() && EqualityComparer<TKey>.Default.Equals(Id, other.Id);

    public override int GetHashCode() => HashCode.Combine(GetType(), Id);
}

// shared/Shared.Domain/Abstractions/AggregateRoot.cs
public abstract class AggregateRoot<TKey> : Entity<TKey>, IHasDomainEvents
    where TKey : notnull
{
    private readonly List<IDomainEvent> _domainEvents = new();

    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(IDomainEvent @event) => _domainEvents.Add(@event);

    public void ClearDomainEvents() => _domainEvents.Clear();
}

// shared/Shared.Domain/Abstractions/IHasDomainEvents.cs
public interface IHasDomainEvents
{
    IReadOnlyList<IDomainEvent> DomainEvents { get; }
    void ClearDomainEvents();
}
```

### Audit + soft delete + multi-tenant mixin

```csharp
// shared/Shared.Domain/Auditing/FullAuditedAggregateRoot.cs
public abstract class FullAuditedAggregateRoot<TKey> : AggregateRoot<TKey>, IFullAudited
    where TKey : notnull
{
    public DateTime CreationTime { get; set; }
    public Guid? CreatorId { get; set; }
    public DateTime? LastModificationTime { get; set; }
    public Guid? LastModifierId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletionTime { get; set; }
    public Guid? DeleterId { get; set; }
}

// shared/Shared.Domain/MultiTenancy/IMultiTenant.cs
public interface IMultiTenant
{
    Guid? TenantId { get; set; }
}
```

---

## 2. Value Object

```csharp
// shared/Shared.Domain/Abstractions/ValueObject.cs
namespace Shared.Domain.Abstractions;

public abstract record ValueObject
{
    protected abstract IEnumerable<object?> GetEqualityComponents();

    // record đã có Equals/GetHashCode tự sinh theo property;
    // override nếu cần custom equality
}
```

### Ví dụ `Money`

```csharp
// src/SaasCheckin.Domain.Core/Money.cs
public sealed record Money(decimal Amount, string Currency) : ValueObject
{
    public static Money Zero(string currency = "VND") => new(0m, currency);

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new BusinessRuleViolationException($"Currency mismatch: {Currency} vs {other.Currency}");
        return this with { Amount = Amount + other.Amount };
    }

    public bool IsPositive() => Amount > 0;
    protected override IEnumerable<object?> GetEqualityComponents()
    {
        yield return Amount;
        yield return Currency;
    }
}
```

---

## 3. Domain Event

```csharp
// shared/Shared.Domain/Events/IDomainEvent.cs
public interface IDomainEvent
{
    Guid EventId { get; }
    DateTime OccurredAt { get; }
    Guid? TenantId { get; }
}

// shared/Shared.Domain/Events/IDomainEventHandler.cs
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent @event, CancellationToken cancellationToken = default);
}
```

### Ví dụ aggregate raise event

```csharp
// src/SaasCheckin.Domain/EventManagement/Event.cs
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
    }
}

public record EventPublishedDomainEvent(
    Guid EventId, Guid? TenantId, string Title) : IDomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
    Guid? IDomainEvent.TenantId => TenantId;
}
```

### Dispatch in-process qua MediatR

Domain event raise → khi commit (`SaveChangesAsync`), framework tự dispatch handler in-process qua MediatR `INotification`. Khác distributed event (MassTransit publish ra broker).

---

## 4. Integration Event + Outbox

```csharp
// shared/Shared.Domain/Events/IIntegrationEvent.cs
public interface IIntegrationEvent
{
    Guid EventId { get; }
    DateTime OccurredAt { get; }
    Guid? TenantId { get; }
}

// shared/Shared.Application/IIntegrationEventBus.cs
public interface IIntegrationEventBus
{
    Task PublishAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : IIntegrationEvent;
}
```

### Outbox table (EF Core)

```csharp
// shared/Shared.Domain/Events/OutboxMessage.cs
public class OutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = default!;     // FQN assembly-qualified
    public string Payload { get; set; } = default!;        // JSON serialized
    public Guid? TenantId { get; set; }
    public DateTime OccurredAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public int RetryCount { get; set; }
    public string? LastError { get; set; }
}
```

### Outbox pattern flow

1. Use case gọi `IUnitOfWork.SaveChangesAsync()` → EF Core tự detect `OutboxMessage` mới insert cùng transaction.
2. **OutboxRelayService** (`IHostedService`) poll bảng `outbox_messages` mỗi 1s, publish event qua `IIntegrationEventBus` (MassTransit → RabbitMQ), đánh dấu `ProcessedAt`.
3. Retry exponential backoff; sau 5 lần → dead-letter table.

```csharp
// src/SaasCheckin.Infrastructure/Outbox/OutboxRelayService.cs (skeleton)
public class OutboxRelayService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<SaasCheckinDbContext>();
            var bus = scope.ServiceProvider.GetRequiredService<IIntegrationEventBus>();

            var pending = await db.OutboxMessages
                .Where(o => o.ProcessedAt == null && o.RetryCount < 5)
                .OrderBy(o => o.OccurredAt)
                .Take(100)
                .ToListAsync(stoppingToken);

            foreach (var msg in pending)
            {
                try
                {
                    var @event = JsonSerializer.Deserialize(msg.Payload, Type.GetType(msg.EventType)!) as IIntegrationEvent;
                    await bus.PublishAsync(@event!, stoppingToken);
                    msg.ProcessedAt = DateTime.UtcNow;
                }
                catch (Exception ex)
                {
                    msg.RetryCount++;
                    msg.LastError = ex.Message;
                }
            }
            await db.SaveChangesAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(1), stoppingToken);
        }
    }
}
```

---

## 5. Repository + UnitOfWork

```csharp
// shared/Shared.Application/IRepository.cs
public interface IRepository<TEntity, TKey>
    where TEntity : Entity<TKey>
    where TKey : notnull
{
    Task<TEntity?> GetAsync(TKey id, CancellationToken ct = default);
    Task<TEntity?> FindAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken ct = default);
    Task<IReadOnlyList<TEntity>> GetListAsync(Expression<Func<TEntity, bool>>? predicate = null, CancellationToken ct = default);
    Task<IReadOnlyList<TEntity>> GetPagedListAsync(int skipCount, int maxResultCount, Expression<Func<TEntity, bool>>? predicate = null, CancellationToken ct = default);
    Task<long> GetCountAsync(Expression<Func<TEntity, bool>>? predicate = null, CancellationToken ct = default);
    Task<TEntity> InsertAsync(TEntity entity, bool autoSave = false, CancellationToken ct = default);
    Task<TEntity> UpdateAsync(TEntity entity, bool autoSave = false, CancellationToken ct = default);
    Task DeleteAsync(TKey id, bool autoSave = false, CancellationToken ct = default);
    Task DeleteAsync(TEntity entity, bool autoSave = false, CancellationToken ct = default);
    IQueryable<TEntity> AsQueryable();
}

// shared/Shared.Application/IUnitOfWork.cs
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task<IDbTransaction> BeginTransactionAsync(CancellationToken ct = default);
}
```

### EF Core implementation

```csharp
// shared/Shared.EntityFrameworkCore/EfRepository.cs
public class EfRepository<TEntity, TKey> : IRepository<TEntity, TKey>
    where TEntity : Entity<TKey>
    where TKey : notnull
{
    protected readonly DbContext DbContext;
    protected readonly DbSet<TEntity> DbSet;

    public EfRepository(DbContext dbContext)
    {
        DbContext = dbContext;
        DbSet = dbContext.Set<TEntity>();
    }

    public virtual async Task<TEntity?> GetAsync(TKey id, CancellationToken ct = default) =>
        await DbSet.FirstOrDefaultAsync(e => e.Id.Equals(id), ct);

    public virtual async Task<long> GetCountAsync(Expression<Func<TEntity, bool>>? predicate = null, CancellationToken ct = default) =>
        await (predicate == null ? DbSet.LongCountAsync(ct) : DbSet.LongCountAsync(predicate, ct));

    public virtual async Task<TEntity> InsertAsync(TEntity entity, bool autoSave = false, CancellationToken ct = default)
    {
        var entry = await DbSet.AddAsync(entity, ct);
        if (autoSave) await DbContext.SaveChangesAsync(ct);
        return entry.Entity;
    }

    // ... các method khác

    public virtual IQueryable<TEntity> AsQueryable() => DbSet.AsQueryable();
}
```

---

## 6. Specification Pattern

```csharp
// shared/Shared.Domain/Specifications/Specification.cs
public abstract class Specification<TEntity>
    where TEntity : Entity<TKey> { /* generic form */ }

// Hoặc dùng LinqExpression trực tiếp (recommended, ít code)
public abstract class Specification<TEntity>
{
    public abstract Expression<Func<TEntity, bool>> ToExpression();

    public bool IsSatisfiedBy(TEntity entity) => ToExpression().Compile()(entity);

    public static implicit operator Expression<Func<TEntity, bool>>(Specification<TEntity> spec) => spec.ToExpression();
}
```

### Ví dụ `CanCheckInSpecification`

```csharp
// src/SaasCheckin.Domain/CheckIn/Specifications/CanCheckInSpecification.cs
public class CanCheckInSpecification : Specification<Registration>
{
    private readonly Event _event;
    private readonly Gate _gate;
    private readonly IReadOnlyList<CheckInRecord> _existingCheckIns;

    public CanCheckInSpecification(Event @event, Gate gate, IReadOnlyList<CheckInRecord> existingCheckIns)
    {
        _event = @event;
        _gate = gate;
        _existingCheckIns = existingCheckIns;
    }

    public override Expression<Func<Registration, bool>> ToExpression() =>
        r => r.EventId == _event.Id
          && r.Status == RegistrationStatus.Confirmed
          && !_existingCheckIns.Any(c => c.RegistrationId == r.Id && c.Status == CheckInStatus.Success);
}
```

---

## 7. ICurrentTenant (Multi-tenant ambient scope)

```csharp
// shared/Shared.Domain/MultiTenancy/ICurrentTenant.cs
public interface ICurrentTenant
{
    Guid? Id { get; }
    bool IsAvailable { get; }
    IDisposable Change(Guid? id);  // push scope
}

// shared/Shared.Domain/MultiTenancy/ITenantResolver.cs
public interface ITenantResolver
{
    Guid? Resolve(HttpContext context);  // từ JWT claim, header, hoặc subdomain
}

// shared/Shared.Application/CurrentTenant.cs
public class CurrentTenant : ICurrentTenant
{
    private static readonly AsyncLocal<Guid?> _currentId = new();

    public Guid? Id => _currentId.Value;
    public bool IsAvailable => _currentId.Value.HasValue;

    public IDisposable Change(Guid? id)
    {
        var previous = _currentId.Value;
        _currentId.Value = id;
        return new DisposeAction(() => _currentId.Value = previous);
    }
}
```

Middleware trong `SaasCheckin.HttpApi.Host`:
```csharp
app.Use(async (ctx, next) =>
{
    var resolver = ctx.RequestServices.GetRequiredService<ITenantResolver>();
    var tenantId = resolver.Resolve(ctx);
    if (tenantId.HasValue)
    {
        var currentTenant = ctx.RequestServices.GetRequiredService<ICurrentTenant>();
        using (currentTenant.Change(tenantId))
        {
            await next();
        }
    }
    else await next();
});
```

Kết hợp `TenantDbConnectionInterceptor` (xem `structure.md`) để set `app.current_tenant` ở mỗi connection.

---

## 8. IBoundedContextModule (bounded-context registration pattern)

```csharp
// src/SaasCheckin.Domain/Modules/IModule.cs
public interface IModule
{
    string Name { get; }
    Type[] Dependencies { get; }  // optional: load order
    void ConfigureServices(IServiceCollection services, IConfiguration configuration);
    void OnApplicationInitialization(ApplicationInitializationContext context);
    void OnApplicationShutdown(ApplicationShutdownContext context);
}

// Ví dụ: src/SaasCheckin.Domain/Identity/IdentityModule.cs
public class IdentityModule : ModuleBase
{
    public override string Name => "Identity";

    public override void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddTransient<IUserAppService, UserAppService>();
        services.AddTransient<OrganizationCreatedHandler>(); // local domain event
    }

    public override void OnApplicationInitialization(ApplicationInitializationContext context)
    {
        // seed roles, permissions
    }
}
```

---

## 9. Application Service base

```csharp
// shared/Shared.Application/ApplicationService.cs
public abstract class ApplicationService : IApplicationService
{
    public ICurrentTenant CurrentTenant { get; }
    public ICurrentUser CurrentUser { get; }
    public IUnitOfWork UnitOfWork { get; }
    public IGuidGenerator GuidGenerator { get; }
    public IClock Clock { get; }
    public IObjectMapper ObjectMapper { get; }
    public ILogger Logger { get; }

    protected ApplicationService(IServiceProvider serviceProvider)
    {
        CurrentTenant = serviceProvider.GetRequiredService<ICurrentTenant>();
        CurrentUser = serviceProvider.GetRequiredService<ICurrentUser>();
        UnitOfWork = serviceProvider.GetRequiredService<IUnitOfWork>();
        GuidGenerator = serviceProvider.GetRequiredService<IGuidGenerator>();
        Clock = serviceProvider.GetRequiredService<IClock>();
        ObjectMapper = serviceProvider.GetRequiredService<IObjectMapper>();
        Logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(GetType());
    }
}
```

### Ví dụ `EventAppService`

```csharp
// src/SaasCheckin.Application/EventManagement/EventAppService.cs
public class EventAppService : ApplicationService, IEventAppService
{
    private readonly IEventRepository _eventRepository;

    public EventAppService(IServiceProvider sp, IEventRepository eventRepository) : base(sp)
    {
        _eventRepository = eventRepository;
    }

    [Authorize(EventManagementPermissions.Events.Create)]
    public async Task<EventDto> CreateAsync(CreateEventInput input, CancellationToken ct = default)
    {
        var @event = new Event(
            id: GuidGenerator.Create(),
            tenantId: CurrentTenant.Id,
            title: input.Title,
            startAt: input.StartAt,
            endAt: input.EndAt,
            capacity: input.Capacity);

        await _eventRepository.InsertAsync(@event, autoSave: true, ct);
        return ObjectMapper.Map<Event, EventDto>(@event);
    }
}
```

---

## 10. Result\<T\> + Business Rule Validation

```csharp
// shared/Shared.Domain.Core/Result.cs
public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }
    public string? ErrorCode { get; }

    private Result(bool success, T? value, string? error, string? errorCode)
    {
        IsSuccess = success; Value = value; Error = error; ErrorCode = errorCode;
    }

    public static Result<T> Success(T value) => new(true, value, null, null);
    public static Result<T> Failure(string error, string? errorCode = null) => new(false, default, error, errorCode);

    public static implicit operator Result<T>(T value) => Success(value);
}

public class BusinessRuleViolationException : Exception
{
    public string Code { get; }
    public BusinessRuleViolationException(string message, string code = "BUSINESS_RULE_VIOLATION")
        : base(message) { Code = code; }
}
```

---

## 11. MediatR Pipeline Behaviors

```csharp
// shared/Shared.Application/Behaviors/ValidationBehavior.cs
public class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;
    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators) => _validators = validators;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (!_validators.Any()) return await next(ct);
        var context = new ValidationContext<TRequest>(request);
        var failures = (await Task.WhenAll(_validators.Select(v => v.ValidateAsync(context, ct))))
            .SelectMany(r => r.Errors).Where(f => f != null).ToList();
        if (failures.Count > 0) throw new ValidationException(failures);
        return await next(ct);
    }
}

// shared/Shared.Application/Behaviors/UnitOfWorkBehavior.cs
public class UnitOfWorkBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IUnitOfWork _uow;
    public UnitOfWorkBehavior(IUnitOfWork uow) => _uow = uow;
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        // Auto-save sau khi command handler chạy xong (chỉ với command, không với query)
        if (request is ICommand)
        {
            var response = await next(ct);
            await _uow.SaveChangesAsync(ct);
            return response;
        }
        return await next(ct);
    }
}
```

Registration trong module:
```csharp
services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssembly(typeof(SaasCheckinApplicationModule).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
    cfg.AddOpenBehavior(typeof(UnitOfWorkBehavior<,>));
    cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
    cfg.AddOpenBehavior(typeof(MultiTenantBehavior<,>));
});
```

---

## 12. Payment Provider (giữ interface pattern cũ)

```csharp
// shared/Shared.Application/Payments/IPaymentProvider.cs (hoặc src/SaasCheckin.Application.Contracts/Payments/)
public interface IPaymentProvider
{
    string Name { get; } // "stripe" | "vnpay"
    Task<CheckoutResult> CreateCheckoutAsync(CheckoutInput input, CancellationToken ct = default);
    Task<WebhookEvent> VerifyWebhookAsync(IDictionary<string, string> headers, string body, CancellationToken ct = default);
    Task CancelOrderAsync(string providerOrderId, CancellationToken ct = default);
    Task<RefundResult> RefundAsync(string paymentId, Money amount, CancellationToken ct = default);
}
```

Hai adapter: `StripePaymentAdapter` và `VnpayPaymentAdapter` trong `src/SaasCheckin.Infrastructure/Payments/`. Webhook controller trong `HttpApi.Host` route theo `provider` claim.

---

## 13. Testing — Architecture Rules

```csharp
// tests/SaasCheckin.Architecture.Tests/ArchitectureTests.cs
public class ArchitectureTests
{
    [Fact]
    public void Domain_Should_Not_Depend_On_Application_Or_Infrastructure()
    {
        var result = Types.InAssembly(typeof(SaasCheckin.Domain.Modules.IModule).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "SaasCheckin.Application",
                "SaasCheckin.Application.Contracts",
                "SaasCheckin.EntityFrameworkCore",
                "SaasCheckin.Infrastructure",
                "SaasCheckin.HttpApi.Host")
            .GetResult();
        result.IsSuccessful.Should().BeTrue(result.FailingTypeNames?.ToString());
    }

    [Fact]
    public void Application_Contracts_Should_Not_Depend_On_Application()
    {
        var result = Types.InAssembly(typeof(SaasCheckin.Application.Contracts.IEventAppService).Assembly)
            .ShouldNot()
            .HaveDependencyOn("SaasCheckin.Application")
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }

    [Fact]
    public void Application_Should_Not_Depend_On_Infrastructure_Or_EFCore()
    {
        var result = Types.InAssembly(typeof(SaasCheckin.Application.EventAppService).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny("SaasCheckin.Infrastructure", "SaasCheckin.EntityFrameworkCore")
            .GetResult();
        result.IsSuccessful.Should().BeTrue();
    }
}
```

---

## 14. Tổng kết — quy tắc vàng

1. **Domain thuần**: Aggregate không reference EF Core, MediatR, MassTransit. Chỉ `Shared.Domain` + `SaasCheckin.Domain.Core`.
2. **Application.Contracts không reference Application**: chỉ interface + DTO.
3. **Application reference Application.Contracts + Shared.Application**, KHÔNG reference Infrastructure / EF Core.
4. **EF Core chỉ chứa mapping + repository impl**, không có domain logic.
5. **HttpApi.Host là composition root duy nhất** chạy được, wire up DI cho tất cả module.
6. **DbMigrator tách riêng**, chạy 1 lần trong CI/CD.
7. **Outbox là cầu nối** giữa domain event (in-process, MediatR) và integration event (cross-service, MassTransit + RabbitMQ).
8. **NetArchTest** enforce các quy tắc trên ở tầng test — không cần code review thủ công.
