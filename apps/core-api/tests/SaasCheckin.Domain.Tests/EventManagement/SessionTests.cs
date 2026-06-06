using FluentAssertions;
using SaasCheckin.Domain.EventManagement.Aggregates;
using SaasCheckin.Domain.EventManagement.Events;
using SaasCheckin.Domain.EventManagement.ValueObjects;
using SaasCheckin.Shared.Domain.Core;
using Xunit;

namespace SaasCheckin.Domain.Tests.EventManagement;

/// <summary>
/// Unit tests cho Session aggregate (I-201). Validate Stateless state machine
/// + invariants (period within event, capacity > 0, title length).
/// </summary>
public class SessionTests
{
    private static readonly Guid OrgId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly EventId ParentEventId = EventId.From(Guid.Parse("33333333-3333-3333-3333-333333333333"));
    private static readonly FixedClock Clock = new(new DateTimeOffset(2026, 6, 5, 10, 0, 0, TimeSpan.Zero));

    private static Session NewSession(SessionStatus? startStatus = null)
    {
        var s = Session.Create(
            OrgId, ParentEventId,
            "Keynote", "Opening keynote",
            EventPeriod.Create(
                new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 9, 1, 10, 0, 0, TimeSpan.Zero)),
            Capacity.Create(200),
            venueId: null,
            Clock);
        if (startStatus is not null)
        {
            s.Schedule(Clock);
            if (startStatus == SessionStatus.Started) s.Start(Clock);
            if (startStatus == SessionStatus.Ended) { s.Schedule(Clock); s.Start(Clock); s.End(Clock); }
        }
        return s;
    }

    [Fact]
    public void Create_returns_draft_session_with_event_link()
    {
        var s = Session.Create(
            OrgId, ParentEventId,
            "Keynote", null,
            EventPeriod.Create(
                new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.Zero),
                new DateTimeOffset(2026, 9, 1, 10, 0, 0, TimeSpan.Zero)),
            Capacity.Create(100), null, Clock);

        s.Id.Value.Should().NotBe(Guid.Empty);
        s.EventId.Should().Be(ParentEventId);
        s.OrganizationId.Should().Be(OrgId);
        s.Status.Should().Be(SessionStatus.Draft);
        s.DomainEvents.OfType<SessionCreated>().Should().ContainSingle();
    }

    [Fact]
    public void Create_rejects_empty_title()
    {
        Action act = () => Session.Create(
            OrgId, ParentEventId, "", null,
            EventPeriod.Create(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(1)),
            Capacity.Create(10), null, Clock);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_rejects_zero_capacity()
    {
        Action act = () => Capacity.Create(0);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Schedule_transitions_Draft_to_Scheduled()
    {
        var s = NewSession();
        s.Schedule(Clock);
        s.Status.Should().Be(SessionStatus.Scheduled);
        s.DomainEvents.OfType<SessionStatusChanged>().Should().HaveCount(1);
    }

    [Fact]
    public void Start_requires_Scheduled()
    {
        var s = NewSession();
        Action act = () => s.Start(Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Full_lifecycle_Draft_to_Ended()
    {
        var s = NewSession();
        s.Schedule(Clock);
        s.Start(Clock);
        s.End(Clock);
        s.Status.Should().Be(SessionStatus.Ended);
    }

    [Fact]
    public void Cancel_allowed_from_Draft_and_Scheduled_only()
    {
        var draft = NewSession();
        draft.Cancel(Clock);
        draft.Status.Should().Be(SessionStatus.Cancelled);

        var scheduled = NewSession();
        scheduled.Schedule(Clock);
        scheduled.Cancel(Clock);
        scheduled.Status.Should().Be(SessionStatus.Cancelled);

        var started = NewSession();
        started.Schedule(Clock);
        started.Start(Clock);
        Action act = () => started.Cancel(Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Update_rejects_when_not_Draft()
    {
        var s = NewSession();
        s.Schedule(Clock);
        Action act = () => s.Update("New", null, null, null, null, Clock);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Update_changes_fields_when_Draft()
    {
        var s = NewSession();
        s.Update("Updated title", "New desc", null, Capacity.Create(300), null, Clock);
        s.Title.Should().Be("Updated title");
        s.Description.Should().Be("New desc");
        s.Capacity.Value.Should().Be(300);
    }
}
