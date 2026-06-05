namespace SaasCheckin.Shared.Domain.Core;

/// <summary>
/// AggregateRoot — base class cho tất cả aggregate root trong DDD layered (ADR-0013).
/// Phase 0 stub. Phase 1+ sẽ thêm: ApplyEvent, Reconstitute, DomainEvents collection.
/// </summary>
public abstract class AggregateRoot<TKey>
{
    /// <summary>Protected ctor cho derived class (để dùng : base(id)).</summary>
    protected AggregateRoot() { }

    /// <summary>Protected ctor với id.</summary>
    protected AggregateRoot(TKey id) { Id = id; }

    public TKey Id { get; protected set; } = default!;

    /// <summary>Domain events raised bởi aggregate, drain khi persist.</summary>
    private readonly List<IDomainEvent> _domainEvents = new();
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;

    /// <summary>Raise 1 domain event (từ bên trong aggregate).</summary>
    protected void RaiseDomainEvent(IDomainEvent @event) => _domainEvents.Add(@event);

    /// <summary>Alias cho RaiseDomainEvent — dùng ngoài partial class context.</summary>
    protected void AddDomainEvent(IDomainEvent @event) => _domainEvents.Add(@event);

    public void ClearDomainEvents() => _domainEvents.Clear();
}

/// <summary>Marker interface cho in-process domain events.</summary>
public interface IDomainEvent
{
    DateTimeOffset OccurredAt { get; }
}

/// <summary>Marker cho aggregate identity (Guid, long, string…).</summary>
public interface IAggregateRoot { }
