using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Stateless;

namespace SaasCheckin.Domain.EventManagement.Aggregates;

/// <summary>
/// Event aggregate root. Multi-tenant — has OrganizationId cho RLS.
///
/// State machine (Stateless):
///   Draft → Published → Completed
///            ↘ Cancelled
///
/// Transitions:
///   Publish   : Draft    → Published
///   Cancel    : Draft|Published → Cancelled   (Completed không cancel được)
///   Complete  : Published → Completed         (auto: endAt đã qua)
/// </summary>
public sealed class Event : AggregateRoot<EventId>
{
    public Guid OrganizationId { get; private set; }  // tenant_id for RLS
    public string Title { get; private set; } = default!;
    public string? Description { get; private set; }
    public EventPeriod Period { get; private set; } = default!;
    public Capacity Capacity { get; private set; }
    public EventStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public int SoldTickets { get; private set; }

    private readonly StateMachine<EventStatus, EventTrigger> _machine;

    // EF ctor
    private Event() : base(default!) { _machine = null!; }

    private Event(
        EventId id,
        Guid orgId,
        string title,
        string? description,
        EventPeriod period,
        Capacity capacity,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullOrWhiteSpace(title, nameof(title));
        if (title.Length > 200) throw new ArgumentException("Title > 200 chars", nameof(title));

        OrganizationId = orgId;
        Title = title.Trim();
        Description = description?.Trim();
        Period = period;
        Capacity = capacity;
        Status = EventStatus.Draft;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;

        _machine = new StateMachine<EventStatus, EventTrigger>(() => Status, s => Status = s);
        ConfigureMachine();
    }

    public static Event Create(
        Guid organizationId,
        string title,
        string? description,
        EventPeriod period,
        Capacity capacity,
        IClock clock)
    {
        return new Event(EventId.New(), organizationId, title, description, period, capacity, clock);
    }

    /// <summary>Update title/description/period/capacity. Draft-only.</summary>
    public void Update(string? title, string? description, EventPeriod? period, Capacity? capacity, IClock clock)
    {
        if (Status != EventStatus.Draft)
            throw new InvalidOperationException("Only Draft events can be updated");

        if (title is not null)
        {
            Guard.NotNullOrWhiteSpace(title, nameof(title));
            if (title.Length > 200) throw new ArgumentException("Title > 200 chars");
            Title = title.Trim();
        }
        if (description is not null) Description = description.Trim();
        if (period is not null) Period = period;
        if (capacity.HasValue)
        {
            if (capacity.Value.Value < SoldTickets)
                throw new InvalidOperationException(
                    $"Cannot reduce capacity ({capacity.Value.Value}) below sold tickets ({SoldTickets})");
            Capacity = capacity.Value;
        }
        UpdatedAt = clock.UtcNow;
    }

    public void Publish(IClock clock)
    {
        _machine.Fire(EventTrigger.Publish);
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new EventPublished(Id, OrganizationId, Title, clock.UtcNow));
    }

    public void Cancel(IClock clock)
    {
        if (Status == EventStatus.Cancelled) return;
        _machine.Fire(EventTrigger.Cancel);
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new EventCancelled(Id, OrganizationId, clock.UtcNow));
    }

    public void Complete(IClock clock)
    {
        if (Status != EventStatus.Published)
            throw new InvalidOperationException($"Cannot complete event in status {Status}");
        _machine.Fire(EventTrigger.Complete);
        UpdatedAt = clock.UtcNow;
    }

    /// <summary>Internal: called by Registration context when tickets are sold.</summary>
    public void IncrementSoldTickets(int delta, IClock clock)
    {
        Guard.NotNegativeOrZero(delta, nameof(delta));
        if (SoldTickets + delta > Capacity.Value)
            throw new InvalidOperationException(
                $"Sold tickets ({SoldTickets + delta}) would exceed capacity ({Capacity.Value})");
        SoldTickets += delta;
        UpdatedAt = clock.UtcNow;
    }

    private void ConfigureMachine()
    {
        _machine.Configure(EventStatus.Draft)
            .Permit(EventTrigger.Publish, EventStatus.Published)
            .Permit(EventTrigger.Cancel, EventStatus.Cancelled);
        _machine.Configure(EventStatus.Published)
            .Permit(EventTrigger.Cancel, EventStatus.Cancelled)
            .Permit(EventTrigger.Complete, EventStatus.Completed);
        _machine.Configure(EventStatus.Cancelled);
        _machine.Configure(EventStatus.Completed);
    }
}

public enum EventTrigger { Publish, Cancel, Complete }
