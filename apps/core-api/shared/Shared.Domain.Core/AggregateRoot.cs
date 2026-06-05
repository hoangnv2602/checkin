namespace SaasCheckin.Shared.Domain.Core;

/// <summary>
/// AggregateRoot — base class cho tất cả aggregate root trong DDD layered (ADR-0013).
/// Phase 0 stub. Phase 1+ sẽ thêm: ApplyEvent, Reconstitute, DomainEvents collection.
/// </summary>
public abstract class AggregateRoot<TKey>
{
    public TKey Id { get; protected set; } = default!;

    /// <summary>Domain events raised bởi aggregate, drain khi persist.</summary>
    private readonly List<IDomainEvent> _domainEvents = new();
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents;

    protected void RaiseDomainEvent(IDomainEvent @event) => _domainEvents.Add(@event);

    public void ClearDomainEvents() => _domainEvents.Clear();
}

/// <summary>Marker interface cho in-process domain events.</summary>
public interface IDomainEvent
{
    DateTimeOffset OccurredAt { get; }
}

/// <summary>Marker cho aggregate identity (Guid, long, string…).</summary>
public interface IAggregateRoot { }
