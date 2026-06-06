using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using SaasCheckin.Utility;
using Stateless;

namespace SaasCheckin.Domain.EventManagement.Aggregates;

/// <summary>
/// Session — 1 track/time-slot trong 1 Event (vd "Keynote 09:00-10:00").
/// Aggregate root riêng (consistency boundary) — vì Session có lifecycle độc lập
/// với Event (vd có thể cancel 1 session mà không cancel cả event). Tham chiếu
/// Event bằng EventId + OrganizationId cho RLS.
///
/// State machine (Stateless):
///   Draft → Scheduled → Started → Ended
///                ↘ Cancelled
/// </summary>
public sealed class Session : AggregateRoot<SessionId>
{
    public Guid OrganizationId { get; private set; }      // tenant_id for RLS
    public EventId EventId { get; private set; }
    public VenueId? VenueId { get; private set; }        // optional — có thể online/no-venue
    public string Title { get; private set; } = default!;
    public string? Description { get; private set; }
    public EventPeriod Period { get; private set; } = default!;  // start/end
    public Capacity Capacity { get; private set; }
    public SessionStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private readonly StateMachine<SessionStatus, SessionTrigger> _machine;

    // EF ctor
    private Session() : base(default!) { _machine = null!; }

    private Session(
        SessionId id,
        Guid orgId,
        EventId eventId,
        string title,
        string? description,
        EventPeriod period,
        Capacity capacity,
        VenueId? venueId,
        IClock clock) : base(id)
    {
        Guard.NotNullStruct(id, nameof(id));
        Guard.NotNullStruct(orgId, nameof(orgId));
        if (orgId == Guid.Empty) throw new ArgumentException("OrganizationId required", nameof(orgId));
        Guard.NotNullStruct(eventId, nameof(eventId));
        Guard.NotNullOrWhiteSpace(title, nameof(title));
        if (title.Length > 200) throw new ArgumentException("Title > 200 chars", nameof(title));

        OrganizationId = orgId;
        EventId = eventId;
        Title = title.Trim();
        Description = description?.Trim();
        Period = period;
        Capacity = capacity;
        VenueId = venueId;
        Status = SessionStatus.Draft;
        var now = clock.UtcNow;
        CreatedAt = now;
        UpdatedAt = now;

        _machine = new StateMachine<SessionStatus, SessionTrigger>(() => Status, s => Status = s);
        ConfigureMachine(clock);
    }

    public static Session Create(
        Guid organizationId,
        EventId eventId,
        string title,
        string? description,
        EventPeriod period,
        Capacity capacity,
        VenueId? venueId,
        IClock clock)
    {
        var session = new Session(
            SessionId.New(), organizationId, eventId,
            title, description, period, capacity, venueId, clock);
        session.RaiseDomainEvent(new SessionCreated(
            session.Id, session.OrganizationId, session.EventId, session.Title, clock.UtcNow));
        return session;
    }

    /// <summary>Update draft fields. Only allowed khi status = Draft.</summary>
    public void Update(
        string? title,
        string? description,
        EventPeriod? period,
        Capacity? capacity,
        VenueId? venueId,
        IClock clock)
    {
        if (Status != SessionStatus.Draft)
            throw new InvalidOperationException($"Only Draft sessions can be updated (current: {Status})");

        if (title is not null)
        {
            Guard.NotNullOrWhiteSpace(title, nameof(title));
            if (title.Length > 200) throw new ArgumentException("Title > 200 chars");
            Title = title.Trim();
        }
        if (description is not null) Description = description.Trim();
        if (period is not null) Period = period;
        if (capacity.HasValue) Capacity = capacity.Value;
        VenueId = venueId ?? VenueId;   // explicit null clears
        UpdatedAt = clock.UtcNow;
    }

    public void Schedule(IClock clock) => Transition(SessionTrigger.Schedule, clock);
    public void Start(IClock clock) => Transition(SessionTrigger.Start, clock);
    public void End(IClock clock) => Transition(SessionTrigger.End, clock);
    public void Cancel(IClock clock) => Transition(SessionTrigger.Cancel, clock);

    private void Transition(SessionTrigger trigger, IClock clock)
    {
        _machine.Fire(trigger);
        UpdatedAt = clock.UtcNow;
        RaiseDomainEvent(new SessionStatusChanged(
            Id, OrganizationId, EventId, Status, clock.UtcNow));
    }

    private void ConfigureMachine(IClock clock)
    {
        _machine.Configure(SessionStatus.Draft)
            .Permit(SessionTrigger.Schedule, SessionStatus.Scheduled)
            .Permit(SessionTrigger.Cancel, SessionStatus.Cancelled);
        _machine.Configure(SessionStatus.Scheduled)
            .Permit(SessionTrigger.Start, SessionStatus.Started)
            .Permit(SessionTrigger.Cancel, SessionStatus.Cancelled);
        _machine.Configure(SessionStatus.Started)
            .Permit(SessionTrigger.End, SessionStatus.Ended);
        _machine.Configure(SessionStatus.Ended)
            .OnEntry(() => UpdatedAt = clock.UtcNow);
        _machine.Configure(SessionStatus.Cancelled)
            .OnEntry(() => UpdatedAt = clock.UtcNow);
    }
}

public enum SessionTrigger { Schedule, Start, End, Cancel }
